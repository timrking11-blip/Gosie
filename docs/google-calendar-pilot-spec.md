# Gosie: calendar-aware pilot specification

**Prepared:** 18 November 2026  
**Status:** approval-ready proposal; not build authorization or launch readiness  
**Companion:** [Ordered implementation prompt](google-calendar-pilot-implementation-prompt.md)

## 1. Purpose, authority and limits

Deliver one useful private planning experience: **Ask Gosie understands an
explicit request, accounts for existing commitments, retrieves approved local
discoveries, explains uncertainty, and remembers only confirmed preferences.**
Google Calendar must support existing leisure, sports, book-club and other
commitments; a calendar export button alone does not meet the requirement.

There are two separate systems:

1. **Private planning:** account/profile-scoped requests, permitted calendar
   context, explicit memory, owned plans and feedback.
2. **Public research:** bounded public leads, source evidence and human review
   before promotion into the approved catalog. No private planning inputs.

The promotional website and standalone Week Ahead illustration remain
illustrations. The private Muse template is a design/functional reference,
not a verified implementation or transferable integration.

### Authority register

| Status | Decision |
| --- | --- |
| Confirmed | Private web-first pilot; five invited participants with their own data, after release/privacy approval |
| Confirmed | Replit hosting and Postgres; retain hardened email/password login |
| Confirmed | Delete pilot data after the pilot; recovery-history erasure is not promised |
| Confirmed | Google Calendar is the first calendar provider to specify |
| Confirmed | Calendar awareness of existing leisure commitments is required; export alone is insufficient |
| Proposed, not approved | On-demand, read-only Calendar; selectable privacy modes; 14-day lookahead; optional snapshot export |
| Proposed, not approved | Guided conversational interpretation and explicit preference memory, using the contracts below |
| Open | Dates, exact retention, processors, OAuth production/testing arrangement, source rights, costs and regional catalog |
| Not authorized here | OAuth setup, account connection, any calendar read/write, product changes, provider activation, invitations, public registration or publication |

The owner approves the specification and later implementation stages separately.
Accepting this document does not approve every proposed default, historical B3/B4
scope, a migration, or a launch. Prior dated baseline reports remain historical.

## 2. Current source versus proposed capability

### Inspection boundary

At the initial read, local HEAD was
`1368f7e192911e5a16f4661f42dd4c87ce475bd2`, branch
`reconcile/local-main`; `git status --porcelain=v1 -b` showed no file paths.
Its ahead count describes the local tracking reference, not freshly verified
GitHub history. No fetch, deployment lookup or live app check was performed.
Writing these documents produces a documentation patch on that baseline.
There is **no new tested product SHA or deployed revision** from this task.

Source inspection below is not a runtime or security certification.

| Capability | Current inspected evidence | Required increment |
| --- | --- | --- |
| Accounts, consent, ownership | `server.js`: registration guards, `ownProfile()`, login/session/account deletion; `security.js`: scrypt, hashed sessions, CSRF | Preserve; verify hosted identity/recovery and two-account isolation before launch |
| Profiles/preferences | `configError()`, `normalizeConfig()`, profile routes; web preferences in `src/routes/app.tsx` | Explicit-memory provenance, confirmation, revision control and deletion; no silent schema reinterpretation |
| Owned Week Ahead | Week routes, `groupWeek()`, `gosie_week_items`; API explicitly says no calendar connection | Separate calendar projection with real intervals and source IDs; never squeeze recurrence into date/time labels |
| Weekend recommendations | `weekend-engine.js`: 16 fixed fictional records and deterministic `rankWeekend()` | Approved-record adapter and eligibility contract; never pass unknown facts through fictional numeric logic |
| Feedback | `/feedback`, unique per user/profile/item/action; latest rating upsert | Temporary feedback and reason semantics, stable real-discovery IDs, explicit scope/expiry |
| Reviewed public discoveries | `research-catalog.js`: validated `readApprovedCatalog()`, lifecycle flags and source evidence | Approved catalog is empty; price/travel/hours/availability are null and constraints are not evaluated |
| Proactive research | `research/gosie/config.json`: disabled, no region/provider, zero approved search budget | Keep disabled for initial manually reviewed catalog; later activation needs separate source/privacy/cost approval |
| Communities | Shared `CommunityPanel`; approved-only public feed, pending privacy; operator review and revocation API | Reuse moderation boundaries; community approval is not source verification or guaranteed availability |
| Conversation/learning | No Calendar/OAuth/conversation/memory adapter in inspected API routes/schema | New private request interpretation and explicit-memory workflow; no learned-personalization claim |
| JSON portability | Profile-only export/import, import-as-new-profile and remapped owned references | Version extensions; no tokens/connections/raw calendar records in import; review imported memory |
| Native mobile | Weekend screen has fictional, session-local feedback/limits; Communities can call the API | Do not claim calendar-aware native parity; phone-demo testing does not establish this future journey |

