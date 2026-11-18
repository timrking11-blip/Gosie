# Gosie pilot: ordered implementation prompt

**Status:** proposed instructions for later approval, not permission to execute.  
Read the [pilot specification](google-calendar-pilot-spec.md) first. Decision IDs
D01–D15 and acceptance IDs A01–A13 refer to that document.

## Authorization preamble

Before editing product code, record the owner's approved decisions and exact
stage. Stop on an unresolved dependency; do not treat this prompt, its creation,
or its review as permission to connect a provider or publish.

Preserve the existing branded promotional site, separate Week Ahead illustration,
native demo and private-Muse boundary. Build in the operational web pilot and
existing same-origin API/Postgres architecture, not a new disconnected app.
No authentication-provider replacement. No automatic event writes, booking,
invitations, background calendar reads, live research activation or training.

Reinspect the worktree and related tasks at each stage; collaborators may have
changed code since this specification. Preserve unrelated changes. Record
reviewed, implemented, tested and deployed revisions independently.

## Stage 0 — approve contracts and test boundaries

**Depends on:** owner review of the specification; no implementation beforehand.

Resolve D01 and the choices required for the next stage. Inventory current
owned-profile APIs, versioned imports, feedback, reviewed catalog, public feeds
and privacy gates. Create a requirements-to-evidence checklist; do not relabel
historical results as fresh passes.

Decide interpretation approach, account/profile calendar mapping, actual scopes,
token-key custody, data lifetimes, conflict semantics and initial reviewed region.
Document the Google testing/production route and seven-day refresh limitation.
Choose controlled future test identities without connecting them.

**Exit:** owner approves exact stage scopes; every unresolved decision has an
owner and blocks only its dependent work. B3/B4/release approvals remain distinct.

## Stage 1 — define private contracts and deterministic behavior

**Depends on:** approved D04/D08/D09/D11 and relevant data-handling choices.

Implement typed, versioned private contracts for request interpretation,
calendar selection/projection, explicit-memory proposals, temporary feedback
and evidence-bearing discovery eligibility. Keep external adapters replaceable.
Any schema change uses the existing explicit migration process, never startup DDL.

Use approved synthetic fixtures only. Separate a request's temporary overrides
from stored profile config. Validate unknowns, timezones, currency, duration,
leisure/protected windows and hard constraints before ranking. Preserve latest
ratings, owned-plan behavior and safe import-as-new-profile semantics.

**Exit:** A01–A03 and deterministic portions of A05–A08 pass against the approved
fixtures; no external provider or real data is required or implied.

## Stage 2 — implement Google authorization behind a closed gate

**Depends on:** approved D02/D03/D06, stage 1 contracts, and explicit connector
implementation approval. Live account access is not yet authorized.

Implement per-user account linking with one-time state, session/browser/profile
binding, approved PKCE handling and exact redirect validation. Address the
existing Strict-cookie OAuth return without weakening all application sessions:
stage callback results, then require same-origin authenticated confirmation.

Implement actual-scope verification, incremental detail consent, calendar privacy
modes, encrypted server-side token custody/refresh, account switching, disconnect
and generation-based protection against late callbacks/refreshes. Exclude secrets
and calendar text from logs, browser storage, analytics and portability flows.

**Exit:** A04/A06/A08 pass with provider stubs, including denied scopes,
revoked/expired tokens, replay, changed session/profile, selection downgrade,
disconnect/account deletion and in-flight races. Stubs are not Google evidence.

## Stage 3 — implement read-only calendar-aware planning

**Depends on:** stages 1–2, approved data/freshness/semantic policies.

Add bounded on-demand calendar reads using selection-specific endpoints, minimum
fields, complete pagination and atomic snapshot replacement. No scheduled worker,
push subscription or calendar-write permission. Enforce actual and selected
permissions server-side; excluded calendars are never fetched for event data.

Project selected Calendar intervals beside owned Gosie plans, never as fictional
demo events or implicitly copied user entries. Implement recurring instance
identity, source provenance, cancelled/moved/deleted behavior, IANA timezone/DST
and exclusive all-day bounds, transparent/private events, uncertain invitations
and safe deduplication. Add duration input/uncertainty for existing manual plans.

Intersect conflicts and buffers with chosen leisure windows. Display last-checked,
stale/partial/unavailable/reconnect states; an API error never means “free.”
Do not confirm physical feasibility when travel/location/duration is unknown.

