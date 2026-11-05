# Gosie roadmap: promo site → configurable Week Ahead product

Assessed 2026-11-05. Sources read: this repo; Muse export packages in `Desktop\Gosie App` (Week-Ahead Dashboard HTML export, Personal Intelligence Template contents incl. Phase 2 closeout, Gate 1G/B1/B2 reports and `pit-b1` code, Gate 1C package); published preview URL (headers only). `Gosie-website-source.zip` was never found; brand assets in `gosie_brand_assets/` were used. Existing assessment: `docs/mvp-readiness.md` (not repeated).

## Two different things called "the dashboard"
1. **Week-Ahead Dashboard (Muse, `web_static`)** — Tim's personal-use page: headliner, carried-over checklist, day-by-day, action board, money watch, Weekend Ahead, "just beyond", fun outings, evenings at a glance. Hand-built weekly (cron Sundays 19:18) from real calendar/personal data; ticks are not persisted. Only the Oct 26 version is public; Nov 3 refresh is private. Fonts Newsreader/Libre Franklin, green palette, light/dark.
2. **Personal Intelligence Template (Muse, private fullstack)** — the configurable, multi-profile engine (profiles, custom interests, constraints, feedback, import/export, schema `1.0.0-draft`). Not exportable; Option B (standalone web+API+DB) is the accepted target. B1 done locally, B2 local with Partial items, **B3/B4/Gate 2 not authorized**.

The finished product = (2)'s engine rendered with (1)'s information design and Gosie branding (Fraunces/Manrope, `gosie_brand_assets`), deployed for Tim first and then as configurable for others.

## Baseline (verified locally, Node 24, pnpm 10.26.1, PORT=23967 BASE_PATH=/)
| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass |
| `@workspace/gosie` typecheck | Pass |
| `@workspace/gosie` tests | Pass, 13/13 (3 files) |
| `@workspace/gosie` build | Pass |
| `artifacts/api-server/test-b1.js` (new) | Pass, 14/14 B1 checks |
| Browser/pointer/keyboard resize, mobile runtime | Not run |

The resizable wrapper (Plan #8) was already repaired by merged PR #1; it still typechecks and passes, so no wrapper edit was made. Existing tests cover mount/focus/direction attributes only, not pointer or keyboard resizing — still unverified.

## What changed in this pass
- **Backend added**: `artifacts/api-server/` — the B1/B2 engine from `pit-b1` ported into the repo (previously the repo had *no* backend). Hardened: auth rate limit, `COOKIE_SECURE`, password minimum, feedback validation, body-limit 413, graceful shutdown. Added to CI (`.github/workflows/gosie-web.yml`).
- `gosie-mobile/server/serve.js`: static path guard no longer allows sibling-prefix escapes.

## Capability classification
Product = works for a real user with persistence; Demo = promotional illustration.

| Capability | Status | Evidence |
| --- | --- | --- |
| Promo site, illustrative Week/Weekend previews | Implemented (Demo) | `artifacts/gosie`, 13 tests |
| Onboarding & editable preferences/custom interests | Missing (UI); Partial (API) | Config editable via `PUT /profiles/:id`/import; no UI; B2-9 Partial |
| Week Ahead dashboard | Partial | API `/week` returns 7 hardcoded Alex records; no user items, no UI |
| Weekend Ahead | Partial | API `/weekend` ranks 16 fictional records; no UI; absolute scores differ from Muse (B2 §3) |
| Recommendations + Why/provenance | Partial | API returns `why[]`/`sourceType`; no UI; fictional data only |
| Budget/travel hard constraints, exception group | Implemented (API) | B2-2/B2-5 pass |
| Save / dismiss / rate | Implemented (API); Missing (UI) | B1-3, B2-6 |
| Persistence | Partial | SQLite works locally (B1-8 pre-restart only; real restart not exercised); Replit/Cloud Run disk is ephemeral |
| Authentication & user isolation | Implemented (API), needs hardening | B1-1..4, 6, 7 pass; login CSRF and real-host Secure cookie open |
| Versioned JSON export/import | Implemented (API) | B1-9/10; no UI |
| Carried-over checklist, action board, money watch, fun outings, evenings | Missing | Exist only in Muse static HTML; need data model |
| Real calendar/live data | Missing, out of phase | B4/Gate 2 unauthorized |
| Mobile companion | Demo only | Static data |
| Published app | Unverified | Provided URL is a Replit **Vite dev-server preview** (serves `/@vite/client`, dev banner), not a production deployment; build is fine, deployment target needs checking |

## Unresolved decisions / credentials
- Authorize B3 (acceptance reproduction) and set the first release scope (private pilot with fictional data vs. Tim-only real data).
- Hosting + durable DB (Replit Postgres or Fly/Neon) and auth approach; secrets (`SESSION`/DB URL) — none provisioned.
- Google Calendar OAuth credentials (B4) — not requested; separate gate.
- Whether the Nov 3 Muse dashboard may be treated as the design reference (private link; HTML export used).
- Missing `Gosie-website-source.zip` (brand/UI kit) — only brand assets and mockup JPGs were available.

## Smallest ordered increments to a consumer MVP
1. **Deployable foundation** — production serve for web (static, not dev server), api-server behind HTTPS with `COOKIE_SECURE=1`, Postgres replacing SQLite, `/api` proxy. *Accept:* data survives a real redeploy; login works over HTTPS.
2. **Auth UI + profile list** — register/login/logout, demo profiles, copy-demo-to-mine. *Accept:* two accounts cannot see each other's profiles in the browser.
3. **Week Ahead & Weekend Ahead views** on the API using Gosie branding and Week-Ahead Dashboard layout; labelled fictional data. *Accept:* Alex shows 7 week items/6 groups; weekend 13/1/2 counts; Why panels visible; keyboard and reduced-motion reviewed.
4. **Preferences & onboarding UI** — constraints, interests, custom interests, grouping, social lens. *Accept:* changing hard budget/travel changes exclusions (E-series); constraints survive social-context change.
5. **Feedback loop UI** — save/dismiss/rate with visible ranking effects, per-profile. *Accept:* feedback persists across restart and doesn't leak to other profiles.
6. **Import/export UI** with version rejection. *Accept:* round-trip equals original; wrong version rejected.
7. **Personal items** — user-owned week items, persistent carried-over checkboxes, action board/money watch (the Tim-specific sections as configurable sections).
8. **B3 evidence** — full Maya/Jordan/Alex parity, field-by-field demo diff, login CSRF, rate limits, a11y/visual review.
9. **B4 (only after approval)** — read-only on-demand Calendar, token custody server-side, disconnect/delete.

**MVP is complete only when** a new user can register, onboard, see Week/Weekend results honoring their constraints, give feedback that changes ranking after a restart, export/import their profile, and cannot access anyone else's data — each demonstrated by the acceptance checks above, not by a green build.

## Update: persistence and web wiring (PR #4)

- Done: storage interface (memory, SQLite, Postgres with migrations); API serves the built web app same-origin; web Account panel (register/sign in, list/create/delete profiles) via relative /api URLs.
- Next increments: preference editor, Week/Weekend views from /week and /weekend, feedback and import/export UI, Replit deploy switched to run node artifacts/api-server/server.js (needs DATABASE_URL secret, COOKIE_SECURE=1, TRUST_PROXY=1), verification against real Postgres.