`docs/planning-pilot-status.md` and `docs/communities-status.md` record earlier
checks, not today's fresh totals. The task queue reports the real-phone task
merged, with VoiceOver/TalkBack and offline recovery suggestions still open.
That status is reported task evidence, not independently repeated device testing.

## 3. Required end-to-end experience

1. **Enter safely.** An invited person signs in to their existing Gosie account,
   selects an owned profile and sees what is real versus illustrative.
2. **Connect intentionally.** Explain why Calendar helps, actual Google scopes,
   storage and disconnect behavior. Start per-user authorization only after a
   later approved build and explicit user action.
3. **Choose calendars.** Every accessible calendar starts excluded. The person
   selects availability-only or details individually and chooses whether the
   active profile may use them. No automatic inheritance by another profile.
4. **Set planning intent.** Ask for desired leisure windows, timezone, approximate
   area, travel mode/budget and protected free time. An empty slot is not a request
   for another activity; no location tracking or exact address is required.
5. **Ask naturally, confirm structure.** For “Saturday after six, unusual, under
   $40, within 25 minutes,” show editable interpreted dates, currency, duration
   needs, location reference, transport, context and constraints. Ask about
   ambiguity; do not silently pick the wrong Saturday or timezone.
6. **Account for commitments.** Show permitted existing events or private busy
   blocks, classification suggestions and buffers. “Book club” is a correctable
   category suggestion, not proof of attendance or enjoyment.
7. **Present a short, honest list.** Proposed default: three approved discoveries.
   Each shows source/review date, candidate time, facts, estimates, unknowns and
   why it fits. Separate eligible, possible-but-unconfirmed and excluded ideas.
   Never call uncertain price/travel/duration a verified fit.
8. **Respect the response.** Offer keep free, save idea, dismiss for this request,
   not this weekend, persistent dismissal, or explicit rating. Explain persistence
   before writing. A saved idea is not a booking or calendar event.
9. **Remember with confirmation.** “More small galleries, fewer crowds” creates a
   proposed change, including scope and exact fields. Only confirmation writes
   it. Provide Just this search, Remember, Cancel, inspect/edit/forget and undo.
10. **Return and disconnect.** A return visit loads only confirmed memory and
    durable feedback, then refreshes Calendar on demand. Expired temporary
    feedback does not apply. Disconnect stops access and removes calendar-derived
    data as described below; ordinary planning still works with manual input.

Optional user-confirmed calendar-file export is a **snapshot** of an explicit
dated plan, not synchronization. Recheck details and conflicts first. No automatic
Google event creation, RSVP, guest invitation, rescheduling or booking.

## 4. Google feasibility and authorization contract

Official references were fetched during specification work on 18 November 2026.
They establish API/policy behavior, **not Gosie's implemented compliance**.

### 4.1 Scope selection

All scope names below have prefix `https://www.googleapis.com/auth/`.

| Mode | Candidate minimum scopes | Important limitation |
| --- | --- | --- |
| Calendar picker | `calendar.calendarlist.readonly` | Lists subscribed calendars; selection is an application privacy control |
| Availability only | `calendar.events.freebusy`; consider narrower `calendar.freebusy` when sufficient | Free/busy contains time blocks, not leisure categories or event titles |
| Event detail opt-in | `calendar.events.readonly`; consider `calendar.events.owned.readonly` if owned calendars alone meet needs | Read scopes can cover more calendars than the person selects in Gosie |

Verify the final combination against selected-calendar access roles and actual
granted scopes; use incremental authorization for details. No broad Calendar
write scope is needed. Never fall back to a write scope or owner's workspace
connector if a participant denies permission.

Default filter enforcement is server-side: never fetch excluded calendars'
events; never call event-detail endpoints for availability-only selections.
Explain that Google may technically grant broader access than Gosie uses.
Switching to availability-only purges stored details immediately but does not
magically narrow an existing provider grant. Offer disconnect/reconsent when the
person wants the broader Google permission removed.

