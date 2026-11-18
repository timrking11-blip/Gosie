# Hosted pilot verification — incomplete

Evidence recorded 18 November 2026. This is not pilot-readiness approval.

## Revision boundaries

- Inspected base HEAD: `ac090badadd32b60e6f1434e4b2523bf39486a1e`.
  The initial worktree was clean.
- Reviewed release commit: **not established**; inspection is not independent
  release approval.
- Tested source: **uncommitted login-fix patch on that base**, not the base
  commit's tree. The patch adds React Query deduplication to Vite and Vitest
  and adds the real shared-client hook regression test.
- Deployment history lists successful build
  `992d61a1-d0e3-4d9c-b72e-3f38d6784f70`, created at
  `2026-11-18T09:00:43.485Z`. Its source SHA and mapping to the actively
  serving revision have **not** been independently established.
- No publish, redeploy, production write, role grant, or recovery was performed.

## Read-only hosted observations

The deployment service reported a public, successful Autoscale deployment at
`https://gosie.replit.app`.

| Check | Evidence and limit |
| --- | --- |
| `/login` | HTTP 200 HTML, but a fresh browser screenshot displayed “This page didn't load.” HTTP success is not a working login. |
| `/app` | HTTP 200 HTML only; no authenticated journey tested. |
| `/api/health` | HTTP 200 JSON: `{"ok":true,"app":"gosie","database":"postgres"}`. Does not identify the database binding or migration state. |
| `/api/auth/session` | HTTP 200 with `authenticated:false`. |
| `/api/profiles` | HTTP 401 with `unauthorized` for an unauthenticated request. Does not prove two-account isolation. |
| HTTPS | Requests completed over HTTPS; HSTS was present. No authenticated application cookie was inspected, so Secure-session-cookie behavior is unverified. |
| Production schema inspection | Managed production read-only query was denied: authentication required. No schema or data was read. |

## Authorized workspace login repair

The owner separately approved “Fix and test login,” not publication or production
data operations. The web root already provides QueryClientProvider. The web app
and workspace API client resolved different pnpm React Query peer variants.
The new regression test initially failed in the real shared useLogin hook with
an invalid-hook/useContext error. Deduplicating React Query with React/React DOM
fixes that regression.

| Check | Result |
| --- | --- |
| Web component suite | 66 passed across 13 files, including the new shared-client login context regression. |
| Web TypeScript | Passed. |
| Production web build | Passed with manifest `PORT=23967 BASE_PATH=/`; Vite warned about a JavaScript chunk over 500 kB. |
| Built preview browser | Direct `/login`, reload, and `/app` → “Go to sign in” passed with no query-context or hook errors. `/app` shows a sign-in gate rather than automatically redirecting. |
| Responsive/keyboard | Tester reported no horizontal overflow at 360px and 1280px; keyboard focus and password show/hide worked. Not a full accessibility audit. |
| Form errors | Mocked login 401 and registration 403 displayed inline errors. No real sign-in, registration, or database write was tested; this does not validate invite enforcement. |
| Development browser | `/login` rendered without query-context/hook errors. |
| Communities sign-in path | Not exercised: the tester did not find that link on the unauthenticated main-app surface. The separate Week Ahead Communities route was not covered. |

The temporary built-preview server was stopped after verification. The published
site has not received this patch.

## Gates still open

1. Review and identify a committed release candidate, then obtain separate
   owner publication approval.
2. Obtain authenticated production inspection access and confirm the database
   binding/schema through supported tooling without exposing connection secrets.
3. Obtain approval for disposable synthetic hosted accounts and their cleanup.
   Check real HTTPS authentication, application cookie flags, same-origin
   routing, two independent browser sessions, and cross-account rejection.
4. Record nonempty plans and latest feedback before an approved real redeploy,
   then verify the same owned data after redeploy and sign-in.
5. Owner checks Database → Production → Settings → point-in-time recovery and
   supplies the available retention window/restore point. Do not assume PITR
   settings are visible to the agent.
6. Plan a separate owner-approved recovery exercise before any real-user pilot.
   Restoring production replaces later writes; it must not be attempted as an
   automatic test. Use provider-supported recovery, not backup tables, dump
   jobs, startup DDL, or custom production migrations.

Task #29 remains incomplete until hosted durability and recovery are actually
verified. Development API-process restart tests and successful builds do not
substitute for these gates.
