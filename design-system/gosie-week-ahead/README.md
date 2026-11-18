# Gosie Week Ahead design system

An extracted, reusable reference for the visual language already present in the
Gosie Week Ahead web preview. This package documents the current implementation;
this documentation refresh does not change any application screen.

## Current adoption status

Week Ahead imports `tokens.css` from its `src/index.css`. Following explicit
approval, the system was applied to Week Ahead with readable semantic colors,
larger supporting text, wrapping layouts, and persistent demo disclosures.
See `docs/extraction-notes.md` for the application details. Marketing, mobile,
and pilot screens are outside this approval.

## Contents

- `tokens.css` — reusable color, typography, shape, focus, and motion tokens.
- `docs/AGENTS.md` — instructions for using this system in future UI work.
- `docs/components.md` — component patterns observed in the current app.
- `docs/extraction-notes.md` — current-source evidence, responsive rules, and
  accessibility caveats; distinguishes existing values from future guidance.
- `preview.html` — a self-contained visual reference.

## Source of truth and mobile synchronization

`tokens.css` is the source of truth for colors and the base radius shared with
Gosie Mobile. Mobile keeps its native-friendly semantic object in
`artifacts/gosie-mobile/constants/colors.ts`; the mapping is checked by
`check-mobile-token-sync.mjs`. Both the Week Ahead and mobile test commands run
that check, so a mismatch fails verification before it can drift unnoticed.

The mobile app may keep platform-specific tokens (including its dark palette
and colors not represented by this interface system) in its own file. The
check covers only shared light-palette roles and the shared base radius; it
does not authorize applying the rest of this design system to mobile screens.

The SVG files contain slightly different, original brand colors. Both are
documented rather than silently altered.

## Apply only with approval

Do not add imports, change shared tokens, or restyle the Week Ahead, marketing,
or mobile screens unless the user asks to apply the design system. The existing
Week Ahead import is left as found.
