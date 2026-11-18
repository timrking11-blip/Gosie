# Gosie proactive public experience research

## Status and boundaries

This repository-runner implementation is **disabled and unconfigured**. No live
research, schedule activation, real source permission, provider purchase,
publication, or pilot-readiness check was performed. The approved catalog is empty.
The existing authenticated web pilot reads `/api/discoveries`; the promotional
site, separate Week Ahead illustration and mobile demo are not research clients.

No information pool was found in the inspected checkout or the locally available
`origin/main` file tree. This is not a fresh GitHub fetch or proof about private
Muse sources. The historical Muse Sunday refresh is not this pipeline.

This work is distinct from on-demand neighborhood/free-time discovery. It does
not connect user profiles to research, implement travel estimates, add discoveries
to plans, or change the fictional recommendation ranking/feedback IDs.

## Commands (Node 24, repository root)

```sh
node research/gosie/cli.cjs check
node --test research/gosie/research.test.cjs artifacts/api-server/research-catalog.test.js
node research/gosie/cli.cjs run
```

`check` is read-only. `run` in the shipped disabled state makes **zero external
requests** and writes only a local generated summary. Active runs update
`state.json`, never `approved.json`. A local exclusive lock and workflow
concurrency prevent overlapping runs. A crashed process may leave `.run-lock`;
confirm no research process is running before manually removing that lock.

## Explicit setup and approval required

1. In `config.json`, choose a coarse public region (not a participant address),
   categories, approved seed HTTPS page URLs, publisher/type and a permission note.
   Permission notes must cover automated fetching and storage of short excerpts.
   Source types are `official`, `publisher`, `tourism`, and `community`.
   Do not put credentials, profiles, feedback, personal plans, archives or
   participant identifiers in these files. This runner never reads pilot tables.
2. Review the provider's current pricing and terms separately. The prepared
   provider is Brave's public Web Search API; it is **not connected**. An agent-side
   search tool or the connected Eventbrite organizer API is not a substitute.
   Set a conservative `approvedCostPerSearchUsd` and `maxCostUsd` after approval.
   The budget records reserved cost at that configured rate, not a verified bill;
   it does not include GitHub runner costs. Configure provider-side caps too.
3. Provision the runner secret `GOSIE_RESEARCH_BRAVE_KEY` through the repository's
   secure secret settings, never a tracked file or browser variable. The workflow
   maps it to `BRAVE_SEARCH_API_KEY`. No secret was requested or configured here.
4. After explicit owner approval, set config `enabled: true` and repository
   variable `GOSIE_RESEARCH_ACTIVATED=1`. Both are required for live execution.
   Manual dispatch does not itself constitute approval.
5. Scheduling requires another explicit approval: set `scheduleEnabled: true`
   and uncomment the workflow's schedule. Hourly UTC polling evaluates the
   configured weekday/hour in its IANA timezone, including DST. Successful
   persisted runs suppress another run for six days. GitHub schedules can be
   delayed; a missed hour is not automatically caught up.

Requests have count, response-byte, per-request and run time limits, no retries,
and an estimated search-spend limit. Transport accepts HTTPS only, pins a checked
public IPv4 DNS address, rejects mixed/private DNS answers and **all redirects**,
and blocks IPv6 conservatively. Redirecting legitimate sources require an
approved final URL. New search sources produce untrusted leads only; they are
never added to the permanent source registry or fetched automatically. Rechecks
fetch only exact URLs still approved in the registry.

## Evidence contract and deliberate extraction limits

`contract.cjs` validates version 1 of the candidate/approved schema. Records carry
stable identity (normalized region/category/venue/title), source URLs and publisher,
short evidence excerpt/reference, optional publication date, first-seen and
last-checked timestamps, separately named opening/exhibit dates, explicit
verification and lifecycle flags. Costs, travel, hours, availability and
accessibility are **not inferred**.

