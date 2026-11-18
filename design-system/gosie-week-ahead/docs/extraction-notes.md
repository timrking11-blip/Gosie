# Extraction notes

## Scope and provenance

This reference describes the current Gosie Week Ahead demo, not a proposed
redesign or a claim about the private consumer application. Sources inspected:

- `artifacts/gosie-week-ahead/src/index.css`: theme mapping, component selectors,
  and media queries.
- `artifacts/gosie-week-ahead/src/App.tsx`: schedule, checklist, social contexts,
  and disclosure patterns.
- `artifacts/gosie-week-ahead/index.html`: Fraunces and Manrope Google Fonts
  stylesheet with `display=swap`.
- `design-system/gosie-week-ahead/tokens.css`: existing shared tokens.
- `artifacts/gosie-week-ahead/public/brand/gosie-mark.svg`: existing emblem.

The app already imported this package's tokens before the reference refresh.
The subsequent user-approved application added readable semantic roles and
updated Week Ahead's stylesheet (see below). The standalone HTML specimen uses system font fallbacks
unless Fraunces and Manrope are installed locally; it makes no external font
requests. It is a static visual reference, not a functioning product screen.

## Visual foundations

| Role | Existing value |
| --- | --- |
| Primary / selected | Forest `#17382B` |
| Soft accent | Sage `#99B6A5` |
| Canvas | Cream `#F5F0E5` |
| Warm accent | Peach `#EBAF86` |
| Text | Ink `#0A1016` |
| Deep panels | Espresso `#2B1B12` |
| Supporting accents | Gold `#D5AC7C`, Bronze `#946640` |
| Card surface / border | `#FAF6EF` / `#D8D7C9` |
| Display / UI | Fraunces / Manrope |
| Spacing tokens | 4, 8, 12, 16, 24, 32px |
| Card / control / pill radius | 18px / 10px / 999px |
| Focus outline | 3px bronze, 3px offset |
| Transition tokens | 200ms control, 250ms progress |

The source heading uses `clamp(46px, 7vw, 78px)` with tight line height.
Body text originally started at 14px. Before the approved application, source
controls and metadata included 8–12px sizes. These historical observations are
**not recommended minimum sizes** for new UI.

## Responsive behavior before application

- Above 900px: two-column content with a wider schedule, maximum page width
  1180px.
- At 900px and below: main content stacks; the aside becomes two columns.
  The last summary statistic is hidden in this range.
- At 620px and below: aside and category cards become one column; the summary
  lead spans both columns; the last statistic is restored. The header prototype
  label and section note are hidden.
- At 370px and below: tighter header, day marker, and event-row spacing.

These rules describe the pre-application CSS, not verified device behavior. Future
application should retain essential disclosures at every size, allow text to
wrap, and avoid reproducing hidden essential information or tiny labels.

## Accessibility caveats

Calculated WCAG sRGB contrast for the literal solid colors:

| Pair | Ratio | Normal text AA |
| --- | --- | --- |
| Forest on cream | 11.29:1 | Pass |
| Cream on espresso | 14.57:1 | Pass |
| Muted `#59635E` on cream | 5.48:1 | Pass |
| Bronze on cream | 4.36:1 | Below 4.5:1 |
| Subtle `#767F77` on surface | 3.84:1 | Below 4.5:1 |
| Sage on cream | 1.93:1 | Not a text pairing |

These are color-pair calculations, not an accessibility certification. Alpha
colors, actual rendered backgrounds, keyboard flows, zoom/text scaling, and
screen-reader output require separate testing when applying the system.
Preserve `aria-pressed` for selected buttons, `aria-expanded` for disclosures,
native checkboxes, visible focus, and reduced-motion support.

## Approved Week Ahead application

The user approved application to Week Ahead only. The stylesheet now uses:

- Readable small-label accent `#7A5233`: **5.99:1 on cream**.
- Quiet text `#5C655F`: **5.60:1 on surface**.
- Completed-item text `#626B64`: **5.12:1 on surface**.
- Peach focus on dark panels: **6.72:1 against forest**.
- A 12px metadata floor and 13–15px supporting/body text rather than 8–11px.
- Wrapping navigation, headings, titles and footer; all summary cells and demo
  disclosures remain displayed at every breakpoint.
- Three summary statistics below a full-width lead at tablet widths, stacking
  at 370px and below. Narrow event rows stack time above the title.

Brand artwork, base palette, fonts, sample content, routes and demo logic were
preserved. New text roles supplement—not replace—the decorative bronze and sage.
This is not a claim of a full accessibility audit or live interaction testing.

## Further application boundary

Marketing, mobile, and operational pilot screens were outside this approval.
Further design changes beyond this Week Ahead application require approval.
Keep illustrative events, fixed context ranking, sample budget/travel labels,
and browser-local checklist state clearly distinguished from live capabilities.
