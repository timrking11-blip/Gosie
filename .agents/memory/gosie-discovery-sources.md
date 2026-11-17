---
name: Gosie discovery sources
description: User's intended live discovery sources and the boundary around private template integrations.
---

Gosie's intended external discovery sources are Eventbrite and public web search. Keep the private Personal Intelligence Template's Ticketmaster access separate; do not treat the workspace owner's organizer event list as public event discovery.

**Why:** The user specified Eventbrite plus web-sourced discoveries while clarifying that Ticketmaster belongs to a separate private template and does not represent a general local-event aggregator.

**How to apply:** Before connecting a runtime provider, verify that its current API supports public discovery, that the application runtime can securely call it, and that result facts can be linked to their source. Do not substitute public-site scraping for an unavailable API without checking source terms and getting approval.
