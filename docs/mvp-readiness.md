# Gosie: build repair and consumer MVP readiness

Assessment date: 2026-11-02. Inspected GitHub baseline: `5e385092c162c085a7f030a55ee5da67f43517a2`.
This assessment covers this repository. It does not establish the current state of the private Muse application.

## Immediate repair

The resizable wrapper imports `Group` and `Separator`, which are incompatible with its v2 dependency.
The manifest requests `^2.1.7`; the committed lockfile resolves `2.1.9`.
Use `PanelGroup`, `Panel`, and `PanelResizeHandle` with their actual component prop types.
The existing direction-based styling selectors already target the v2 attributes and are preserved.
No manifest, lockfile, framework, page, or mobile changes are needed.

The new compatibility tests import the real dependency and mount both directions, check the handle's accessibility/focus and grip, and retain both panels. They do not establish actual pointer dragging, keyboard-driven size changes, or visual CSS appearance.
GitHub CI runs the existing full web typecheck, tests, and production build from the committed lockfile. Build environment values come from the existing artifact manifest.
No Replit Agent call or Replit deployment is part of this repair.

## Evidence and authority

- Current source: `replit.md`, web routes, `WeekMock`, `WeekendMock`, web tests, workspace manifests, and both mobile tab screens.
- [Phase 2 closeout handoff](https://chatgpt.com/library?file_id=libfile_76c97b01e8908191980eebb47b2d9ce4&account_id=personal): functional reference for the private Muse template, including its feedback-evidence caveat.
- [Gate 1G portable architecture plan](https://chatgpt.com/library?file_id=libfile_1e8e09889b148191a3e5c4af6ca09d5f&account_id=personal): standalone web/API/database with session identity and server-enforced ownership; B1-B4 migration sequence.
- [Earlier Calendar pilot plan](https://chatgpt.com/library?file_id=libfile_f43419fb5e6c8191bc312c6bf7632643&account_id=personal): read-only, on-demand retrieval and privacy constraints. Gate 1G supersedes its Muse-first architectural option.

The handoff describes Phase 2 as functionally accepted/frozen, with feedback persistence/isolation not exercised by nonempty rows in its captured state. The handoff explicitly requires nonempty-row follow-up before trusting those Pass labels. The later portable plan also calls for feedback-effect reproduction; neither document proves this GitHub repository contains those features.
The portable plan is a historical design reference, not proof of deployed code or current gate approval. This work authorizes the build repair and assessment only; it does not sign a migration or Calendar gate.

## Capability comparison

Status is relative to the operational consumer product, not the completeness of the promotional page.

| Capability | Repository status | Evidence and implication |
| --- | --- | --- |
| Branded promotional website and interactive examples | Implemented | Index route, preview components, and their existing interaction tests. |
| Week Ahead product dashboard | Partial: illustration only | Seven hardcoded events; category/chronological grouping. No user-owned records, other roadmap groupings, or generated briefing. |
| Weekend Ahead product discovery | Partial: illustration only | Four fictional ideas, preset social scores and example explanations. No discovery source or operational constraint engine. |
| Onboarding and editable preferences/custom interests | Missing | No corresponding route, profile model, or store; budget/travel/pace are static labels. |
| Authenticated accounts and server-enforced ownership | Missing | The web app is a static Vite frontend; no API/session/database service in the repository. |
| Durable profiles and user data | Missing | Preview state is component-local and no persistent product store is present. |
| User-triggered generation and deterministic ranking | Missing | Reordering fixed demo scores is not the roadmap's normalized record and constraint pipeline. |
| Save/dismiss/rate and ranking effects | Missing | No feedback API/store or operational controls. |
| Versioned JSON export/import | Missing | No config validator or portability flow; preserve schemaVersion `1.0.0-draft` when porting. |
| Provenance and explanations | Partial | Honest fictional-demo labels and sample Why panels; no per-record source/freshness/uncertainty model. |
| Constraint eligibility and exception groups | Missing | Hard budget/travel limits must filter before ranking, with exclusion reasons and separately labelled exceptions. |
| Multi-profile acceptance evidence | Missing | Existing tests cover promotional routing/interactions; no database restart, ownership, feedback, or round-trip tests. |
| Calendar and other live connectors | Missing / later scope | No account connection exists here. Calendar remains gated after core-product acceptance. |
| Mobile companion | Illustrative only | Static events and ideas with local component state. Its weekend copy still contains fictional saved/rated-history explanations; recorded as a follow-up, unchanged by this repair. |

The two actual web Week Ahead previews and compact/normal variants have regression coverage for all five weekdays and seven events. This repair preserves those source files and tests. Fresh CI results are recorded below.
No source evidence supports calling this repository a completed consumer MVP.

## Smallest ordered route to a consumer MVP

1. **Reconcile the original implementation first.** Locate the independently developed standalone B1/B2 source, if it exists. Repository-name searches for personal-intelligence, Goose, and Muse under the connected GitHub owner returned no matches; that does not rule out source under another name or outside GitHub. Compare its revision and acceptance evidence with Gate 1G; selectively reuse verified work instead of rebuilding it. It is absent from this inspected repository. Do not merge an unrelated prototype wholesale.
2. **Agree on the first operational release.** Recommended first milestone: a private multi-account web pilot with manual entry and explicitly fictional discovery records. This is a proposed consumer-friendly milestone, not a live-discovery release. Keep the promotional homepage intact and introduce the operational experience through explicit application routes.
3. **Foundation (B1 equivalent).** One web/API/database application, secure sessions, server-side ownership on every operation, persistent profiles, schema validation, and import-as-new-profile. Select the database/auth approach before implementation; do not provision paid services as part of this repair.
4. **Consumer journeys (B2 equivalent).** Short onboarding, editable structured/custom interests, Week/Weekend dashboards, category-first default and other documented groupings, deterministic hard constraints before ranking, view-scoped social lens, provenance/Why panels, and durable feedback with observable per-profile effects. Keep calculation, data adapters, and presentation separate within one application; independent agents/workers are not required.
5. **Evidence (B3 equivalent).** Nonempty feedback survives restart; two users cannot access each other's profiles; two profiles can rate the same item differently; import/export round-trips and rejects wrong versions; legacy customInterests defaults correctly; hard limits survive social-context changes; no-match is honest. Reproduce E1-E8, review responsive/keyboard/reduced-motion behavior, and compare exact scoring only where fixtures and rules are available. Counts and sample scores alone are not acceptance.
6. **Real-data connector (B4, later).** Only after core acceptance and explicit connector authorization: on-demand, read-only Calendar with per-profile ownership, Excluded/Detailed/Availability-only selections, server-side token custody, minimal retention, distinguishable failure states, and disconnect/deletion. Live discovery and real travel routing are separate decisions.

## Verification evidence

[GitHub Actions run](https://github.com/timrking11-blip/Gosie/actions/runs/41448467236), tested branch revision `51e5faae29024b62ec18fced9d79a627e95e126e`, PR merge revision `3dbb1ce2d63bff86224c0f2d6134d9fa9279125b`.
Node 24, PNPM 10.26.1, frozen lockfile, artifact-configured PORT=23967 and BASE_PATH=/.

| Check | Fresh outcome |
| --- | --- |
| Locked web dependency installation | Pass |
| `pnpm --filter @workspace/gosie typecheck` | Pass, no suppression or config exclusions added |
| `pnpm --filter @workspace/gosie test` | Pass: 13 tests across 3 files (10 preview interactions, 1 routing, 2 new resizable compatibility cases) |
| `pnpm --filter @workspace/gosie build` | Pass |
| Live browser / real resize interaction | Not performed |

The first successful run exposed a React test focus-update warning; the test now flushes that update with `act`, and the subsequent run passes. An upstream pnpm setup-action Node 20 deprecation notice remains; GitHub ran that action on Node 24 successfully. No Replit Agent calls, billing changes, account connections, infrastructure provisioning, or deployment were used.
The baseline errors were confirmed in source; a fresh pre-repair baseline typecheck was not run locally because the local host could not resolve GitHub. Final checks ran on GitHub's runner instead.
Documentation-only evidence updates do not alter the tested product code.

## Current release limitations

- This assessment does not verify a live preview, mobile runtime, real pointer/keyboard resizing, or a public deployment.
- The earlier development archive-exposure finding was excluded from the focused correction. It is not fixed or freshly tested here; current Vite filesystem settings alone do not prove it resolved.
- Public product release additionally requires security/privacy, accessible consumer flows, truthful source availability, and the relevant operational acceptance evidence.
- Passing the wrapper typecheck is a maintenance milestone, not consumer MVP completion.

## GitHub-to-Replit handoff without Agent

1. Review this branch/PR and its check results. Nothing here automatically merges or deploys.
2. Before syncing, inspect Replit's Git status and preserve any uncommitted work. Do not reset or force-overwrite it.
3. Fetch and check out the review branch to preview it, or merge the reviewed PR and pull the updated default branch using Replit's Git interface or shell. Confirm the expected commit arrived.
4. Install with the committed lockfile if needed, run the existing checks, and start the existing web workflow. The artifact manifest supplies the build environment.
5. Publishing is a separate action when ready. A GitHub commit or credit refresh alone does not update a published Replit site.

Manual Git operations do not invoke Replit's AI Agent. Runtime and publishing remain subject to Replit account limits and any hosting charges; this repair does not change billing or start a deployment.