Source: [G1], [G2], [G3].

### 4.2 Per-person linking and token custody

- Keep Gosie login separate from Google authorization. Bind a one-use, expiring,
  unguessable OAuth state to the initiating Gosie user/session, profile,
  connection attempt and browser transaction; protect start/finalize with CSRF.
- Use authorization-code flow with an exact registered HTTPS redirect and PKCE
  where supported by the chosen client flow, verified before implementation.
  Reject callback replay, wrong browser, wrong session, changed account,
  unapproved return URL, missing/denied scopes and unsolicited callbacks.
- **Current integration hazard:** Gosie's login cookie is `SameSite=Strict`
  (`security.js`, `setSessionCookie()`), so a cross-site OAuth callback may not
  carry it. Do not weaken every session cookie or bypass authentication globally.
  Proposed design: a separate short-lived Secure/HttpOnly/SameSite=Lax callback
  correlation cookie plus server-side transaction; callback only validates/stages
  the result, then redirects to a same-origin page that requires the original
  signed-in account and CSRF-protected confirmation before activating the link.
  If the original session expired, require that account to sign in again.
- Stage tokens encrypted, expire abandoned attempts, consume state atomically,
  and bind refresh/reads to connection ownership and selection version.
  Store no token, code, state, calendar title or request text in logs, URLs beyond
  the required short-lived callback, frontend storage, analytics or error reports.
  Strip callback query parameters before rendering a page or loading third parties.
- Distinguish Google account identity from a mutable email string. Use verified
  provider identity for display/binding if required; any added identity scope
  must be justified. Never accept a client-supplied Google subject as proof.
- Use encrypted server-side refresh/access tokens with a separate approved key
  custody/rotation arrangement; no plaintext credential columns or browser tokens.
  Request offline access only for approved refresh behavior. Offline access is
  not permission for scheduled reads.
- Propose one linked Google account per Gosie user initially, with explicit
  profile-specific selections. Switching accounts is disconnect/reconnect, not
  silent reassignment. No cross-profile fallback to another profile's calendars.

Sources: [G4], [G5], [G6]. The callback design is a Gosie proposal, not a
Google-mandated implementation or a tested flow.

### 4.3 OAuth release restrictions

Google documents seven-day refresh-token expiry for external apps in **Testing**
when scopes exceed basic identity; Calendar scopes do exceed that exception.
Five participants do not justify assuming this problem disappears. Specify
reconnect messaging/tests if using Testing, and decide whether it is acceptable
for a private pilot; do not advertise uninterrupted long-term access.

Before any real-provider trial, verify the actual Cloud project, audience,
test-user configuration, consent branding, granted scopes, exact redirects,
Workspace administrator restrictions and current verification requirements.
Production sensitive/restricted-scope use can require Google review; assess any
applicable exception explicitly rather than assuming a five-user exemption.
Google also specifies production homepage/privacy/terms and domain requirements.
No verification submission, exemption, approved domain or provider readiness is
established by this document.

Sources: [G5], [G6], [G7].

## 5. Calendar semantics and conflict rules

These are proposed pilot rules requiring approval; provider field semantics are
documented in [G2], [G8], [G9], [G10].

| Case | Required behavior / proposed default |
| --- | --- |
| Normalization | Preserve source timezone; compare UTC instants; render user timezone explicitly. Use half-open intervals `[start,end)` |
| All-day events | Treat start/end as calendar-local dates, with exclusive end; do not parse them as UTC midnight. Opaque all-day blocks the whole local date |
| Recurrence | Request expanded instances in a bounded window; do not show parent plus each occurrence. Keep recurring identity and original start separately from moved start |
| Moved/cancelled/deleted events | Refresh replaces the complete selected window; moved instances update, cancelled instances do not block. Failed/partial refresh never clears them as if no commitments existed |
| Busy/free | Opaque commitments block; transparent events may display but do not block. Availability-only uses the provider's busy blocks without inventing titles/RSVPs |
| Invitations | In detail mode, exclude self-declined participation; treat tentative or unanswered invitations as uncertain holds unless the person explicitly resolves them. Do not infer RSVP in availability-only mode |
| Sensitive/private detail | Use “Private commitment” when permission/details are insufficient; retain busy time, no classification or reconstructed title |
| Special types | Preserve focus/out-of-office blocking semantics. Birthdays/working-location entries are not automatically a leisure activity or busy block; use transparency and supported provider semantics |
| Overlaps / shared duplicates | Union intervals for availability. Dedupe presentation conservatively using provider identity/series-instance evidence, not just matching titles. Keep provenance for each selected calendar |
| Bounds | An event starting before the window but ending inside it must block. An end exactly at a new start does not overlap; buffers can still prevent fit |
| DST / travel timezone | Expand recurrence in its IANA timezone; handle repeated/nonexistent local times explicitly. Never apply fixed UTC offsets across a DST boundary |
| Missing duration/location | No confirmed-fit recommendation until duration/required journey assumptions are explicit. An untimed gem stays an idea unless opening hours and visit duration are supplied |
| Personal plans | Union valid dated Gosie commitments with Calendar. Existing date/time-label plans lack an end: ask for duration or flag that availability is incomplete |
| Desired leisure | Intersect candidate gaps with user-chosen leisure windows, protected time and buffers; never fill every technically free minute |

