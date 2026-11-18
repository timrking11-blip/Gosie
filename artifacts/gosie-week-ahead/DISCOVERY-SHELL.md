# Offline discovery shell

The Weekend Ahead page has a separate public section for reviewed public-source
leads. It loads only approved, schema-validated records from Gosie's authenticated
API, with a source link, retrieval timestamp, short inclusion explanation, and
verified/estimated/unknown fact labels.

The list is empty until a moderator adds and approves a real source-backed lead.
The moderator workspace requires an authenticated Gosie account with the
moderator role. Drafts and withdrawn records are private. Saving an edit to an
approved record makes it private again until a different moderator approves the
new version. Source and retrieval timestamp stay attached; unknown facts stay
unknown. Review actions are retained in a private history table.

This workflow does not connect a live-search provider, scrape websites, query
Eventbrite organizer records, request a visitor's location or dates, or invent
results. Fictional ranked recommendations and their device-only sample
preferences stay in the separate section below.

Provider-backed search remains separate and disabled. Before it can be enabled,
an owner must connect and approve a provider, inspect provider terms, privacy
fields and usage billing, then implement a secure runtime path and source-backed
integration tests. A reviewed lead is not verified ticket availability or a
personalized recommendation.
