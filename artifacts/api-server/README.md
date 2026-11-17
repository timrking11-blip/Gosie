# Gosie private planning-pilot API

Node 24 + PostgreSQL (`pg`). This is the repository's operational API, not the
separate private Muse application and not proof of Muse feature parity.
Recommendations are deterministic rankings of 16 **fictional** records. There are
no calendar, live-listing, travel, or other external connectors.

## Development

The owner selected Replit Postgres and the existing email/password approach.
The managed workspace `DATABASE_URL` points to development. Never print it or
copy a production connection string into the workspace.

Apply the schema explicitly to development (never during build/startup):

```sh
GOSIE_DB_ENV=development node artifacts/api-server/apply-schema.js
```

The managed `artifacts/gosie: web` workflow starts Vite and this API, with
same-origin `/api` forwarding. Registration is **closed by default**, including
the shared preview. `PILOT_SIGNUPS_ENABLED=1` is reserved for isolated tests;
do not enable it publicly without release approval. Production additionally
requires `PILOT_INVITED_EMAIL_HASHES` (up to five SHA-256 hashes of normalized
invited email addresses) and enforces a transaction-serialized five-account cap.
Configure that allowlist only after privately confirming participant identities.
An email allowlist is not automated email verification or password recovery.

## Verification

```sh
# Explicit opt-in; creates unique example.invalid test users and removes them.
GOSIE_DB_ENV=test pnpm --filter @workspace/api-server test

# After the web production build; no database connection is made.
node --test artifacts/api-server/production-server.test.js
```

The API suite tests security headers, origin/CSRF checks, password/session flow,
two-account ownership, profile validation, owned week CRUD/carry-forward,
fictional-data labeling, hard constraints, latest feedback, import/export
reference remapping, account deletion, and API-process restart persistence.
It is focused coverage for this pilot, **not** the historical B3 parity suite.
CI provisions disposable Postgres instead of the former SQLite file.

## Hosting preparation, not publication

The Gosie manifest builds the web bundle and runs `production-server.js` to serve
the frontend and `/api` on the same origin. The entrypoint enforces production
mode and secure cookies. `SESSION_SECRET` must exist; `DATABASE_URL` is supplied
by Replit. It serves only the built public directory, not repository archives.
Production schema application belongs to Replit's Publish flow. No startup DDL
or production-migration command exists.

Useful non-secret settings: `PORT`, `API_PORT` (development), `AUTH_RATE_LIMIT`,
`PG_POOL_SIZE`, `COOKIE_SECURE=1`, and exact `ALLOWED_ORIGINS`. Only set
`TRUST_PROXY=1` after confirming the proxy's forwarded-address handling.

Passwords use salted scrypt. Sessions are opaque cookies with hashed database
identifiers, one-day expiry, HttpOnly/SameSite=Strict, and per-session CSRF tokens.
Request logs contain method/path/status/duration, not bodies or credentials.
Profile export and deletion require the owning session. Imports create new
owned records and never link carry-over IDs to existing users' records.

## Release gates still open

- Owner-approved invitation identities, allowlist configuration, and recovery
  policy. The closed-by-default enrollment guard is not automated identity proof.
- Owner-approved pilot notice/end date and deletion procedure, including provider
  recovery/backup retention limitations. Account deletion is not a promise of
  immediate erasure from provider recovery history.
- HTTPS cookie/login validation on the chosen published revision.
- Real redeploy durability and provider-supported recovery verification.
- Five invited users, a full planning cycle/return visit, and a findings report.

Do not collect real participant data, enable public registration, publish, invite
users, or claim pilot readiness until those checks and approvals are complete.

## Communities (development implementation)

Communities is a separate, moderated contributor source. The 16 existing
Weekend Ahead records and the standalone clients' illustrative schedules remain
fictional. There is still no external live-source ingestion or calendar connector.

- `GET /api/community/items` is public and returns approved, unexpired events
  and approved evergreen gems, with approved owner comments only.
  `?includeExpired=true` includes explicitly labeled approved past events.
- `GET /api/community/mine` returns only the signed-in user's submissions,
  notes and permissions. Pending and rejected records are private to that user
  and authorized moderators.
- `POST /api/community/items` requires a contributor or restaurant-owner grant;
  `POST /api/community/items/:id/comments` requires a restaurant-owner grant and
  a currently approved event. All submissions start pending.
- Moderator queue/decisions use `/api/community/moderation` and
  `/api/community/moderation/items|comments/:id`. Writes require session CSRF.
  Moderators cannot approve their own submissions; decisions are terminal.

No account receives a contributor, owner, or moderator role at signup. The
operator must approve the account and assign rows in `gosie_community_roles`
through their controlled database administration process. There is deliberately
no HTTP role-management/self-grant endpoint, no automatic business verification,
and no preconfigured privileged account. Restaurant comment attribution comes
from the designated restaurant name, not the submitted request.
**No real role assignments or invitations have been authorized by this build.**

Timed events require a start and end with a timezone, ordered correctly and ending
in the future. Clients show overlapping events on their actual dates in the
selected week. Evergreen gems have no dates and stay outside scheduled plans.
Dates are displayed in the viewer's local timezone. Credits/source/freshness and
Why explanations distinguish contributor claims from verified availability.
Account deletion cascades through contributed items, comments and grants.
Profile exports remain profile-only, not a community contribution export.

Web and Week Ahead use the same shared panel in `lib/community`; development
Vite/Metro proxies forward `/api` to the existing local API. Native production
builds require the approved HTTPS API base (including `/api`) in
`EXPO_PUBLIC_GOSIE_API_URL`; this is a public routing setting, never a credential.
Native development may use the development domain. Static mobile/Week Ahead
hosting must route same-origin `/api` to Gosie's API; separate-origin browser
cookie/CORS hosting is not configured by this task. No publish/runtime
configuration or production database changes are performed here.

The API regression suite now also checks role gates, pending/rejected privacy,
approval transitions, owner attribution, event expiry and account cascades.
Shared browser component tests exercise contributor and moderator flows and
evergreen/date presentation. Physical-device cookie behavior and published
multi-artifact routing still require the separate release/device checks.
