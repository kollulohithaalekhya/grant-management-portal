# Project Plan — Secure Grant Management Portal

This plan covers the work that took the portal from an embedded NeDB prototype
to a PostgreSQL-backed, containerised application with OAuth 2.0 and an
automated test suite.

- **Team size assumed:** 2 engineers
- **Sprint length:** 1 week
- **Definition of done (all stories):** code merged to `main`; automated tests
  covering the behaviour pass; `npm run test:coverage` stays above the 70%
  threshold on every metric; `docker compose up -d --build` brings all four
  services to `healthy`; the README describes what actually exists.

---

## 1. Product context

Grant-making organisations need to publish funding opportunities, collect
applications, and route each application to the right reviewer. Three groups
use the portal:

| Persona | Goal |
|---------|------|
| **Administrator** | Operate the portal: manage accounts, roles and every grant |
| **Grant Manager** | Publish grants and decide on applications *to their own grants* |
| **Applicant** | Find open funding, apply, and track the decision |

A person can be more than one of these at once — a programme lead is commonly
both a grant manager and an administrator — so roles are modelled as a set, not
a single field.

---

## 2. User stories

### US-1 — Durable, relational storage

> **As an** administrator
> **I want** portal data kept in PostgreSQL with real relationships
> **So that** records cannot drift out of sync and the data survives restarts,
> redeploys and running more than one API instance.

**Acceptance criteria**

- [x] No NeDB dependency, module or data file remains in the repository.
- [x] Tables exist for `users`, `roles`, `user_roles`, `grants`,
      `applications`, `notifications` and `refresh_tokens`.
- [x] `user_roles` is a true many-to-many join with a composite primary key.
- [x] Every relationship has a foreign key with explicit delete behaviour:
      cascade for owned rows, `SET NULL` for reviewer history, `RESTRICT`
      where deleting the parent would orphan grants.
- [x] One application per applicant per grant is enforced by a database
      unique constraint, not only by application code.
- [x] Schema changes ship as versioned migrations; `prisma migrate deploy`
      brings an empty database to the current schema.
- [x] Multi-write operations (registration, refresh rotation, application
      submit and review, role replacement, grant deletion) run in a
      transaction and leave no partial state when a step fails.

---

### US-2 — One account, several roles

> **As a** programme lead who is both a grant manager and an administrator
> **I want** my account to carry every role I hold
> **So that** I can work without a second login, and so that revoking one role
> does not cost me the others.

**Acceptance criteria**

- [x] The JWT payload is `{ id, roles: ["ADMIN", "GRANT_MANAGER"], … }`.
- [x] Authorisation passes when the user holds **any** accepted role.
- [x] Roles are re-read from the database on every request, so a change takes
      effect on the next call rather than when the token expires.
- [x] An administrator can replace a user's role set through
      `PUT /api/users/:id/roles`, and the API rejects an empty set or an
      unknown role name.
- [x] An administrator cannot remove their own `ADMIN` role or deactivate
      their own account — the portal cannot be locked out.
- [x] The UI shows every role a user holds and edits them as a set.

---

### US-3 — Sign in with Google

> **As an** applicant
> **I want** to sign in with my Google account
> **So that** I do not have to create and remember another password.

**Acceptance criteria**

- [x] `GET /api/auth/google` redirects to Google's consent screen with the
      configured client id, redirect URI, scope and a random `state`.
- [x] `GET /api/auth/google/callback` validates `state`, exchanges the
      authorization code for Google tokens, and fetches the profile.
- [x] `state` is stored server-side with a TTL and is single use; a forged or
      replayed value is rejected.
- [x] A first-time Google user gets a local `APPLICANT` account with no
      password; a returning one is matched by provider id.
- [x] A Google identity links to an existing password account only when Google
      reports the address as verified — an unverified address cannot take over
      an account.
- [x] The portal issues its own JWT pair; Google tokens are never stored.
- [x] The SPA offers a "Sign in with Google" button and a `/oauth/callback`
      route that completes the sign-in and reports failures.
- [x] With no credentials configured the routes answer `503` and the rest of
      the portal is unaffected.

---

### US-4 — A grant manager only sees their own grants' applications

> **As a** grant manager
> **I want** applications to my grants to be visible only to me
> **So that** commercially sensitive submissions are not exposed to every other
> manager in the organisation.

**Acceptance criteria**

- [x] `GET /api/grants/:grantId/applications` returns the applications when the
      caller created the grant, and `403` — with no data in the body — when
      they did not.
- [x] Administrators may read applications for any grant.
- [x] An applicant calling the endpoint receives `403`; an unauthenticated
      caller receives `401`.
- [x] The same ownership rule applies to reviewing an application and to
      editing a grant, so the restriction cannot be side-stepped.
- [x] `GET /api/applications` is scoped: admins see everything, managers see
      their own grants' applications, applicants see their own submissions.
- [x] The rule is enforced in the service layer and covered by tests that
      assert both the status code and that no record was modified.

---

### US-5 — Reliable, one-command environments

> **As a** developer or reviewer
> **I want** the whole stack to start with one command
> **So that** I can run, demo and test the portal without hand-installing
> PostgreSQL, Redis and Node.

**Acceptance criteria**

- [x] `docker compose up -d --build` starts `postgres`, `redis`, `app` and
      `web`.
- [x] Every service declares a healthcheck; `app` waits for `postgres` and
      `redis` to be healthy, `web` waits for `app`.
- [x] Database migrations are applied automatically before the API serves
      traffic.
- [x] Data survives `docker compose down` in named volumes.
- [x] Configuration comes from environment variables documented in
      `.env.example`; no secret is committed.
- [x] The API refuses to start when a JWT secret is missing.