Propose a full, bounded snapshot read per user-requested refresh, **not**
incremental/background sync for the first pilot. Exhaust all pagination for the
same query/window; an empty page with `nextPageToken` is not the end. Atomically
replace a snapshot only when complete. If request/time/event caps are reached,
mark incomplete and do not claim the person is free.

Google documents `events.list` bounds, `singleEvents`, `showDeleted`, attendee
limits and pagination. If incremental sync is later approved, a `syncToken`
cannot simply be combined with changing `timeMin`/`timeMax`; handle deleted items,
consistent paging and `410 Gone` by clearing the relevant snapshot/token and
performing a full authorized refresh. It is not part of initial sync scope.

### Freshness and failure contract

Proposed defaults: 14-day visible lookahead, fresh-through five minutes after a
complete read, memory-only event snapshot evicted after 15 minutes, at most five
selected calendars, bounded pages/time/request concurrency with capped retries.
These are choices for approval, not Google's quota limits or a retention policy.

Show a per-calendar last successful check and aggregate state: not connected,
needs consent, loading, current, stale, incomplete, unavailable, reconnect needed,
disconnected. Distinguish quota errors from revoked access, missing calendars
and ordinary empty results. Respect provider backoff and stop repeated refresh
loops; verify exact limits against provider quotas before build.

A partial 403, 429, timeout, offline transition or stale snapshot must never mean
“no events.” Continue with manual input if chosen, explicitly **without a calendar
conflict guarantee**. Recheck before export/committing a proposed plan when stale.

## 6. Private data, memory and lifecycle contracts

### 6.1 Minimal private records (proposed, not schema changes)

| Record | Ownership and allowed content |
| --- | --- |
| Calendar connection | Gosie user, provider identity, encrypted token reference, actual scopes, status and authorization generation |
| Calendar selection | Owning user/profile/connection, provider calendar ID, excluded/availability/details mode, selection revision |
| Snapshot | Memory-only, selected window, provider IDs, UTC intervals/source timezone, transparency/status and permitted minimal title/category; never a public catalog row |
| Request | Owning profile, validated query fields, known/unknown values, requested windows, chosen snapshot/catalog versions; transient by default |
| Memory proposal | Exact allowlisted field changes, prior value/version, origin, account/profile, scope, created/expiry time, pending/confirmed/cancelled |
| Confirmed preference | Explicit value/scope/provenance/confirmation and version; never inferred attendance, sensitive trait or model training example |
| Feedback | Stable discovery ID and version, user/profile, action/reason, temporary or durable scope, expiry, latest explicit rating |

Details mode should request only necessary event fields. Descriptions, guest
identities, conference data and attachments are not needed. If self-RSVP is used,
verify the provider's `maxAttendees` and response projection behavior; keep only
the current participant's status and immediately discard any other attendee
data. Calendar/user names and event titles remain private even when benign.
Optional location must have a stated purpose and consent; do not fetch it merely
because the API can return it.

Propose local deterministic, user-correctable title categories initially.
Classification failure means “Uncategorized,” not a forced guess. Free/busy data
cannot produce activity labels. Calendar content and web excerpts are untrusted
text; no hidden instruction in them can trigger tools, memory or data export.

### 6.2 Memory and feedback behavior

