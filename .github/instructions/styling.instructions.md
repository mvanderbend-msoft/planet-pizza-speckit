---
applyTo: "frontend/src/**/*.{tsx,css}"
description: Tailwind theming + visual conventions
---

# Styling instructions

This project is **light mode** with an alien / Area 51 theme. Don't introduce
a dark mode toggle unless explicitly requested.

## Palette (from `tailwind.config.js`)

- **Primary accent**: `alien-600` / `alien-700` (emerald) — buttons, links, headings.
- **Secondary accent**: `cosmic-600` / `cosmic-500` (purple) — eyebrows, decorations.
- **Surfaces**: `bg-white/80` with `backdrop-blur` for cards. Page background is a
  gradient from `sky2-50` → `cream-50` → `cream-100` (defined in `index.css`).
- **Text**: `text-slate-900` for body, `text-slate-700` for prose, `text-slate-500/600`
  for muted. Never use pure black or near-white grays on the cream background.

## Shared component classes (defined in `src/index.css`)

Always prefer these over rebuilding the styling inline:

| Class | Use for |
|---|---|
| `btn-primary` | Primary CTAs (Add to cart, Pay, Proceed) |
| `btn-secondary` | Secondary CTAs (Shop Merch, Return to base) |
| `card` | Any white frosted surface (product card, form, sidebar) |
| `input` | All form inputs, `<textarea>`, number fields |
| `eyebrow` | Small uppercase tracking-wide labels above headings |

If you find yourself repeating a class combo 3+ times, add it to `@layer components`
in `index.css` instead of copy-pasting.

## Typography

- Headings (`h1`–`h4`) automatically use `font-display` (Orbitron) via `@layer base`.
  Add `text-alien-700` (or similar) for color.
- Body text inherits `font-mono` (Space Mono). Use `font-display` for navigation
  and button labels.

## Don't

- Don't reintroduce the old `neon`, `space`, or pure-dark color tokens — they were
  removed in the light-mode pass.
- Don't use `text-white` on light backgrounds (use it inside `btn-primary` etc.).
- Don't add custom hex colors inline — extend `tailwind.config.js` instead.
- Don't add `dark:` variants unless asked.
