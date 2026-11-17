---
name: Deployment runtime guard
description: Use the documented deployment flag instead of the platform environment label for safety gates.
---

Use `REPLIT_DEPLOYMENT === '1'` to identify a published runtime, with
`NODE_ENV === 'production'` as an additional application-level safety check.
Do not infer that the workspace targets production from `REPLIT_ENVIRONMENT`.

**Why:** In this workspace the platform environment label was `production` even
while the managed database tooling and workspace connection targeted development.
That caused focused tests to refuse a safe development run. Replit's official
configuration documentation identifies `REPLIT_DEPLOYMENT` as the deployment
flag; `REPLIT_ENVIRONMENT` describes the platform environment.

**How to apply:** Keep explicit test/development opt-ins, refuse published
runtimes, and verify the database target before writes. Do not override a
production flag or copy production credentials to make a test pass.
