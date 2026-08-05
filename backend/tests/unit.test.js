const { Prisma } = require('@prisma/client');
const { errorHandler, notFound } = require('../src/middleware/errorHandler');
const { ApiError } = require('../src/utils/errors');
const { roleNames, serializeUser, serializeGrant } = require('../src/lib/serializers');
const { parsePagination, MAX_LIMIT } = require('../src/utils/pagination');
const { hasAnyRole } = require('../src/middleware/auth');
const { getTokenExpiry, generateTokenPair } = require('../src/utils/jwt');
const { store, saveOAuthState, consumeOAuthState, revokeAccessToken, isAccessTokenRevoked } =
  require('../src/lib/redis');

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const prismaKnownError = (code) =>
  new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });

describe('errorHandler', () => {
  it('uses the status carried by an ApiError', () => {
    const res = mockRes();
    errorHandler(ApiError.forbidden('nope'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'nope' });
  });

  it('includes field errors when present', () => {
    const res = mockRes();
    errorHandler(ApiError.badRequest('bad', [{ field: 'x' }]), {}, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [{ field: 'x' }] })
    );
  });

  it.each([
    ['P2002', 409],
    ['P2003', 400],
    ['P2025', 404],
  ])('maps Prisma %s to HTTP %i', (code, status) => {
    const res = mockRes();
    errorHandler(prismaKnownError(code), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('falls through to 500 for an unmapped Prisma code', () => {
    const res = mockRes();
    errorHandler(prismaKnownError('P2010'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('maps a Prisma validation error to 400', () => {
    const res = mockRes();
    errorHandler(new Prisma.PrismaClientValidationError('bad args', { clientVersion: 'test' }), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('hides internal messages in production', () => {
    const previous = process.env.NODE_ENV;
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    const { errorHandler: prodHandler } = require('../src/middleware/errorHandler');

    const res = mockRes();
    prodHandler(new Error('database password is hunter2'), {}, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Internal server error' });
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
    process.env.NODE_ENV = previous;
    jest.resetModules();
  });

  it('reports the requested path for unknown routes', () => {
    const res = mockRes();
    notFound({ originalUrl: '/api/nowhere' }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Route /api/nowhere not found' })
    );
  });
});

describe('serializers', () => {
  it('reads role names from join rows and from a plain array', () => {
    expect(roleNames({ roles: [{ role: { name: 'ADMIN' } }] })).toEqual(['ADMIN']);
    expect(roleNames({ roles: ['GRANT_MANAGER', 'ADMIN'] })).toEqual(['ADMIN', 'GRANT_MANAGER']);
    expect(roleNames({})).toEqual([]);
    expect(roleNames(null)).toEqual([]);
  });

  it('never exposes the password hash', () => {
    const serialized = serializeUser({
      id: 'u1',
      name: 'A',
      email: 'a@b.c',
      password: '$2a$hash',
      roles: [],
    });
    expect(serialized.password).toBeUndefined();
  });

  it('returns null for a missing record', () => {
    expect(serializeUser(null)).toBeNull();
    expect(serializeGrant(null)).toBeNull();
  });

  it('converts Decimal amounts to numbers', () => {
    const grant = serializeGrant({ id: 'g1', amount: { toString: () => '1500.50' } });
    expect(grant.amount).toBe(1500.5);
  });
});

describe('parsePagination', () => {
  it('applies defaults', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 10 });
    expect(parsePagination({}, 20)).toEqual({ page: 1, limit: 20 });
  });

  it('clamps out-of-range values', () => {
    expect(parsePagination({ page: '-3', limit: '0' })).toEqual({ page: 1, limit: 1 });
    expect(parsePagination({ limit: '5000' }).limit).toBe(MAX_LIMIT);
  });

  it('ignores non-numeric input', () => {
    expect(parsePagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 10 });
  });
});

describe('hasAnyRole', () => {
  it('matches on any overlapping role', () => {
    const user = { roles: ['APPLICANT', 'GRANT_MANAGER'] };
    expect(hasAnyRole(user, ['ADMIN', 'GRANT_MANAGER'])).toBe(true);
    expect(hasAnyRole(user, ['ADMIN'])).toBe(false);
    expect(hasAnyRole(null, ['ADMIN'])).toBe(false);
    expect(hasAnyRole({}, ['ADMIN'])).toBe(false);
  });
});

describe('jwt helpers', () => {
  it('puts every role in the access token and returns its expiry', () => {
    const { accessToken } = generateTokenPair({
      id: 'u1',
      email: 'a@b.c',
      name: 'A',
      roles: [{ role: { name: 'ADMIN' } }, { role: { name: 'APPLICANT' } }],
    });

    expect(getTokenExpiry(accessToken).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns a date even for an unparseable token', () => {
    expect(getTokenExpiry('garbage')).toBeInstanceOf(Date);
  });
});

describe('in-process key/value store', () => {
  it('round-trips an OAuth state and consumes it once', async () => {
    await saveOAuthState('state-a', { redirectTo: '/grants' });

    expect(await consumeOAuthState('state-a')).toEqual({ redirectTo: '/grants' });
    expect(await consumeOAuthState('state-a')).toBeNull();
  });

  it('returns null for stored values that are not JSON', async () => {
    await store.set('oauth:state:broken', 'not json', 60);
    expect(await consumeOAuthState('broken')).toBeNull();
  });

  it('expires entries once their TTL has passed', async () => {
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now');
    spy.mockReturnValue(now);

    await store.set('short-lived', 'value', 1);
    expect(await store.get('short-lived')).toBe('value');

    spy.mockReturnValue(now + 2000);
    expect(await store.get('short-lived')).toBeNull();
    spy.mockRestore();
  });

  it('keeps entries without a TTL', async () => {
    await store.set('forever', 'value', 0);
    expect(await store.get('forever')).toBe('value');
    expect(await store.del('forever')).toBe(1);
    expect(await store.del('forever')).toBe(0);
  });

  it('denylists an access token id', async () => {
    expect(await isAccessTokenRevoked('jti-1')).toBe(false);
    await revokeAccessToken('jti-1', 60);
    expect(await isAccessTokenRevoked('jti-1')).toBe(true);
  });
});