- Search-only input is the default; it does not mutate existing profile config.
  A request must show which saved preferences it is using and any temporary
  override; a soft preference never overrides an unmodified hard limit.
- Confirmation is a separate authenticated, CSRF-protected write with expected
  profile/memory version. One-use proposal IDs bind user/profile and exact diff.
  Conflicting edits return a reviewable conflict; never silently overwrite.
- Forget removes active use and its stored source text/derived representation;
  keep at most content-free deletion bookkeeping needed to prevent replay.
  Undo is a new validated action against the current revision, not a blind restore
  of old values or a bypass of a subsequent deletion.
- “Not this search” expires with the request. “Not this weekend” uses the
  displayed date-window end in the user's timezone; crossing into Monday or
  another timezone cannot extend it silently. A persistent dismissal must be
  labeled as such and reversible. Cost/travel reasons alone do not edit limits.
- Preserve latest-rating semantics, saved state and account/profile isolation.
  Distinguish recommendation feedback from attendance or a review of a real visit.
  Source changes/expired events cannot keep boosting obsolete dated occurrences.
- Calendar-derived category corrections apply to that source instance/series only
  after the user chooses the scope. They are not general interests. A lasting
  interest needs a separate explicit proposal/confirmation.
- Proposed deletion rule: disconnect/deselect removes calendar-derived labels,
  staged suggestions and cached/derived data. Independent user-entered plans and
  explicitly user-authored preferences remain until deleted/pilot end. If the
  person wants to retain a calendar-derived idea as their own, require a separate
  visible copy/retention choice, stripped of private provider links.
- Existing versioned profile portability must remain safe. New memory versions
  need validation, ownership remapping and review on import; exports/imports must
  not contain credentials or recreate calendar connections or raw calendar events.

### 6.3 Disconnect, deletion and retention

On disconnect/account deletion, invalidate the connection generation before
returning success; stop new reads and discard in-flight results against older
generations. Attempt provider revocation; remove local credentials, selections,
snapshots and derived data. A late refresh/callback cannot resurrect them.
If Google revocation cannot be confirmed, show that explicitly with instructions
to revoke in Google Account settings. Do not call local deletion proof of remote
revocation or silently retain tokens for indefinite retry.

On profile deletion, remove its selections/derived records without exposing or
destroying another profile's data. Clarify whether the user's remaining profiles
still use the account-level connection; offer full disconnect separately.

Proposed memory-only snapshots minimize persistence, but **do not approve**
retention durations for conversations, staged OAuth tokens, confirmed memory,
operational logs, failed revocation handling, or infrastructure recovery.
Fix exact values, deletion owner, verification method and pilot end date before
real data. Expiry must be enforced on reads/writes and by bounded cleanup.
No custom database backup/dump job is proposed; document provider recovery
limitations and how restored old credentials/data are prevented from reactivating.

### 6.4 Conversation/model boundary

The launch needs a reliable conversational interpretation contract, not a promise
of unrestricted intelligence. Propose guided natural language plus editable
structured confirmation. Support budget/travel/date/context and explicit
interest-change examples; unsupported language produces a clarification.

Choosing a model/processor remains open. No external model receives raw Calendar
data by default. If a provider is proposed, approve pricing, terms, region,
retention, no-training/limited-use compatibility and the exact outbound fields
first. Prefer validated availability intervals and explicit user-provided query
fields over titles. User-typed queries can themselves contain private details:
obtain consent before sending them externally, not just before sending events.
Model output is untrusted; only validated server contracts can propose changes.
Check Google's User Data Policy [G12] for raw and derived Google data and any
processor transfer; user consent does not waive provider restrictions.
No passive behavioral collection or shared-model training.

## 7. Discovery and explanation contract

The initial catalog must be manually reviewed, useful for one approved coarse
region and broad enough to test arts, sports, community, learning and other
leisure interests. Catalog quantity/region is a decision, not an existing asset.
Public research and moderation approvals never assert a user's attendance.

Each schedulable discovery needs a stable identity/version, source URL/publisher,
supporting evidence and checked time; venue/area; event intervals or supported
opening hours; price/currency/conditions; duration assumptions; lifecycle/expiry;
and explicit unknown fields. Retain only permitted excerpts. Date/price claims
need their own evidence; one URL is not proof of every field. Avoid invented
availability, seats, ticket prices, accessibility or popularity.