The deterministic extractor reads JSON-LD names/descriptions and public search
snippets. It does not execute source scripts, follow source instructions, use an
LLM, or infer a restaurant has opened from a search hit. Search titles are leads,
not authoritative venue identities. Unsupported pages remain manual-review work.
Opening confirmation, exhibition dates, publication dates, and the reason an
experience matters must be established by a human against the original source.
Unknown dates remain null; first-seen is never presented as an opening date.

Same canonical identity merges across sources and preserves first-seen history.
Tracking parameters/fragments are removed from evidence URLs. Different article
headlines for the same place can require reviewer identity reconciliation:
normalize venue/title, recompute `identity(record)`, consolidate evidence and
retain the earliest first-seen timestamp. Do not merge different exhibits merely
because they share a venue or source page. Changed excerpts invalidate candidate
review and flag conflicting evidence; this is a conservative signal, not automatic
semantic understanding of a closure/delay. Reviewers must establish those statuses.

## Review and promotion

1. Download the workflow artifact containing **only** `state.json` and the run
   summary. Inspect it as untrusted public content. Commit the reviewed candidate
   state on a review branch so repeat runs retain first-seen/last-success history.
   The workflow does not push or open PRs with write credentials. Until candidate
   state is merged, another dispatch starts from the old repository baseline.
2. In `state.json`, normalize identity, verify each source, and replace the generic
   `why` text. Set `verification: "source-supported"` only after review.
   Supply `claimEvidence` indexes for non-unknown status and each non-null opening
   or exhibit date. Indexes refer to this record's evidence array.
   Publication date is not exhibit date. An announced opening is not confirmed open.
   Resolve `conflicting`/`date-review` flags rather than blindly clearing them.
3. Promote with a public reviewer label, not a private email:

   ```sh
   node research/gosie/cli.cjs promote EXPERIENCE_ID PUBLIC_REVIEWER_LABEL --reviewed
   ```

   This writes the local approved file with a digest binding material claims.
   It does not publish anything. New/materially changed entries require a new
   review. Closed/delayed records can be promoted to withdraw them from display.
4. Review the diff and submit a PR. Enable required owner review/branch protection
   separately; `CODEOWNERS` requests review but cannot enforce repository settings.
   Do not bypass the gate with direct writes to the approved catalog.

Failed/partial research never replaces the approved file. The API validates the
whole approved catalog; invalid replacements retain the last valid catalog in
that server process, or return an explicit empty/unavailable state after restart.
This is not durable backup or recovery. Server display flags stale records after
14 days and suppresses expired/closed/delayed/conflicting records. Candidate
freshness is configurable; the shipped serving/promotion ceiling is 14 days.
Approved freshness advances only through another reviewed promotion, not a silent
background write.

The authenticated discovery section labels source status, first-seen, checked
date, evidence and unknown constraints. It does not promise live availability or
that the item fits a user's limits. The existing fictional numeric ranking stays
separate. No personal information is sent to a provider.

## Verification in the current worktree

- Research/catalog fixtures: 16 passed (includes 3 catalog tests also in the API suite).
- API suite: 36 passed, including authenticated catalog access and existing
  ownership/registration/feedback checks. Synthetic accounts were cleaned up.
- Web suite: 29 passed across 7 files, including 3 discovery component checks.
- Web TypeScript and production build: passed with manifest `PORT=23967 BASE_PATH=/`.
- Disabled manual command: zero requests, zero estimated spend, no candidates.
- Restarted development web/API workflow: running without observed startup errors.
- The 360px screenshot reached the sign-in gate, **not** the signed-in discovery
  section. Component focus/retry/evidence tests are not browser keyboard or layout
  verification. Signed-in narrow-screen, keyboard, text scaling, live provider
  responses, GitHub Actions execution and published hosting remain unverified.

These results apply to the tested worktree patch, not an asserted clean commit,
remote GitHub revision, production deployment, or historical acceptance gate.
