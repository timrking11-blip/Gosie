---
name: Post-merge service environment
description: Vite artifact builds in post-merge setup may not inherit workflow environment values.
---

Post-merge setup runs from the workspace root and does not automatically receive each artifact's development-service environment. Gosie's Vite config requires `PORT` and `BASE_PATH` even for production builds.

**Why:** A post-merge build failed because those variables were present in the artifact service manifest but absent in the standalone setup runner.

**How to apply:** Before invoking an artifact build from post-merge setup, load required environment values from that artifact's service manifest; do not assume workflow variables carry over.
