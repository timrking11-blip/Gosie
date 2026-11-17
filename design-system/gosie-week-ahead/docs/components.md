# Observed component patterns

These patterns are extracted from `artifacts/gosie-week-ahead/src/App.tsx` and
`src/index.css`. They describe the current preview and its behavior; they are
not claims about a connected consumer product.

## Brand header and navigation

- Dark espresso header, Gosie wordmark, two primary destinations, and a small
  illustrative-preview indicator.
- The active destination uses a soft, translucent pill treatment.
- Links are semantic anchors with `aria-current` on the active page.

## Intro and demo badge

- Editorial Fraunces headline paired with Manrope supporting copy.
- Bronze eyebrow labels and a warm peach-backed badge identify sample content.
- Keep the demo disclosure visible near the content it describes.

## Week summary and event schedule

- A warm surface with a sage-tinted lead area and restrained borders.
- Day grouping uses a forest marker for weekend days and a light neutral marker
  for weekdays.
- Event rows pair time, category color, title, and a short supporting note.
- The grouping control exposes “By day” and “By kind” as pressed-state buttons.
  Both views represent the same events.

## Action checklist

- Espresso heading area above a light checklist surface.
- Native checkbox controls retain keyboard and assistive-technology behavior.
- Progress is supplemental; completed items also use a visible text treatment.
- The current preview stores checklist state only in this browser and says so.

## Weekend context and idea cards

- Context choices are compact, rounded buttons with `aria-pressed` state.
- Idea cards use espresso surfaces, cream text, and peach/gold accents.
- Fixed sample scores reorder the same ideas by selected context; they do not
  learn preferences.
- “Why this might fit” is a disclosure button with `aria-expanded`; the
  explanation remains plain text.
- Budget and travel labels are fixed examples, not editable preferences or
  verified estimates.

## Interaction and accessibility

- Focus rings use a 3px bronze outline with a 3px offset.
- Existing motion is brief and decorative; reduced-motion preferences disable
  transitions and animations.
- Keep essential labels above decorative microcopy in the hierarchy. The source
  has some very small metadata text, so new controls should not inherit those
  sizes by default.

## Color note

The interface uses `#17382b`, `#f5f0e5`, and `#ebaf86`-adjacent updated tokens.
The supplied SVG artwork embeds `#18372f`, `#f5f0e6`, and `#edad87`. The
differences are documented in `tokens.css`; artwork was not altered as part of
this extraction.
