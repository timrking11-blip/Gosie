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
requires `PILOT_INVITED_EMAIL_HASHES` (up to six SHA-256 hashes of normalized
invited email addresses) and enforces a transaction-serialized six-account cap:
five invited participants plus one owner account. The owner's address must also
be explicitly invited; this place grants no moderator or operator permissions.
No address is allowlisted automatically, and registration remains closed.
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
reference remapping, account deletion, and API-process restart persistence. The
dedicated restart test creates a uniquely named temporary PostgreSQL schema in
the disposable test database, runs the API against it before and after restart,
and drops the schema during cleanup. PostgreSQL does not use SQLite database,
WAL, or SHM files.
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
- Five invited participants plus one owner account, a full planning cycle/return visit, and a findings report.

Do not collect real participant data, enable public registration, publish, invite
users, or claim pilot readiness until those checks and approvals are complete.

## Reviewed public research (disabled-by-default runner)

### Manually reviewed Week Ahead leads

`GET /api/week-ahead/discoveries` returns only approved source-backed entries,
with no moderator identity, draft, withdrawn record, or private history.
This is a separate data model from the repository research catalog below,
community submissions, transient search results, and fictional ranked samples.

The Week Ahead Weekend page provides **Moderator tools**. Existing authenticated
accounts with an explicitly granted `moderator` role in `gosie_community_roles`
can create and edit private drafts, independently approve another moderator's
draft, and withdraw entries. Organization/contributor grants and the distinct
community access-operator permission do not imply this role. This task grants no
roles and opens no registration.

Private routes are `GET/POST /api/week-ahead/discoveries/review`,
`PUT .../review/:id`, and `POST .../review/:id/approve|withdraw`. Writes use
session CSRF plus a server-checked version to reject stale decisions. Edits hide
previously approved content until another moderator approves the new draft.
Withdrawals are terminal for that record. Sources, retrieval timestamps and
verified/estimated/unknown facts are required. Review snapshots are private;
public reads project only the approved fact fields.

Apply `schema.sql` to development explicitly through `apply-schema.js` (also
called by post-merge setup). There is no startup/build-time production DDL.
The Publish flow, if later authorized, handles the managed production schema.
No entries are seeded and no live provider is enabled.

`GET /api/discoveries` requires an authenticated session and reads only the
validated repository-approved catalog, without startup writes. The initial
catalog is empty. This is distinct from community submissions and fictional
ranked recommendations. Unknown price/travel/availability values remain null
and are never fed into numeric preference constraints.

See `research/gosie/README.md` at the repository root for configuration, explicit
activation gates, bounded execution, review/promotion and limitations. No source
or provider has been enabled, and no live or scheduled research has run.

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

Communities is **for people, not an advertising directory**. Invited venues,
municipalities and nonprofits may contribute useful events, local gems and
practical notes alongside people and restaurants. They receive no automatic
publication, recommendation priority or verified-identity badge. Moderators
should reject advertising-only, irrelevant or misleading submissions.

No account receives a contributor, organization, owner, moderator, or operator
permission at signup. Contributor and moderator grants remain controlled database
administration only. Explicitly appointed operators can now review organization
access through the private Communities panel and API below. There is no public
self-enrollment, automatic business verification, or preconfigured privileged
account. Organization attribution comes from the designated public identity,
not the submitted request.
**No real role assignments or invitations have been authorized by this build.**

The expanded operator-assigned organization roles are `venue`, `municipality`
and `nonprofit`. Each requires an `organization_name` of 1–80 characters; the
legacy `restaurant-owner` role retains `restaurant_name`. Organization submission
and note attribution is taken from the grant, not the request. Both submissions
and event notes start pending. Even a representative with a separate moderator
grant cannot review their own content. Operators should designate one organization
identity per account; if legacy multiple organization grants exist, the first role
in alphabetical order supplies the identity until the operator revokes the extra
grants. The reviewed workflow refuses a new grant while any organization grant
exists. There is no self-service role endpoint.
The schema expansion is explicitly applied to development/test only; no production
schema update, real organization grants or public enrollment was performed.

### Reviewed organization access (operator-only)

Apply `schema.sql` explicitly to development/test before using the updated API.
No startup DDL or production migration is performed. The separate
`gosie_community_operators` table starts empty. A trusted database administrator
must separately authorize an existing account by placing its ID in that table;
no application endpoint, moderator permission, signup field or import can do so.
This implementation does not appoint any real operator or organization.

- `GET /api/community/mine` exposes only the current account's `isOperator`
  capability flag. It does not list other accounts or operator identities.
- `GET /api/community/organization-access` returns current organization grants
  (first 500; `truncated` is explicit) and the last 100 access decisions. Both
  account IDs and review reasons are private to explicitly authorized operators.
- `POST /api/community/organization-access` requires `userId` of an existing
  account, `organizationType` (`venue`, `municipality`, `nonprofit`, or legacy
  `restaurant-owner`), `publicIdentity` (1–80 characters), and `reason`
  (10–1000 characters). The UI requires explicit review confirmation. Existing
  grants must be revoked before replacing an identity or changing its type.
- `POST /api/community/organization-access/revoke` requires `userId`,
  `organizationType`, current `accessVersion`, and a review `reason`. A stale
  version returns 409, including if access was revoked and granted again.
  Refresh and review the current grant rather than blindly retrying.
- Both writes require the session's CSRF token. Explicit operator authorization
  is rechecked in the transaction; concurrent grants are serialized per account.
  Grant/revoke and their private review record commit or roll back together.
  Operators cannot manage their own organization access or grant moderator or
  operator privileges through these routes.

Revocation stops that organization's submissions and event notes on subsequent
requests. It does not delete or approve content, remove independent contributor
or moderator permissions, rewrite historical attribution, or expose pending
content to operators without a separate moderator grant. Pending/rejected
content remains visible only to its author and moderators. Content moderation
still refuses an author's own review.

Legacy grants are labeled as lacking a reviewed grant decision; they are not
automatically verified or assigned fabricated review metadata. Review records
remain while the target account exists, including after revocation. Deleting
that account cascades its access records; deleting the reviewing operator
nulls the reviewer reference on other accounts' records. Do not put credentials,
private identity documents, or sensitive personal information in review reasons.
Pilot-end deletion and provider-recovery retention remain subject to the
existing pilot policy, not a promise of immediate backup erasure.

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
