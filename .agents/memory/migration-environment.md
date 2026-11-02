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

Testing helper support can change within this project's sessions.

**Why:** The documented `testing` configuration initially failed as unknown, but a later
Build-mode assignment on 2026-11-02 accepted the same configuration and completed real
browser interaction, responsive, and reduced-motion checks successfully.

**How to apply:** When browser verification is requested, try the current documented
callback before repeating an old tooling-blocker claim. Report what actually ran.
If unsupported, distinguish component tests and screenshots from real browser interaction.
