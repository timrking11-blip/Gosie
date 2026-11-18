# Revoked organization contributions: proposed re-review policy

This is a people-first policy proposal implemented for review, not approval to
appoint real operators, moderate real contributions or publish the pilot.

## Principles

Revoking representation is not a finding that every contribution is false.
Retain useful, credible local information regardless of whether its contributor
was a person, venue, restaurant, municipality or nonprofit. Recheck practical
details and public sources. Keep misleading, unsafe, outdated or advertising-only
material private. Never repeat private operator reasons or sensitive details publicly.

## What revocation does

- Stops future organization writes under that permission. A separately assigned
  individual-contributor or moderator permission remains separate.
- Leaves historical attribution and approved/pending status unchanged.
- Makes matching approved and pending contributions available in the private
  moderator re-review queue, including organization notes on events.
- Does not delete content, approve pending submissions or restore any permission.
- Re-granting representation does not erase outstanding historical reviews.

New contributions record the organization permission and version used at submission.
The author-account lock serializes submission, revocation and moderation decisions
so an in-flight write cannot silently use a revoked grant after revocation commits.

Legacy records lack this provenance. A historical account/attribution match is
explicitly **uncertain**, not proof of authorship or wrongdoing. Newly recorded
individual contributions are not matched merely because their attribution is similar.
Older revocation records are eligible for uncertain legacy matching without a backfill.

## Explicit actions

Every action requires another authorized moderator, CSRF protection, the observed
current status, and a private 10–1000 character explanation.

| Action | Effect |
| --- | --- |
| Retain current state | Close this revocation match without changing visibility; pending stays private and still requires ordinary moderation |
| Keep private / remove from feed | Set the item or note to rejected; remove approved content from public reads without deleting it |
| Dismiss uncertain match | For uncertain legacy matches only; record why the association is not applicable and leave status unchanged |

Ordinary moderation cannot approve or reject flagged pending content before its
organization re-review is resolved. Self-review is prohibited for all three actions,
even when the author is also a moderator. Stale or already-resolved decisions fail
instead of overwriting a newer decision.

Re-review decisions are retained privately with the original status and decision
reason. Keep-private reasons also appear to the contributor through their existing
private submission view. Retain/dismiss reasons remain in the moderator record;
a browsable historical-decision interface is separate work.

The public feed never includes revocation evidence, provenance fields, private
operator reasons, re-review explanations or account/reviewer identifiers.
Hiding an event also removes its nested notes from public reads; those notes are
not deleted or automatically assigned a different moderation status.

## Interfaces and limits

The shared web Communities panel has a separate moderator-only **Organization
access re-review** section, with submitted source/details, current state, match
certainty and per-record actions. The operator-access panel explains that existing
content is retained for moderators to re-review.

The queue returns the oldest 100 unresolved matches and explicitly signals when
more remain. Resolve matches and refresh to reach the remainder. No scheduling,
automatic publication, author-editing/withdrawal or new source connector is added.

The API protections apply to every client. Dedicated native-mobile re-review controls
are not implemented here; native moderators must use the web re-review workflow.
Native ordinary moderation cannot bypass a flagged pending record.

## Evidence

The implementation starts from clean worktree baseline
`3d33e93e33b6be1fbb59b4747a39fce1a0a09972`; checks exercise that revision plus
the uncommitted re-review patch, not a clean tested commit or production deployment.

`artifacts/api-server/hardening.test.js` covers preserved visibility/attribution,
recorded versus uncertain matches, individual posts, moderator-only access, self-review,
CSRF, reason validation, bypass prevention, stale status, retain-without-publication,
re-grants, explicit hiding of items/notes, owner reason visibility and public exclusion.
`artifacts/gosie/src/test/organization-rereview.test.tsx` checks policy copy,
valid reason gating, status-bound payloads, legacy dismissal, self-review controls
and reason retention after a failed request.

These are API/database integration and React component tests. They are not
authenticated live-browser or real-phone verification of this new interface.
No production database, provider connection or publication was changed.

On the patched worktree, `GOSIE_DB_ENV=test pnpm --filter @workspace/api-server test`
passed all 55 tests; `pnpm --filter @workspace/gosie test` passed 54 tests in 11 files.
Gosie and Week Ahead type checks passed. The Gosie production build passed with
`PORT=23967 BASE_PATH=/` (1,969 modules; 11.07 seconds). These results do not imply
native re-review controls, native build verification or a hosted release test.
