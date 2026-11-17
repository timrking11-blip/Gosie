# Gosie Week Ahead design system

An extracted, reusable reference for the visual language already present in the
Gosie Week Ahead web preview. This package documents the current implementation;
it does not change or automatically theme any application screen.

## Contents

- `tokens.css` — reusable color, typography, shape, focus, and motion tokens.
- `docs/AGENTS.md` — instructions for using this system in future UI work.
- `docs/components.md` — component patterns observed in the current app.
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

This package is standalone. Do not import its tokens into the Gosie Week Ahead,
marketing, or mobile screens unless the user asks to apply the design system.
