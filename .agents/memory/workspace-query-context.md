---
name: Workspace query context
description: Prevent query-context splits when workspace clients resolve different pnpm peer variants.
---

Treat context-bearing libraries as shared runtime singletons across workspace
client packages. Deduplicating React alone does not unify React Query contexts.

**Why:** A root query provider existed, but a shared API client's separate pnpm
peer variant could not see it. Route matching and mocked client tests did not
exercise that boundary.

**How to apply:** When changing package peers or client bundling, test a real
shared-client hook beneath the consuming app's provider and check the built
browser output, not just development rendering or route matching.
