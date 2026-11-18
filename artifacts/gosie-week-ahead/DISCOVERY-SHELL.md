# Offline discovery shell

The Weekend Ahead page now reserves a separate section for reviewed public-source
leads. It displays only explicitly marked, schema-validated records with a source
link, retrieval timestamp, short inclusion explanation, and verified/estimated/
unknown fact labels.

The configured list is deliberately empty. The preview has no approved entries
to display and no application-runtime public-search provider connected. The
section therefore says it is empty; it does not invent event results, query
Eventbrite organizer records, scrape websites, request location/dates, or make a
network call. Fictional ranked recommendations and their device-only sample
preferences stay in the separate section below.

Adding provider-backed search is not part of this shell. Before it can be
enabled, an owner must connect and approve a provider, inspect provider terms,
privacy fields and usage billing, then implement a secure runtime path and
source-backed integration tests. A returned search lead is not verified ticket
availability or a personalized recommendation.
