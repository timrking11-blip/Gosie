---
name: Brave Search result handling
description: Retention and user-facing constraints for connected Brave Search results in Gosie.
---

For Gosie’s connected Brave Search API, keep provider search results transient. Do not cache, persist, or add snippets to Gosie’s reviewed discovery catalog. Require explicit user submission and show what fields are sent, the source links, and the fact that search results are not verified events.

**Why:** Brave Search API terms prohibit storing or caching search results except transiently for application operation, and require end users to accept substantially similar restrictions with an appropriate privacy notice and consent.

**How to apply:** Use a server-side connector call from the authenticated app, send only the explicitly submitted coarse region/date/category, keep results in page memory, and never infer verified availability or personal fit from a web result.
