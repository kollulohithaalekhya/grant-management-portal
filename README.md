# 🏛️ Secure Grant Management Portal

A full-stack grant management portal with **PostgreSQL**, role-based access control
(users can hold several roles at once), JWT access/refresh tokens, **Google OAuth 2.0**
sign-in, and a React + TypeScript frontend. The whole stack runs from a single
`docker compose up`.

---

## Contents

- [Architecture](#architecture)
- [Quick start with Docker](#quick-start-with-docker)
- [Running without Docker](#running-without-docker)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Authentication](#authentication)
- [Google OAuth 2.0 setup](#google-oauth-20-setup)
- [Roles and permissions](#roles-and-permissions)
- [API reference](#api-reference)
- [Testing](#testing)
- [Security notes](#security-notes)
- [Project plan](#project-plan)

---

## Architecture

```
.
├── docker-compose.yml       # postgres + redis + app (API) + web (nginx/SPA)
├── .env.example             # environment template for docker-compose
├── PROJECT_PLAN.md          # user stories, sprints, acceptance criteria
│
├── backend/                 # Node.js + Express REST API
│   ├── prisma/
│   │   ├── schema.prisma    # PostgreSQL schema
│   │   ├── migrations/      # generated + hand-written SQL migrations
│   │   └── seed.js          # idempotent development seed
│   ├── src/
│   │   ├── app.js           # express app (no listener — used by tests too)
│   │   ├── server.js        # HTTP listener + graceful shutdown
│   │   ├── config/          # environment loading and validation
│   │   ├── constants/       # role catalogue
│   │   ├── controllers/     # thin HTTP handlers
│   │   ├── services/        # business logic + transactions
│   │   ├── middleware/      # authentication, RBAC, validation, errors
│   │   ├── routes/          # route definitions
│   │   ├── validators/      # express-validator chains per route
│   │   ├── lib/             # prisma client, redis store, serializers
│   │   └── utils/           # jwt, pagination, responses, ApiError
│   ├── tests/               # Jest + Supertest suites
│   ├── Dockerfile
│   └── docker-entrypoint.sh # runs `prisma migrate deploy` before boot
│
└── frontend/                # React 19 + Vite + TypeScript + Tailwind
    ├── src/
    │   ├── api/             # axios client (token refresh) + service calls
    │   ├── components/      # UI, layout, auth (Google button)
    │   ├── context/         # AuthContext
    │   ├── pages/           # route-level screens incl. /oauth/callback
    │   ├── types/           # shared TypeScript interfaces
    │   └── utils/           # formatters, role helpers
    ├── Dockerfile           # multi-stage build -> nginx
    └── nginx.conf           # SPA fallback + /api proxy
```

**Stack:** Node.js 20 · Express 4 · Prisma 6 · PostgreSQL 16 · Redis 7 · JWT ·
bcryptjs · Helmet · express-validator · Jest · Supertest · React 19 · Vite ·
Tailwind CSS · React Router 7 · Axios

---

## Quick start with Docker

Requires Docker Desktop (or Docker Engine + Compose v2).

```bash
cp .env.example .env

# Set real secrets — the app refuses to start with placeholders missing.
#   openssl rand -hex 48   # -> JWT_SECRET
#   openssl rand -hex 48   # -> JWT_REFRESH_SECRET

# Build and start postgres, redis, the API and the SPA.
# RUN_SEED=true loads demo users, grants and applications on first boot.
RUN_SEED=true docker compose up -d --build

docker compose ps          # all four services should report "healthy"
```

| Service | URL | Notes |
|---------|-----|-------|
| Web (SPA) | http://localhost:8080 | nginx, proxies `/api` to the API |
| API | http://localhost:5000 | `GET /health` reports database status |
| PostgreSQL | localhost:5432 | volume `postgres_data` |
| Redis | localhost:6379 | volume `redis_data` |

Startup sequence: `postgres` and `redis` must pass their healthchecks before
`app` starts; `app` applies pending migrations (`prisma migrate deploy`) and
then serves; `web` waits for `app` to report healthy.

```bash
docker compose logs -f app     # follow API logs
docker compose down            # stop, keep data
docker compose down -v         # stop and delete the volumes
```

### Demo credentials (created by the seed)

| Roles | Email | Password |
|-------|-------|----------|
| ADMIN | admin@grantportal.com | `Admin@123` |
| GRANT_MANAGER | manager@grantportal.com | `Manager@123` |
| GRANT_MANAGER + ADMIN | lead@grantportal.com | `Lead@1234` |
| APPLICANT | applicant@grantportal.com | `Applicant@123` |

`lead@grantportal.com` exists to demonstrate concurrent roles.

---

## Running without Docker

You still need a PostgreSQL 14+ server. Redis is optional — when `REDIS_URL` is
unset the API falls back to an equivalent in-process store (fine for a single
instance; use Redis when running more than one).

```bash
# 1. Database + cache (or use your own PostgreSQL)
docker compose up -d postgres redis

# 2. API
cd backend
cp .env.example .env         # set DATABASE_URL and the JWT secrets
npm install
npm run migrate              # prisma migrate deploy
npm run seed                 # optional demo data
npm run dev                  # http://localhost:5000

# 3. Frontend
cd ../frontend
npm install
npm run dev                  # http://localhost:5173
```

When running the frontend on port 5173, set `CLIENT_URL=http://localhost:5173`
in `backend/.env` so CORS and the OAuth redirect point at it.

---

## Environment variables

`.env.example` (repository root) is read by docker-compose.
`backend/.env.example` is the equivalent for running the API directly.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string used by Prisma |
| `JWT_SECRET` | yes | Signing key for access tokens |
| `JWT_REFRESH_SECRET` | yes | Signing key for refresh tokens |
| `JWT_EXPIRES_IN` | no | Access token lifetime (default `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | no | Refresh token lifetime (default `7d`) |
| `OAUTH_CLIENT_ID` | for OAuth | Google OAuth client id |
| `OAUTH_CLIENT_SECRET` | for OAuth | Google OAuth client secret |
| `OAUTH_REDIRECT_URI` | for OAuth | Must match the URI registered with Google |
| `REDIS_URL` | no | Redis connection string; in-process store when unset |
| `CLIENT_URL` | no | Frontend origin for CORS + post-OAuth redirect |
| `PORT` | no | API port (default `5000`) |
| `NODE_ENV` | no | `development` / `production` / `test` |

docker-compose additionally reads `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB`, `POSTGRES_PORT`, `REDIS_PORT`, `API_PORT`, `WEB_PORT` and
`RUN_SEED`.

The API fails fast at startup if `JWT_SECRET` or `JWT_REFRESH_SECRET` is
missing, rather than signing tokens with an empty key.

---

## Database

PostgreSQL, accessed through Prisma. Schema: `backend/prisma/schema.prisma`.

| Table | Purpose |
|-------|---------|
| `users` | Accounts. `password` is null for Google-only accounts |
| `roles` | Role catalogue: `ADMIN`, `GRANT_MANAGER`, `APPLICANT` |
| `user_roles` | Many-to-many join, composite PK `(user_id, role_id)` |
| `grants` | Funding opportunities, FK `created_by → users.id` |
| `applications` | Submissions, FKs to `grants`, applicant and reviewer |
| `notifications` | Per-user messages, FK to `users` |
| `refresh_tokens` | Issued refresh tokens with expiry and revocation |

Foreign keys and delete behaviour:

- `user_roles` → users/roles: **cascade** (removing a user removes its roles)
- `applications.grant_id` → grants: **cascade**
- `applications.applicant_id` → users: **cascade**
- `applications.reviewed_by` → users: **set null** (history survives)
- `grants.created_by` → users: **restrict** (a user with grants cannot vanish)
- `notifications.user_id`, `refresh_tokens.user_id` → users: **cascade**

`applications` has a unique constraint on `(grant_id, applicant_id)` — one
application per applicant per grant, enforced by the database.

### Transactions

Multi-write flows run inside `prisma.$transaction`, so they either land
completely or not at all:

- **Registration** — user row + role assignment + refresh token
- **Refresh rotation** — revoke the old token and issue the new pair
- **Application submit** — application + "submitted" notification
- **Application review** — decision + applicant notification
- **Role replacement** — delete old assignments and insert new ones
- **Grant deletion** — remove applications and the grant

### Migration commands

```bash
cd backend
npm run migrate         # prisma migrate deploy   (production/CI)
npm run migrate:dev     # prisma migrate dev      (creates a new migration)
npm run seed            # idempotent demo data
npm run db:reset        # DROPS the database and replays all migrations
```

Migrations live in `backend/prisma/migrations`. The second migration inserts
the three roles, so a freshly migrated database can register users before the
seed has ever run.

---

## Authentication

### Token payload

Access tokens carry every role the user holds:

```json
{
  "id": "6a1f…",
  "email": "lead@grantportal.com",
  "name": "Lead Program Officer",
  "roles": ["ADMIN", "GRANT_MANAGER"],
  "jti": "9c0d…",
  "iat": 1767225600,
  "exp": 1767226500
}
```

- `authenticate` verifies the signature, checks the `jti` against the revoked
  list, then reloads the user **and its roles from the database** — a role
  change or deactivation takes effect on the next request rather than when the
  token expires.
- `authorize('ADMIN', 'GRANT_MANAGER')` passes when the user holds **any** of
  the listed roles, so a multi-role user gets the union of their capabilities.

### Refresh and logout

Refresh tokens are persisted in `refresh_tokens` and rotated on every use: the
presented token is marked revoked and a new pair is issued in the same
transaction, so replaying an old refresh token returns `401`.

Logout revokes the refresh token and adds the access token's `jti` to a Redis
denylist for its remaining lifetime, so the token cannot be used for the rest
of its 15 minutes.

---

## Google OAuth 2.0 setup

1. Open the [Google Cloud console credentials page](https://console.cloud.google.com/apis/credentials).
2. **Create credentials → OAuth client ID → Web application**.
3. Add an **Authorised redirect URI**, exactly matching `OAUTH_REDIRECT_URI`:
   - `http://localhost:5000/api/auth/google/callback`
4. Copy the client id and secret into `.env` as `OAUTH_CLIENT_ID` and
   `OAUTH_CLIENT_SECRET`.
5. Restart the API (`docker compose up -d app`). The startup banner prints
   `🪪 Google OAuth: enabled`.

If the credentials are absent, the routes stay mounted and answer `503` with a
clear message; the rest of the portal is unaffected.

### The flow

1. The SPA's **Sign in with Google** button navigates to
   `GET /api/auth/google`.
2. The API generates a random `state`, stores it in Redis for 10 minutes, and
   redirects to Google's consent screen.
3. Google redirects back to `GET /api/auth/google/callback?code=…&state=…`.
4. The API consumes the `state` (single use — a replay is rejected), exchanges
   the authorization code for Google tokens, and fetches the profile from the
   OpenID Connect userinfo endpoint.
5. The profile is mapped to a local user: by known provider id, then by
   **verified** email (which links Google to an existing password account),
   otherwise a new `APPLICANT` account is created with no password.
6. The API issues its own JWT pair and redirects the browser to
   `${CLIENT_URL}/oauth/callback#accessToken=…&refreshToken=…`.
7. `OAuthCallbackPage` reads the fragment, stores the tokens, loads the user
   and forwards to the dashboard. Fragments are never sent to a server, so the
   tokens stay out of access logs and the `Referer` header.

Failures come back as `#error=<message>` on the same callback route and are
shown to the user.

---

## Roles and permissions

| Capability | Admin | Grant Manager | Applicant |
|------------|:-----:|:-------------:|:---------:|
| Browse grants | all | all | open only |
| Create grants | ✅ | ✅ | ❌ |
| Edit a grant | any | **own only** | ❌ |
| Delete a grant | ✅ | ❌ | ❌ |
| Submit an application | ❌ | ❌ | ✅ |
| List applications | all | **own grants only** | own only |
| `GET /grants/:id/applications` | any grant | **own grants only (403)** | ❌ |
| Review an application | any | **own grants only** | ❌ |
| Withdraw an application | any | own grants | own, while pending |
| Manage users and roles | ✅ | ❌ | ❌ |
| Dashboard statistics | portal-wide | own portfolio | ❌ |

**Grant ownership** is the rule that separates two grant managers. A manager
who did not create a grant receives `403` from
`GET /api/grants/:grantId/applications`, from `PUT /api/grants/:id`, and from
`PATCH /api/applications/:id/review` for that grant's applications.
Administrators are exempt.

A user may hold several roles; the checks above are evaluated per role, so
`lead@grantportal.com` (GRANT_MANAGER + ADMIN) can do everything an admin can.

---

## API reference

All responses share the shape `{ success, message, data }`; list endpoints add
`pagination: { total, page, limit, totalPages }`. Errors add `errors[]` for
validation failures.

### Auth — `/api/auth`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/register` | public | Register; issues tokens, assigns `APPLICANT` |
| POST | `/login` | public | Email + password login |
| POST | `/refresh` | public | Rotate the refresh token |
| POST | `/logout` | public | Revoke the refresh token, denylist the access token |
| GET | `/me` | authenticated | Current user with roles |
| GET | `/google` | public | Start the Google OAuth flow (302) |
| GET | `/google/callback` | public | OAuth callback (302 back to the SPA) |

### Grants — `/api/grants`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | authenticated | List grants; applicants see `OPEN` only |
| GET | `/stats` | admin, manager | Dashboard figures (scoped for managers) |
| GET | `/:id` | authenticated | Grant detail with application count |
| GET | `/:grantId/applications` | **grant owner**, admin | Applications for one grant |
| POST | `/` | admin, manager | Create a grant |
| PUT | `/:id` | **grant owner**, admin | Update a grant (validated) |
| DELETE | `/:id` | admin | Delete a grant and its applications |

Query parameters on `GET /`: `page`, `limit`, `status`, `category`, `search`.

### Applications — `/api/applications`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | authenticated | Scoped to what the caller may see |
| GET | `/:id` | owner, grant owner, admin | Application detail |
| POST | `/` | applicant | Submit an application |
| PATCH | `/:id/review` | **grant owner**, admin | Approve / reject / mark under review |
| DELETE | `/:id` | owner (pending), grant owner, admin | Withdraw |

### Users — `/api/users`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | admin | List users (`role`, `search`, pagination) |
| GET | `/:id` | admin | One user |
| PUT | `/:id/roles` | admin | Replace the role set: `{ "roles": [...] }` or `{ "role": "..." }` |
| PATCH | `/:id/toggle-active` | admin | Activate / deactivate |
| PUT | `/profile` | authenticated | Update own name / avatar |
| PUT | `/password` | authenticated | Change own password |

### Notifications — `/api/notifications`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | authenticated | Own notifications + `unreadCount` |
| PATCH | `/:id/read` | owner | Mark one as read |
| PATCH | `/read-all` | authenticated | Mark all as read |
| DELETE | `/:id` | owner | Delete one |

### Health

`GET /health` → `200 {"status":"ok","database":"up",…}` or `503` when the
database is unreachable. Used by the compose healthcheck.

### Validation

Every mutating route runs an `express-validator` chain before its controller,
including partial updates: `PUT /api/grants/:id` validates the `:id` parameter,
rejects an empty body, and checks each supplied field, so
`{"amount": "lots"}` returns `422` and the grant is left untouched.

---

## Testing

Jest + Supertest, exercising the real Express app against a real PostgreSQL
database. Google is mocked at the `fetch` boundary, so the OAuth routes, state
handling, code exchange and user resolution are all covered by real code.

```bash
cd backend
npm run test:db:up      # starts the postgres + redis containers
npm test                # run the suite
npm run test:coverage   # run with coverage and enforce the thresholds
```

`.env.test` points the suite at a separate `grant_portal_test` database, which
Jest creates if it does not exist, migrates with `prisma migrate deploy` and
truncates between tests. **The API's own database is never touched.** If you
use your own PostgreSQL instead of the compose one, update `DATABASE_URL` in
`backend/.env.test`.

Coverage thresholds are set to 70% on statements, branches, functions and
lines; the suite currently reports:

```
Test Suites: 7 passed, 7 total
Tests:       166 passed, 166 total

Statements   : 93.7%
Branches     : 80.37%
Functions    : 92.95%
Lines        : 95.37%
```

What is covered:

| Suite | Focus |
|-------|-------|
| `auth.test.js` | Registration, login, JWT payload, refresh rotation, logout revocation, `/me`, health, 404s |
| `rbac.test.js` | Role checks, multi-role users, admin role updates, user administration, profile and password |
| `grants.test.js` | Grant CRUD, update validation, ownership, statistics scoping |
| `applications.test.js` | Submission rules, visibility scoping, `GET /grants/:grantId/applications` ownership (403), review, withdrawal |
| `oauth.test.js` | Redirect + state, code exchange, profile fetch, account creation/linking, CSRF and replay rejection, error paths |
| `notifications.test.js` | Notification CRUD, ownership, foreign-key cascades |
| `unit.test.js` | Error mapping, serializers, pagination, JWT helpers, the Redis-compatible store |

Frontend checks:

```bash
cd frontend
npm run build     # tsc -b && vite build
npm run lint      # oxlint
```

---

## Security notes

- **Password hashing** — bcrypt, cost factor 12
- **Access tokens** — 15 minutes, signed HS256, carry a `jti` for revocation
- **Refresh tokens** — persisted, rotated on use, revoked on logout
- **RBAC** — roles re-read from the database on every request
- **Ownership checks** — enforced in the service layer, not just the UI
- **OAuth CSRF** — single-use `state` nonce with a 10-minute TTL
- **Account linking** — only for Google addresses reported as verified
- **Input validation** — `express-validator` on every mutating route
- **Helmet** — secure HTTP headers
- **Rate limiting** — 200 requests / 15 min globally, 30 / 15 min on `/api/auth`
- **CORS** — restricted to `CLIENT_URL`
- **Error handling** — internal messages suppressed in production
- **Secrets** — never committed; `.env` is git-ignored, `.env.example` is not

---

## Project plan

User stories, sprint breakdown and acceptance criteria are in
[PROJECT_PLAN.md](PROJECT_PLAN.md).

---

## 🎥 Demo video

Recorded against the earlier NeDB version of this project; the screens match,
the storage layer behind them does not.

https://drive.google.com/file/d/1X7_TY0mxAsgznbOu7nt-pMj3egBovZXW/view?usp=sharing