---

### US-6 — Trustworthy changes

> **As a** maintainer
> **I want** the portal's rules covered by automated tests
> **So that** a regression in access control is caught before release rather
> than in production.

**Acceptance criteria**

- [x] `npm test` and `npm run test:coverage` run a Jest + Supertest suite
      against a real PostgreSQL database.
- [x] Integration coverage for registration, login, refresh, RBAC, admin role
      updates, grant CRUD, applications and OAuth (Google mocked).
- [x] Coverage is at least 70% on statements, branches, functions and lines,
      enforced by a threshold that fails the run.
- [x] The suite uses its own database and never touches development data.
- [x] Every mutating route has a test proving validation runs before the
      controller.

---

## 3. Sprint breakdown

### Sprint 1 — Relational foundation (US-1)

| # | Task | Outcome |
|---|------|---------|
| 1.1 | Model the domain in Prisma | `schema.prisma` with seven tables, FKs, indexes |
| 1.2 | Generate the initial migration | `migrations/…_init` |
| 1.3 | Seed the role catalogue as a migration | Fresh databases can register users immediately |
| 1.4 | Introduce a service layer | Controllers become thin; queries live in one place |
| 1.5 | Port every controller off NeDB | NeDB removed from `package.json` and `src/` |
| 1.6 | Wrap multi-write flows in transactions | No partial registrations or reviews |
| 1.7 | Rewrite the seed script | Idempotent; includes a dual-role account |

**Sprint review:** every endpoint answers from PostgreSQL; `grep -ri nedb`
returns nothing.

---

### Sprint 2 — Identity: roles, JWT, OAuth (US-2, US-3)

| # | Task | Outcome |
|---|------|---------|
| 2.1 | Move roles into `user_roles` | Users can hold several roles |
| 2.2 | Put `roles[]` in the JWT | `{ id, roles: [...] }` |
| 2.3 | Rewrite `authenticate` / `authorize` | Any-role matching; roles reloaded per request |
| 2.4 | `jti` + denylist | Logout invalidates a live access token |
| 2.5 | Persist and rotate refresh tokens | Replay returns 401 |
| 2.6 | Google authorization-code flow | Redirect, callback, exchange, profile, local user |
| 2.7 | `state` nonce in Redis | CSRF and replay protection |
| 2.8 | Frontend: Google button + callback route | Tokens arrive in the URL fragment |
| 2.9 | Admin role editor | Roles edited as a set |

**Sprint review:** `lead@grantportal.com` performs both manager and admin
actions from one session; a Google sign-in produces a working portal session.

---

### Sprint 3 — Access control and validation (US-4)

| # | Task | Outcome |
|---|------|---------|
| 3.1 | `GET /grants/:grantId/applications` | New ownership-checked endpoint |
| 3.2 | `assertCanReviewGrant` | Shared gate for reads and reviews |
| 3.3 | Scope the application list per role | Admin / manager / applicant views |
| 3.4 | Ownership on grant update | Managers edit only their own grants |
| 3.5 | Real validation chains | Every mutating route, including partial updates |
| 3.6 | Frontend uses the scoped endpoint | 403 surfaced as a clear message |

**Sprint review:** a manager receives `403` on another manager's grant from
every route that touches it.

---

### Sprint 4 — Delivery and confidence (US-5, US-6)

| # | Task | Outcome |
|---|------|---------|
| 4.1 | Backend Dockerfile + entrypoint | Migrations run before boot |
| 4.2 | Frontend Dockerfile + nginx | SPA fallback and `/api` proxy |
| 4.3 | `docker-compose.yml` | Four services, healthchecks, volumes, ordering |
| 4.4 | `/health` probes the database | Compose reports the API unhealthy when the DB is down |
| 4.5 | Split `app.js` from `server.js` | Supertest can mount the app |
| 4.6 | Test harness | Own database, auto-created, migrated, truncated |
| 4.7 | Integration suites | Auth, RBAC, grants, applications, notifications |
| 4.8 | OAuth suite with `fetch` mocked | Real routes, fake Google |
| 4.9 | Unit suite | Error mapping, serializers, pagination, token store |
| 4.10 | Coverage thresholds | Build fails below 70% |
| 4.11 | Rewrite README, write this plan | Documentation matches the implementation |

**Sprint review:** a clean checkout reaches a working portal with
`cp .env.example .env && docker compose up -d --build`, and
`npm run test:coverage` passes.

---

## 4. Delivered state

| Metric | Target | Actual |
|--------|--------|--------|
| Test suites | — | 7 |
| Tests | — | 166 passing |
| Statement coverage | ≥ 70% | 93.7% |
| Branch coverage | ≥ 70% | 80.37% |
| Function coverage | ≥ 70% | 92.95% |
| Line coverage | ≥ 70% | 95.37% |
| Compose services healthy | 4 | 4 |
| NeDB in code, dependencies or lockfile | 0 | 0 |

---

## 5. Known limitations and next steps

Deliberately out of scope for this plan; each is a candidate for a follow-up
sprint.

1. **File uploads.** `applications.documents` is a `text[]` column that is
   modelled and returned but has no upload endpoint behind it yet.
2. **Email delivery.** Notifications are in-app only; no SMTP integration.
3. **Additional OAuth providers.** `providerId` is provider-agnostic, but only
   Google is implemented.
4. **Frontend tests.** The SPA is type-checked, linted and built in CI, but has
   no component or end-to-end test suite.
5. **Distributed rate limiting.** `express-rate-limit` keeps counters in
   process memory; a Redis store is needed before running several API replicas
   behind a load balancer.
6. **Audit log.** Role changes and review decisions are not recorded in a
   dedicated append-only table.
