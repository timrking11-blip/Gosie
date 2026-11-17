# Gosie Communities implementation — 17 November 2026

## Evidence boundary

This is development/worktree evidence, not publication or pilot readiness.
The inspected HEAD was `f8eb79a247a79ce3dbad4cf59f978b8f38896521`;
the changes below were an **uncommitted patch on that HEAD** when checked.
They are not asserted to be that clean commit's tree, GitHub main, or any
published deployment revision.

## Delivered

- Shared PostgreSQL-backed event/gem submission and owner-comment moderation.
  Signup remains closed by default. Accounts receive no community role at signup.
  Contributor, designated restaurant-owner and moderator grants are assigned by
  an operator, never by an HTTP self-grant form.
- Contributor/owner submission forms and private status lists; separate moderator
  approval/rejection queues. Pending/rejected records remain private to their
  author and moderators. Self-moderation is refused. Owner note attribution is
  server-assigned. Public responses omit account/email identifiers.
- Communities navigation in signed-in Gosie web, Gosie Mobile and Week Ahead.
  Web and Week Ahead share a component and API contract; native uses that same
  contract and date-window selector.
- Current approved timed events appear on their supplied dates in Week Ahead
  discovery, separately from personal plans and fictional examples. Multi-day
  events appear on each overlapping web date. Native cards show their actual
  date range. Evergreen gems remain untimed discovery ideas.
- Public credit, source links, review dates, availability caveats, explanations,
  loading/error/retry and empty states. Approved expired events are accessible
  through the web archive toggle, explicitly labeled as past events.
- Account deletion cascades through contributions, notes and role grants.
  Login/submission copy discloses public content after approval. Profile export
  remains profile-only, not a contribution export.

## Automated checks actually run

- `GOSIE_DB_ENV=test pnpm --filter @workspace/api-server test`:
  **32 passed, 0 failed**, including eight nested Communities assertions for
  grants, ownership/privacy, moderation, owner attribution, date validation,
  rejection, expiry and deletion.
- `pnpm --filter @workspace/gosie test`: **26 passed in 6 files**.
  Includes eight shared Communities component/contract tests and two tests
  exercising the actual mobile data hook with a web renderer/Platform stub.
  This does not drive the native renderer or simulate device cookies.
- All three package typechecks passed.
- Gosie web production build passed with `PORT=23967 BASE_PATH=/`.
  Communities is split into a separate lazy-loaded chunk; the main chunk stayed
  below the build's 500 kB warning threshold.
- Week Ahead production build passed with
  `PORT=26028 BASE_PATH=/gosie-week-ahead/`.
- Mobile static iOS and Android build passed with
  `PORT=21101 BASE_PATH=/mobile/`, after limiting Metro to one worker.
  Generated static output remains ignored, not staged source.
- `git diff --check` passed. Lockfile changes add only the shared workspace
  importer/link declarations; no external package versions were upgraded.

An earlier mobile build was lost when the workspace restarted: **not a pass**.
One web test run timed out during concurrent build/restart activity; a later
full run passed. New cross-client hook tests initially exposed two React
instances in the test harness; test-only deduplication corrected it, and the
final full suite passed. CI now installs the mobile dependencies needed by those
cross-client tests, typechecks Mobile, and watches mobile/shared-package changes.
GitHub Actions itself was not run here.

## Live browser evidence

One browser pass used only three synthetic accounts, with no planning profiles:

1. Keyboard sign-in and contributor submission of a future timed event.
2. Pending event visible privately, absent from the approved feed.
3. Moderator approval moved that event into the public feed.
4. Designated owner submitted a note; it stayed private until separately approved.
5. Week Ahead Communities and date discovery showed the approved Thursday event
   and owner note separately from fictional samples.
6. Communities overflow measurements passed at **360, 768 and 1280px**.
   Screenshots were captured at 360 and 1280, not 768.
7. Tab/Space operated the past-events checkbox; Enter/Space expanded/collapsed
   Why and changed `aria-expanded`.

Workflow startup initially returned 502; restoring the managed workflows
resolved it. The successful signed-in reload had no failing responses or
application exceptions. Dev reconnects interrupted a few keystrokes, which
were retried. This is development behavior, not hosted HTTPS evidence.

Additional static screenshots checked Week Ahead Communities at 360px and
the Expo web Communities screen at 360px. The Expo screenshot rendered the
approved synthetic event and owner note; it is **not a native-device interaction
test**. A later CSS-only correction gives web's four navigation destinations
four columns instead of wrapping Profile into a second row.

The live journey did not exercise gems, rejection, past-event results, native
submission/moderation, text scaling, full screen-reader behavior, or real phones.
Automated API/component coverage is not a substitute for those checks.

## Release and operation limits

No publication, production schema change, real invitation, real role grant,
calendar access, live ingestion or participant-data collection occurred.
Development schema was applied explicitly. All three synthetic users and their
cascaded content were removed after verification; follow-up queries returned
zero synthetic users, community items, comments and role grants.

Production native builds need an approved HTTPS `EXPO_PUBLIC_GOSIE_API_URL`
(including `/api`). Static clients require their approved same-origin routing
to the API; published multi-artifact routing and physical-device cookie behavior
remain unverified. The mobile builder's printed development URL is not proof of
a production deployment.

No community withdrawal/edit workflow, post-publication reporting, automated
business verification or submission-specific anti-spam quota was added.
Those are not claimed capabilities. Hosted durability/recovery, real-phone
checks and the five-person study remain their existing separate release tasks.
