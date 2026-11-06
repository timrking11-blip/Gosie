# Gosie read-only baseline handover — 6 November 2026

This note records the read-only repository baseline reviewed on 6 November 2026. It is not pilot-readiness approval and does not approve a source of truth, host, database, or next implementation scope.

## Revision findings

- GitHub `main` was `1e0ce3d82187c2cbbea4f2341ff1e21b1d89813f`.
- The `timrking11-blip-gosie-csrf-pins` branch tip was `86657e546d9bc0fcefd088b1f3a71b5baa0e926e`. It diverges from `main`; both histories share `b2c610287f7180c765a7f51eb42b87d53c8d3b77`, and neither tip contains the other. PR #4 merged the shared commit, not the branch tip.
- The inspected Replit worktree was at `5745d7ad82c4c0f708890e0724850d74a05337cd`. GitHub lookup found no commit with that SHA in `timrking11-blip/Gosie`. This does not establish patch equivalence with any GitHub commit.
- No Replit deployment revision ID was observed. The worktree SHA is not a substitute for a deployment revision.

## Scope and authorization

- The promotional website, mobile demo, API source, and private Muse prototype are separate things; promotional or prototype screens do not establish operational product behavior.
- The reviewed roadmap leaves B3, B4, and Gate 2 unauthorized.
- Calendar access, connectors, and publishing are not authorized.
- This handover does not claim pilot readiness and does not select a source, host, database, or next scope.

## Evidence limits

The revision observations above describe the inspected repository and public GitHub records at the time of review. They do not prove which revision is deployed, whether SQLite data survives restart or redeploy, or that API security behavior is active on a deployed service.

## Worktree verification addendum — 6 November 2026

These are local worktree results, not GitHub Actions, production, or published-preview results. The exact source revision tested was `a3c4e78f8c0c9d39c2c26009b58bd298c9e5d9c7` (`main`). The worktree was clean immediately before the checks, and `HEAD` was unchanged afterward. The reviewed GitHub `main` remains `1e0ce3d82187c2cbbea4f2341ff1e21b1d89813f`; no push or deployment was performed, and this addendum does not claim the tested SHA or results are on that remote.

| Check | Result at `a3c4e78f8c0c9d39c2c26009b58bd298c9e5d9c7` |
| --- | --- |
| `pnpm --filter @workspace/gosie test` | Pass: 11 tests across 2 files |
| Gosie production build | Pass with `PORT=23967 BASE_PATH=/`, matching `artifacts/gosie/.replit-artifact/artifact.toml` |
| `pnpm --filter @workspace/gosie-mobile typecheck` | Pass |
| `pnpm --filter @workspace/gosie-mobile build` | Pass: iOS and Android bundles and manifests generated |
| `pnpm --filter @workspace/gosie typecheck` | Fail: two existing TS2305 errors for `Group` and `Separator` in `artifacts/gosie/src/components/ui/resizable.tsx`; unchanged here |

The mobile Expo development workflow started and bundled the Weekend Ahead route. This is startup evidence only, not native-device or interactive behavior verification.

The first static capture at `/weekend` was blank. A later static capture of `/(tabs)/weekend` at 360px showed the budget/travel controls fitting and the temporary/demo-only wording visible. This does not establish that the mobile preview is fully verified: selector taps were not exercised, and larger text and selected-state accessibility were not checked.

The mobile build regenerated `artifacts/gosie-mobile/static-build/` output after the clean pre-check snapshot. These generated files are local build output, not evidence of a source commit on GitHub `main`.
