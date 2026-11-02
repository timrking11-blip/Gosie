---
name: Migration environment limitations
description: Caveats encountered recovering the failed Lovable migration setup
---

Do not assume that creating a web artifact repairs a failed migration's missing workspace root.

**Why:** In this environment artifact creation succeeded and produced a managed workflow,
but did not supply the root workspace files or shared packages referenced by its template.
The pnpm-workspace skill referenced by the migration rubric was also unavailable.

**How to apply:** Inspect actual workspace files and dependencies after artifact creation.
Supply only missing workspace configuration and avoid dangling template dependencies.

The testing subagent callback rejected the documented `testing` configuration as unknown
in this environment.

**Why:** The available testing skill did not match the callback's supported kinds.

**How to apply:** If this remains unsupported, use executable component interaction tests,
build checks, logs, and desktop/mobile screenshots; do not claim browser click testing occurred.
