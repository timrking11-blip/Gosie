# Gosie organization-access accessibility review

Date: 18 November 2026. Development evidence only; no release or pilot-readiness approval.

## Revision and scope

The initial worktree was clean at `34032edd58f9d7bf718835de252d9d761a10b164`.
The checks below exercised that baseline **plus the uncommitted accessibility patch**,
not that commit's clean tree. No remote history, production deployment or real
participant account was inspected or changed. No publishing occurred.

Scope: the signed-in operator workflow in `lib/community/OrganizationAccessPanel.tsx`,
its containing `lib/community/CommunityPanel.tsx`, and `lib/community/community.css`.
This is not the reviewed-discovery accessibility review or a native mobile review.

## Source findings and corrections

The baseline's inline revocation form did not define opening/cancellation focus.
Success refreshed the keyed operator panel without defining a surviving focus target.
Access errors displayed internal response codes.

The patch:

- Focuses the revocation reason when its inline form opens.
- Returns focus to the opener on Cancel or Escape; neither submits a decision.
- Focuses the surviving status notice after a successful action.
- Focuses readable error notices, retaining the operator's entered fields on failure.
- Refreshes stale access records with focus on the panel heading and confirmation reset.
- Disables editable fields during a write, requires nonblank account/name and a valid reason,
  and continues to reset confirmation when reviewed fields change.
- Allows long identifiers, names, review text and controls to wrap without fixed-height clipping.

The inline review is not a modal and does not trap focus. Server authorization,
version-bound revocation and self-management restrictions were not changed.

## Automated checks run

On the patched worktree:

| Command | Result |
| --- | --- |
| `pnpm --filter @workspace/gosie test` | 10 files, 50 tests passed; no failures |
| `pnpm --filter @workspace/gosie typecheck` | Passed |
| `PORT=23967 BASE_PATH=/ pnpm --filter @workspace/gosie build` | Passed; Vite production build, 1,968 modules, 10.25 seconds |
| `git diff --check` | Passed |

`artifacts/gosie/src/test/organization-access.test.tsx` now covers focus on success,
review opening, cancellation, errors and refresh, Escape cancellation, retained
reasons, and blank-field gating alongside its existing authorization/confirmation tests.
These are React component tests, not live browser evidence.
No API suite, native build or production validation was rerun for this frontend-only patch.

## Successful live browser observations

One signed-in development-browser journey used two newly created synthetic accounts:
an operator and a target. No real user was appointed.

- Logged in through the UI and opened `/app?view=community`.
- Used typing, Tab/Shift+Tab, native select keys, Space and Enter to grant nonprofit access.
  Editing the reason reset the checked confirmation and disabled Grant until reconfirmed.
- A successful grant returned HTTP 201 and focused the status notice.
- Keyboard activation of the revocation opener focused its reason field.
  Escape and then a separate Tab/Space cancellation restored opener focus without a POST.
- A short revocation reason disabled Confirm. A valid reason enabled keyboard confirmation;
  success removed the synthetic grant, recorded the decision, and focused the status notice.
- A reviewed grant to a nonexistent synthetic ID returned the real API's HTTP 404.
  The readable alert received focus and retained the ID, name and reason.
  Keyboard Refresh cleared the error, reset confirmation and focused the panel heading.
- Visible keyboard focus rings and sensible forward/backward order were observed.

The first fixture login failed because the tester seeded mixed-case emails while login
normalizes input to lowercase. Correcting only the synthetic fixtures resolved it;
this was not an application failure. HTTP 409 conflict messaging was covered by
the component test, not exercised as a live API conflict in this browser pass.

## Enlarged-text matrix

The tester reloaded at each viewport and tested a long 78-character organization name,
including an unbroken segment, with a grant and audit record present.

**Method:** simulate 200% text inside `.gc-root` and descendants only. Snapshot computed
font size and line height before applying doubled absolute pixel values, avoiding
compounded inheritance. The application shell, sidebar and bottom navigation remained
at 100%. This is not OS text scaling or native browser text-only zoom.

| Viewport | Panel result |
| --- | --- |
| 360 × 900 | No document/section horizontal overflow; form, revocation controls and audit text wrapped and remained reachable by vertical scrolling |
| 768 × 1000 | No horizontal overflow or clipped essential panel content; focused revocation field and controls stayed within the column |
| 1280 × 900 | No horizontal overflow; long names, identifiers and audit text wrapped within the viewport |

At 360px the deliberately long revocation opener grew very tall (approximately 500px);
it remained readable and reachable, rather than clipped. Revocation forms were inspected
and cancelled at enlarged text; a destructive confirmation was not repeated at every width.

Browser screenshot evidence in the review conversation includes `qxb1up` (360px focused
revocation at 200%), `0tue4o` (768px revocation), `2ulyev` (1280px current grants/audit),
`no9auy` (focused actual error), and `guoagh` (focus after refresh).

## Cleanup and limitations

The tester deleted its three access-review records, operator appointment, two users,
and cascading grant/session. An independent exact-ID query confirmed zero matching
users, operators, grants, sessions and review records afterward. No broad deletion
or real-account modification occurred.

Unverified: actual screen-reader announcements, measured focus-ring contrast,
native/mobile assistive technology, OS/browser zoom, enlarged surrounding application shell,
and other browser/engine combinations. Screenshots and component tests do not establish
those capabilities or production hosting behavior.