Existing reviewed records intentionally have null price/travel/availability.
Before hard-limit matching can be useful, approve a validated enrichment
contract. Do not reinterpret null as zero. Real routing is a separate provider
decision: a user-supplied travel estimate can support an **estimated** plan with
its origin/mode disclosed, not a verified 25-minute journey.

Use deterministic eligibility before soft ranking:

1. Approved/current/region-relevant source record?
2. Required date/time and opening/availability conditions known?
3. Duration, calendar conflicts, protected windows and buffers satisfied?
4. Required price/travel limits supported by facts or explicit disclosed estimates?
5. Only then rank by explicit interests, current context and latest feedback.

Keep uncertainty outside the confirmed-fit group. Ask the person to resolve it,
show possible ideas separately, or return an honest no-match result. Never
substitute fictional samples or stale/unreviewed leads for a real match.

Why must distinguish **source fact**, **user choice**, **calendar constraint**,
**estimate** and **unknown**. Example: “You selected small galleries; this reviewed
exhibit is listed as open Saturday. Your selected calendars show no busy block
18:00–19:00 as checked at 17:20. Travel time is unknown, so fit is not confirmed.”
No confident crowd prediction from a gallery label alone.

Sources remain people-first: useful practical knowledge, not preferential paid
ranking or an advertising directory. Local news, municipalities, nonprofits,
venues and community sites require source permission/rights review; prefer APIs,
feeds and permitted pages. No access-control/paywall bypass or automatic source
enrollment. Public pipeline request/byte/time/cost caps and human promotion remain
separate from private queries; no private data in Git or research artifacts.

## 8. Acceptance and release matrix

All checks below are **required future evidence, not passes from this task**.

| ID | Evidence / acceptance |
| --- | --- |
| A01 | Automated interpretation fixtures: “Saturday after six,” under $40, transport/area/timezone ambiguity, missing duration, unsupported request and malicious text; no mutation without confirmation |
| A02 | API/storage tests: proposal ownership/replay/expiry, exact diffs, stale version conflict, cancel/forget/undo, two profiles and two users; latest rating remains authoritative |
| A03 | Clock/timezone tests: request-only and weekend-only feedback expires correctly; permanent dismissal requires explicit scope; no silent budget change |
| A04 | OAuth/security tests: wrong state/session/account/browser, expired/replayed callbacks, denied/partial scopes, account-link races, Strict-cookie round trip and CSRF; no owner-connector reuse |
| A05 | Provider fixtures: pagination including empty intermediate page, recurring moved/cancelled/deleted instance, DST, exclusive all-day end, cross-midnight overlap, private events, transparency and own RSVP |
| A06 | Calendar boundary tests: no fetch of excluded calendars, no details in availability mode, profile isolation, stale/incomplete/error not free, quotas/backoff and selection-change races |
| A07 | Eligibility fixtures: known conflicts excluded, buffers/protected time respected, unknown price/travel/duration not confirmed-fit, expired catalog evidence and zero matches honest |
| A08 | Privacy/security tests: encrypted tokens, log/analytics/export redaction, prompt-injection separation, disconnect/forget/account deletion including late callback/read/refresh and restored-data hazards |
| A09 | Separately approved live Google test with two controlled test identities: consent, calendar picker, limited scope, real recurrence change, refresh expiry/reconnect, revoke and delete; record actual granted scopes. Mocks do not satisfy this |
| A10 | One complete signed-in web journey using controlled test data: request → correction → calendar-aware result → Why → temporary feedback → confirmed memory → return → forget/disconnect; inspect mobile widths too |
| A11 | Keyboard, focus/announcements, 200% text and reduced motion at 360/768/1280px; each width checked, not inferred from a screenshot at another width. Native screen-reader checks remain separate |
| A12 | Separately authorized hosted verification: exact deployed revision, HTTPS/Secure cookies, same-origin API, two-account isolation, redeploy persistence, recovery limits, no private archives and redacted logs |
| A13 | Owner-approved dates, notice, participants/recovery support, data deletion and processor/source permissions; run the five-person study only after the release gate |

Record for each result: inspected revision/tree state, implemented revision,
tested revision plus command/environment, and deployed revision/URL separately.
Fixtures, component tests, browser interactions, screenshots, hosted tests and
reported evidence each get their own label. A process restart is not a redeploy.
Do not assume an earlier green suite covers new Calendar or memory code.

### Historical gate mapping

