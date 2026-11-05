# Using the Gosie Week Ahead design system

Read this file and `../tokens.css` before authoring UI for a Gosie Week Ahead
surface.

## Brand and visual rules

- Use the interface tokens from `../tokens.css`; do not introduce a competing
  palette or font pairing.
- Use Fraunces for editorial/display text and Manrope for controls, navigation,
  metadata, and body text. Keep the listed system fallbacks.
- Use forest for primary actions and selected states, cream for the main canvas,
  espresso for deep emphasis surfaces, and peach/gold/bronze as accents.
- Reuse the supplied Gosie assets from
  `artifacts/gosie-week-ahead/public/brand/` when a Gosie mark or wordmark is
  needed. Do not redraw or recolor the logo without explicit approval.
- Preserve the existing distinction between illustrative demo content and
  connected or verified product data. Do not imply calendar access, live
  listings, learned personalization, or cloud persistence unless implemented.

## Components and behavior

- Follow the existing patterns documented in `components.md` for navigation,
  event groups, context filters, explanations, cards, and checklists.
- Use semantic buttons, links, labels, and form controls. Provide visible
  `:focus-visible` treatment using the focus tokens.
- Keep text and controls readable at mobile widths; allow content to wrap and
  layouts to grow rather than clipping.
- Respect `prefers-reduced-motion`. Motion must not carry essential meaning.
- Clearly disclose browser-local state and illustrative scores when those
  patterns are reused.

## Scope

This is a reference system, not authorization to restyle existing screens.
Apply it to existing Gosie screens only after the user explicitly approves.