**Exit:** A05–A08 pass with bounded fixtures; accurate manual fallback exists.
No calendar connection is used without a separate live-test authorization.

## Stage 4 — deliver Ask Gosie with reviewed discoveries and memory

**Depends on:** stages 1 and 3; approved D05/D08/D10/D11; an approved initial
catalog. An external processor needs explicit activation approval first.

Implement request → editable interpretation → approved-catalog retrieval →
eligibility → soft ranking → evidence-based explanations. Handle unsupported
language by clarification, not invented matches. Preserve unknown numeric facts
and keep possible/unconfirmed ideas outside confirmed-fit results.

Implement clear, reversible search-only/weekend-only/durable feedback and exact
user-confirmed memory diffs. Provide inspect/edit/forget/undo; reject stale writes.
Never turn calendar category or attendance into a permanent interest implicitly.
Keep source identity stable across catalog updates and dated occurrences.

Adapt approved records for ranking without silently reusing fictional estimates.
Keep Communities pending privacy and source-review status distinct. Public
research remains disabled; manual reviewed catalog work must not put personal
requests, calendars or participant information into repository artifacts.

**Exit:** A01–A08 integration/component coverage passes. An empty or uncertain
catalog produces honest outcomes. Any proposed snapshot export needs D13;
explain its lack of synchronization and confirm the exact dated plan.

## Stage 5 — obtain bounded provider and browser evidence

**Depends on:** feature stages complete; separate real-provider test approval
and D12. Do not read participants' real calendars as a substitute for test data.

Use two controlled Google/Gosie test identities for a bounded read-only trial.
Record actual scopes, OAuth audience/status and any testing expiry limitation.
Check consent selection, real recurring changes, revocation/reconnect and data
deletion; clean up synthetic records/credentials and record limits honestly.

Run one coherent signed-in browser pass for the completed journey and responsive,
keyboard/text-scale/reduced-motion checks. Verify 360/768/1280 separately.
Reuse focused fixture/API checks during implementation rather than repeated
full browser runs. Native/mobile parity is a separate work item.

Run appropriate existing web/API tests, typechecks and builds only when the
implementation is ready. Use artifact manifest environment values:
web `PORT=23967 BASE_PATH=/`; Week Ahead only if materially changed,
`PORT=26028 BASE_PATH=/gosie-week-ahead/`. Confirm the current scripts first.
Follow existing explicit test-database opt-in/cleanup guards; do not run legacy
SQLite commands or mutate production. Keep generated build/media outputs out
of commits. Existing task owners retain their separate testing scopes.

**Exit:** A09–A11 have dated evidence and known limitations. Failed/blocked checks
remain failures/blockers. Passing builds or phone demos do not prove this journey.

## Stage 6 — authorize hosting and the five-person pilot separately

**Depends on:** owner-approved D07/D12/D14/D15; feature acceptance; existing
hosted durability/recovery and privacy release tracks.

Do not publish automatically. After separate owner approval, use the existing
hosting-verification work to prove HTTPS/Secure cookies, exact deployed revision,
same-origin API, two-account isolation, real redeploy durability, archive privacy
and recovery limitations. Do not create a custom backup/dump mechanism.

Approve Google production/testing status, privacy/terms, participant notice,
identity/recovery support, pilot dates, deletion responsibility and minimal
study measures before invitations. Use the existing five-person-pilot task
for the actual study, return visit, findings and end-of-pilot deletion.

**Exit:** A12–A13 evidence and explicit owner release sign-off. No pilot-readiness
claim until then; proprietary value remains a tested hypothesis, not a promise.

## Start from these verified source locations

- `artifacts/api-server/server.js`
- `artifacts/api-server/security.js`
- `artifacts/api-server/schema.sql`
- `artifacts/api-server/weekend-engine.js`
- `artifacts/api-server/research-catalog.js`
- `artifacts/api-server/hardening.test.js`
- `artifacts/gosie/src/routes/app.tsx`
- `lib/community/CommunityPanel.tsx`
- `research/gosie/config.json`
- `research/gosie/approved.json`
- `research/gosie/README.md`

## Required delivery report for each approved build stage

State what changed, what did not, approvals used and still open, migration/data
effects, exact worktree/revision, automated results, live interactions,
screenshots, provider evidence, deployment evidence and anything unverified.
Do not claim later stages or launch complete because an earlier stage passed.