- **B3:** reuse ownership, profile, feedback, import/export and hard-limit evidence
  only after checking the exact tested revision. Historical Maya/Jordan/Alex and
  E-series parity must be run against authorized fixtures or explicitly marked
  unavailable; matching counts is not parity. This document does not pass B3.
- **B4/Gate 2:** proposed Calendar scope implements only the selected read-only,
  on-demand concept. OAuth setup and live testing need separate approval.
  No background/calendar write scope or blanket Gate 2 authorization is implied.
- **Release:** A09–A13 and owner sign-off remain distinct from B3/B4 source work,
  provider verification, build success or task completion.

Existing work is not duplicated: hosted persistence/recovery, five-person study,
archive privacy, mobile feedback, reviewed-discovery accessibility, organization
accessibility, native screen readers and offline recovery remain in their
existing task tracks. Their status/evidence must be refreshed before launch.

## 9. Decision register and blocking conditions

Every proposed default below can be changed. **None is owner-approved merely
because this specification task is complete.**

| ID | Decision / proposed starting point | Needed before |
| --- | --- | --- |
| D01 | Approve this scope and ordered build prompt; identify approving owner | Any product implementation |
| D02 | Confirm per-user Google OAuth approach, client ownership/domain, actual scope combination and profile-selection rules | Connector implementation |
| D03 | Accept testing-mode reconnect limits or establish required production/verification path | Real Google trial and pilot launch |
| D04 | Approve on-demand-only, 14 days, 5 calendars, five-minute freshness and 15-minute memory-only cache; exact caps/retries | Calendar data implementation |
| D05 | Choose guided/local interpretation versus an approved external processor, outbound fields and costs | Conversational processing / any external query |
| D06 | Approve token-key custody/rotation, transaction TTL, logging, revocation-failure handling and recovery safeguards | Token storage / live authorization |
| D07 | Pilot start/end, deletion owner, retention per data class and provider recovery disclosure | Real participant data |
| D08 | Approve memory scope, temporary feedback lifetimes, conflict/undo and calendar-derived deletion rules | Memory/feedback changes |
| D09 | Approve desired leisure/protected time, invitation ambiguity, all-day/buffer rules and manual-plan duration handling | Availability/ranking implementation |
| D10 | Choose coarse region, manually reviewed initial catalog and rights; source/fact enrichment and review cadence | Real discovery recommendations |
| D11 | Approve duration, cost and travel-estimate policy; routing remains optional/separately gated | Confirmed-fit claims |
| D12 | Approve identity/recovery support, privacy/terms, test identities, invite identities and safe provider/hosted verification scope | Live tests / invitations |
| D13 | Optional snapshot export included or deferred; never a replacement for calendar awareness | Export implementation |
| D14 | Approve minimum-data study measures and success thresholds | Study collection |
| D15 | Approve hosted release revision after evidence review; independently authorize invitations/publication | Launch |

Launch remains blocked by the new features not being implemented, empty reviewed
catalog, absent live Google evidence, unresolved operational/privacy decisions
and unverified hosted release gates. A private pilot is not automatically exempt
from Google requirements or data protection obligations.

## 10. Success and proprietary value

Propose five voluntary participants completing a plan-and-return cycle, with
small qualitative measures: could the person find a useful option, understand
why/why-not, correct Gosie, control memory and return voluntarily? Agree thresholds
before the study; do not invent usage results or collect event titles for metrics.

The value hypothesis is reliable personal constraints, user-confirmed preferences,
explainable decisions and source-backed local knowledge. It is not hoarded
calendar history, inferred sensitive traits, copied publisher content, lock-in,
passive surveillance or an already-established proprietary moat.

## 11. Official provider references

Fetched for planning; no account access or API call against a calendar:

- **[G1]** [Calendar authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
- **[G2]** [Events: list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
- **[G3]** [Freebusy: query](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- **[G4]** [OAuth web-server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- **[G5]** [OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- **[G6]** [OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)
- **[G7]** [OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies)
- **[G8]** [Event resource semantics](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- **[G9]** [Recurring events](https://developers.google.com/workspace/calendar/api/guides/recurringevents)
- **[G10]** [Synchronizing resources](https://developers.google.com/workspace/calendar/api/guides/sync)
- **[G11]** [CalendarList: list](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list)
- **[G12]** [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)

Exact project configuration, verification classification and Google policy
compliance must be checked before activation. Policy citations are not legal
approval or evidence the application meets them.
