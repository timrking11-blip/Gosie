# Gosie planning pilot — implementation and release boundary

Updated 17 November 2026. This is a current worktree implementation record,
not a replacement for the dated read-only baseline or proof of what is on
GitHub `main` or in a published deployment.

## Owner decisions and limits

- Web-first pilot on Replit with Replit Postgres.
- Harden the existing email/password approach; no authentication-provider switch.
- Intended audience: five invited participants with their own data, **after**
  privacy, invitation, and hosting checks.
- Delete pilot data after the pilot. No end date or provider-recovery retention
  policy has been approved; do not promise immediate backup erasure.
- No publishing, participant invitations, calendar access, live-source connection,
  purchases, passive tracking, or shared-model training was performed here.
- The historical B3 parity suite and B4/Gate 2 remain separate approvals.
  Focused new regression tests are not a claim that those gates passed.

## Product surfaces

| Surface | Current role |
| --- | --- |
| `artifacts/gosie`, `/` | Illustrative promotional website; no real listings or personal history implied |
| `artifacts/gosie`, `/login` and `/app` | Operational pilot implementation connected to same-origin `/api`, with closed registration |
| `artifacts/gosie-week-ahead` | Separate illustrative dashboard; its design-system work is preserved |
| `artifacts/gosie-mobile` | Separate mobile demo; not connected to this pilot API |
| Private Muse template | Historical functional/design reference, not this checkout or verified parity |

## Implemented in the pilot

- PostgreSQL users, profiles, hashed sessions, feedback, and owned dated plans.
  No runtime schema creation; the development schema is applied explicitly.
- Password hashing, origin/JSON-body checks, session CSRF, persistent auth
  rate limits, secure production cookies, server-side ownership, account deletion.
- Sign-in/out, closed-by-default registration, new/copy/select/delete profiles.
  Production additionally requires an owner-configured allowlist of at most five
  hashed email addresses and serializes registration to cap the pilot at five
  accounts. No real allowlist or invitation was configured.
- Owned plan creation, editing, completion, deletion, next-week carry-forward,
  category/company/date grouping, and week navigation.
- Persistent source labels for fictional copied plans, including after reload,
  carry-forward, and export/import.
- Preferences and fixed fictional recommendations with hard limits before
  ranking; explicit exceptions/exclusions; context ranking and explanations.
- Save, dismiss/restore, latest rating, and per-profile next-visit ranking effects.
- Versioned profile export/import with new IDs and owned carry-over remapping.
- Production entrypoint prepared to serve built web files and `/api` on the
  same origin, including video byte ranges. This configuration has not been
  published or tested behind the production proxy.

Interests are keyword/category matches, not learned personalization. Home base,
balance, imported variety settings, and saved social preferences currently
round-trip as profile settings, but do not affect scoring. The UI discloses this.
The current social lens is view-scoped. Completing a plan changes its stored
completion state and summary, not recommendation scores.

## Evidence from this worktree

Work began at clean `2bd42be2ff187320309308d130020a7a9b95c961`.
The implementation below is an **uncommitted patch on that base**, not that
commit's tree. The final tested revision must not be described as a clean SHA
unless the patch has subsequently been committed and re-identified.

| Check | Result |
| --- | --- |
| Gosie web TypeScript check | Passed |
| Gosie component/regression tests | Passed: 16 tests, 4 files, including 3 new owned-date grouping checks |
| Gosie production build | Passed with manifest `PORT=23967`, `BASE_PATH=/` |
| PostgreSQL API/ranking tests | Passed: 23, including production invite/capacity guards; synthetic users cleaned up |
| Production serving + existing mobile static-server tests | Passed: 8 (2 new production smoke checks, 6 existing mobile server checks) |
| Dev same-origin `/api/health` | HTTP 200; database reports Postgres |
| Signed-in browser journey | Passed: keyboard sign-in, dialog focus/Escape, owned plan creation/regroup/reload, hard-limit preferences, Why, save/latest rating/reload, social context, sign-out |
| Responsive browser observations | No horizontal overflow at 360px and 1280px; screenshots captured. Full accessibility, text scaling, and native mobile were not tested |
| GitHub Actions | Workflow updated for Postgres; not run here |
| Native mobile typecheck/build/real phone | Not rerun; mobile application source unchanged |
| Published HTTPS, redeploy durability, provider recovery | Not tested; nothing published |
| Five-person pilot / repeat-use findings | Not performed |

The API process-restart test preserves a nonempty plan, latest rating, profile,
and session; it does **not** simulate a Replit redeploy, database recovery, or a
private prototype acceptance test. Production-serving smoke checks use built
files and a synthetic, nonconnecting database configuration, not production data.
The browser run used one synthetic account, then deleted it. Two-account isolation
was covered by API tests, not two browser sessions. The browser run did not cover
import/export or an expanded excluded-items list. Follow-up CSS removed a switch
graphic's pointer interception and enlarged small controls; no second full
browser pass was run.

## Release gates still open

1. Review/configure invite-only enrollment for five participants. The registration
   flag and email allowlist are not email-identity verification mechanisms.
   Decide recovery and identity support before users depend on password accounts.
2. Approve the pilot notice, end date, deletion responsibility, repository/license
   boundaries, and provider recovery-retention disclosure. Keep signup closed.
3. With separate publish approval, verify the exact hosted revision over HTTPS,
   secure cookies, ownership, and same-origin API routing; then verify real
   redeploy persistence and provider-supported recovery. Do not build a custom
   backup database or startup/dump job.
4. Only after those gates: invite five people, observe a full plan/return cycle,
   record explicit qualitative findings, and delete data at the agreed end.

No pilot-readiness, real-discovery demand, personalization learning, or
proprietary moat has been established. The defensibility hypothesis remains
trusted, user-controlled plans and explicit preference/feedback history; it
requires real usefulness and repeat-use evidence.
