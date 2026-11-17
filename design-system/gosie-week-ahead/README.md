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

## Source of truth

The extraction uses:

- `artifacts/gosie-week-ahead/src/index.css`
- `artifacts/gosie-week-ahead/src/App.tsx`
- `artifacts/gosie-week-ahead/public/brand/gosie-mark.svg`
- `artifacts/gosie-week-ahead/public/brand/gosie-wordmark.svg`
- `artifacts/gosie-mobile/constants/colors.ts`

The values in `tokens.css` reflect the web interface tokens. The SVG files
contain slightly different, original brand colors. Both are documented rather
than silently altered.

## Apply only with approval

Do not add imports, change shared tokens, or restyle the Week Ahead, marketing,
or mobile screens unless the user asks to apply the design system. The existing
Week Ahead import is left as found.
