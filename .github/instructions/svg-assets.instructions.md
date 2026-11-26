---
applyTo: "frontend/public/images/**/*.svg"
description: Conventions for product & decorative SVGs
---

# SVG asset instructions

All product imagery is **hand-authored SVG** living in `frontend/public/images/`.
There is no asset pipeline — files are served as-is by Vite.

## Naming

- `pizza-<slug>.svg` for pizzas (e.g. `pizza-margherita.svg`).
- `merch-<slug>.svg` for merchandise (e.g. `merch-mug.svg`).
- File names must exactly match the `image_url` value in `backend/src/db/seed.ts`.

## Canvas & shape

- `viewBox="0 0 400 400"` — square. Renders inside an `aspect-square` container.
- Include a background `<rect width="400" height="400" fill="url(#bg)"/>` using a
  light gradient (sky-blue → mint or cream → mint) so the image matches the
  page theme even when shown standalone.
- Keep total file size under ~3 KB. No `<image href>` or embedded base64.

## Palette guidance

Use colors from this small set so all assets feel cohesive:

| Use | Color |
|---|---|
| Page-background gradient stops | `#eef6ff`, `#ecfdf5`, `#fef9e7` |
| Alien green | `#10b981` / `#34d399` / `#047857` |
| Cosmic purple | `#a78bfa` / `#8b5cf6` |
| Pizza crust | `#d4a574` stroke `#a0764d` |
| Cheese | `#fde68a` / `#fef3c7` |
| Tomato sauce | `#ef4444` / `#dc2626` |
| Dark outline / eyes | `#0f172a` / `#1e293b` |
| Slate / neutral | `#cbd5e1` / `#475569` |

## Pizza template

Every pizza starts with the same three concentric circles, then toppings on top:

```xml
<circle cx="200" cy="200" r="155" fill="#d4a574" stroke="#a0764d" stroke-width="4"/>  <!-- crust -->
<circle cx="200" cy="200" r="135" fill="#fde68a"/>                                     <!-- cheese -->
<!-- optional sauce wash for red-sauce pizzas: -->
<circle cx="200" cy="200" r="130" fill="#ef4444" opacity="0.35"/>
```

Add a new pizza by varying the topping `<g>` groups. Look at
`pizza-supreme.svg` for a balanced layout of mixed toppings.

## Merch

Merch SVGs are illustrative rather than templated — feel free to vary the
composition, but keep the same background gradient and palette.

## Don't

- Don't reference external images or fonts inside SVGs.
- Don't add `<script>` tags or interactivity — these are static images.
- Don't use raster (`.png`, `.jpg`) for products. If a true photo is requested,
  ask the user first.
