# Reviewed discoveries: browser verification

Date: 18 November 2026.

## Scope and isolation

Tested the actual `/app?view=weekend` route and
`src/components/product/ResearchedDiscoveries.tsx` using live Chromium 155,
with a disposable browser profile and synthetic session/profile/catalog responses.
The fixture replaces browser API responses before app startup. It does not
authenticate against the backend, create an account, modify enrollment, change
the real catalog, contact a provider, or publish anything.

The ordinary unauthenticated screenshot still shows the sign-in gate. That is
separate evidence from the synthetic signed-in-view browser checks.
No product UI or CSS was changed for this verification.

## Reproduction

With the Gosie development workflow running and Chromium available:

```sh
node artifacts/gosie/discoveries-browser-check.cjs
```

The default target is the workspace preview domain; `GOSIE_BROWSER_URL` can
explicitly select another development origin. The harness captures screenshots
and machine-readable evidence under the ignored
`generated-artifacts/discovery-browser-check/` directory and closes its own
browser/profile afterward. It never reuses a personal browser session.

## Results

All six combinations passed: **360, 768 and 1280 CSS pixels**, each at normal
and **200% root text size**. Body copy measured 15.2px and 30.4px respectively.

| Width | Section width / scroll width | Findings at both text sizes |
| --- | --- | --- |
| 360 | 315 / 315 | No section horizontal overflow; long text wraps |
| 768 | 463 / 463 | No section horizontal overflow |
| 1280 | 861 / 861 | No section horizontal overflow |

Live browser keyboard events verified:

- Enter opens native evidence disclosure.
- Tab moves from the disclosure to the original-source link.
- Space closes it; Enter reopens it.
- Links retain the expected HTTPS destination, new-tab target,
  `noopener noreferrer`, and `no-referrer`.
- A simulated HTTP 503 produces the error state; keyboard Enter on Retry issues
  a second request and reaches the approved-only empty state at every width/scale.
- The populated fixture displays the stale warning, date distinctions, unknown
  limits and a deliberately long unbroken evidence excerpt.
- No uncaught browser runtime exceptions were observed.

Screenshots were captured for each populated width/scale with evidence expanded.
Desktop and narrow large-text images were also visually inspected. At 360px/200%
the long heading wraps heavily, including within long words, and the page requires
substantial vertical scrolling; this is not hidden or clipped content.
The Replit development banner and fixed app navigation are present in captures.

Separately, the existing web component suite passed **54 tests in 11 files**.
Those tests are not the live keyboard/layout checks above. No new production
build was needed or claimed for this test-script/documentation-only change.

## Limits and remaining risks

- Synthetic signed-in UI, not real sign-in, session isolation or persistence proof.
- No provider requests, external source-page navigation, source accuracy or prices
  were tested. Source destinations and security attributes were inspected in-browser.
- Root text resizing is not operating-system text scaling, browser zoom,
  screen-reader testing or real-phone verification.
- The harness does not prove comprehensive accessibility, every possible catalog
  shape or all dashboard controls. It targets reviewed discoveries.
- Retry success removes the focused retry control; the resulting empty paragraph
  has no explicit live-region/focus treatment in source. Screen-reader announcement
  and deliberate focus restoration need a separate improvement.
- The component validates only schema version and the records array at runtime.
  Unexpected malformed nested source/date fields remain a resilience risk outside
  these valid-fixture checks.

Initial harness startup/navigation and Enter-event problems were resolved in the
test driver (select the page target, allow startup to settle, send the native Enter
character event). These were not application failures. The final run passed.
