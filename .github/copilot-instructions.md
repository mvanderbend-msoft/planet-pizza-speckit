# Planet Pizza — Copilot Instructions

Planet Pizza is an Alien / Area 51 themed webshop for pizzas and themed merchandise.
This file is read by GitHub Copilot for **every** request in this repo. Keep responses
aligned with the conventions below.

## Repository layout

This is a two-package monorepo (no workspaces tool — just `npm --prefix`):

```
backend/   Express + TypeScript REST API on :3001, SQLite via built-in node:sqlite
frontend/  React 18 + Vite + TypeScript + Tailwind SPA on :5173 (proxies /api)
```

Run both together from the repo root: `npm run dev` (uses `concurrently`).

## Tech stack & non-obvious choices

- **Database**: built-in `node:sqlite` (DatabaseSync). We did **not** use
  `better-sqlite3` — its native build fails on Windows ARM64.
- **Transactions**: `node:sqlite` has no `db.transaction(fn)` helper. Use explicit
  `db.exec('BEGIN'); try { ... db.exec('COMMIT'); } catch { db.exec('ROLLBACK'); throw }`.
- **Validation**: every request body / query is parsed with `zod` before touching the DB.
- **Prices are recomputed server-side** from the `products` table on every order —
  the client never dictates price.
- **No auth, no real payments, no admin UI** — this is an MVP. Don't add those unless
  asked. The "Pay" button just creates an order with `status='paid'`.
- **Pizzas are fixed menu items.** No size/topping customization.

## Conventions

- TypeScript everywhere; `strict: true` in both packages. Avoid `any` — prefer
  `unknown` + narrowing, or explicit types.
- Money is stored and transported as **integer cents** in fields named
  `*_cents` / `*Cents`. Format for display with `formatPrice` from `frontend/src/api/client.ts`.
- API responses use `snake_case` (matches SQLite columns). TypeScript types in
  `frontend/src/api/client.ts` mirror that — don't camelCase the API.
- Tailwind only — no inline `style` props, no CSS Modules, no styled-components.
- React: function components + hooks. Cart state lives in `CartContext` (localStorage-backed).
- React Router v6 (`<Routes>`, `<Outlet>`) — no `<Switch>`.
- No README files inside `backend/` or `frontend/` — the root `README.md` is the only one.

## Commands

| Task | Command |
|---|---|
| Install everything | `npm run install:all` (root) |
| Dev (both servers) | `npm run dev` (root) |
| Build both | `npm run build` (root) |
| Backend type-check + build | `npm --prefix backend run build` |
| Frontend type-check + build | `npm --prefix frontend run build` |
| Reset DB | delete `backend/data/app.db*` and restart |

Run the smallest validation that covers your change. The repo has **no tests** today;
do not invent a test runner. If you need to verify behavior, build the affected
package or hit the running API with `curl`.

## When changing the data model

1. Update the `CREATE TABLE` statements in `backend/src/db/index.ts` (use
   `CREATE TABLE IF NOT EXISTS` — there is no migration framework).
2. Update `SeedProduct` and `PRODUCTS` in `backend/src/db/seed.ts` if needed.
3. Update the TypeScript types in `frontend/src/api/client.ts` (keep snake_case).
4. Note for the user that they may need to delete `backend/data/app.db` to re-seed.

## Theme

Light mode, alien-themed. Palette is defined in `frontend/tailwind.config.js`:
- `alien.*` (emerald) — primary accent, headings
- `cosmic.*` (purple) — secondary accent, eyebrows
- Background gradient: sky-blue → cream → mint
- Display font: `font-display` (Orbitron). Body: `font-mono` (Space Mono).

Use the shared component classes from `src/index.css`:
`btn-primary`, `btn-secondary`, `card`, `input`, `eyebrow`. Don't recreate them inline.

## Domain conventions

Planet Pizza is a tongue-in-cheek Alien / Area 51 / UFO-themed brand.
Stay in character whenever generating user-facing copy, names, or assets.

- **Voice**: playful, conspiratorial, deadpan. Think X-Files, Roswell, Men in
  Black. Never crude, never political. Emoji 👽 🛸 🌌 are welcome in copy but
  not in identifiers.
- **Product names** mash up alien/UFO tropes with food/merch
  ("Roswell Margherita", "Abduction Pepperoni", "Mothership Meat Lovers",
  "Lil' Grey Plushie"). Keep them short — 2–4 words.
- **Descriptions** are 1–2 sentences, alien-flavored, end with a wink.
- **Recurring metaphors** (use, don't overload):
  - The cart is the **"cargo bay"**.
  - The customer is the **"earthling"**.
  - Email is the **"transmission"**, address is the **"drop coordinates"**.
  - Pizzas are **"hand-tossed in Hangar 18"**; merch is **"declassified gear"**.
  - Orders are **"confirmed by the mothership"**.
- **Categories** are exactly two — `'pizza'` and `'merch'`. Don't invent
  subcategories (no "drinks", "sides", "apparel") without an explicit ask.
- **SKU prefixes**: `PZ-` for pizzas, `MR-` for merch. SKUs are
  `UPPER-SNAKE`, unique across both categories.
- **Money** is integer cents in code, formatted as `$X.XX` for users via
  `formatPrice`. USD only.
- **Stock** defaults: 100 for pizzas, 50 for merch, 200 for stickers /
  high-volume items. No real inventory system — stock is checked but not
  decremented on order.
- **No real payment, no auth, no admin UI, no pizza customization** —
  this is an MVP. Adding any of those is a scope change; surface it as a
  question to the user rather than silently implementing.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/001-order-tracking/plan.md`
<!-- SPECKIT END -->
