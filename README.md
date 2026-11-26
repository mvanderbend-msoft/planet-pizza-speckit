# 🛸 Planet Pizza

An Alien / Area 51 themed webshop for pizzas and merchandise.

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript + SQLite (via built-in `node:sqlite`)

## Prerequisites

- **Node.js ≥ 22.5** (uses the built-in `node:sqlite` module — tested on Node 24).
- npm 10+

## Setup

From the repo root:

```sh
npm run install:all
```

This installs root tooling (`concurrently`) plus dependencies in `backend/` and `frontend/`.

## Run in development

```sh
npm run dev
```

- Backend: http://localhost:3001 (REST API under `/api`)
- Frontend: http://localhost:5173 (Vite dev server; `/api` is proxied to the backend)

By default, the SQLite database is created at `backend/data/app.db` on first boot and auto-seeded with ~8 themed pizzas and ~6 merch items. Set `DB_PATH` to use a different location.

## Build for production

```sh
npm run build
npm start          # serves backend on port 3001
```

Frontend production assets are emitted to `frontend/dist/` — host them with any static file server (Vite preview, Nginx, etc.) and point them at the running backend via `VITE_API_URL`.

## Project layout

```
planet-pizza/
├── backend/
│   ├── src/
│   │   ├── db/           # SQLite connection, migrations, seed data
│   │   ├── routes/       # /api/products, /api/orders
│   │   ├── lib/
│   │   │   └── rateLimit.ts # Shared order lookup rate limiter
│   │   └── index.ts      # Express bootstrap
│   └── data/             # SQLite file (gitignored)
└── frontend/
    ├── public/images/    # SVG assets (UFO logo, placeholder)
    └── src/
        ├── api/          # Typed fetch client
        ├── components/   # Layout, ProductCard, TrackingLookup, TrackingTimeline
        ├── context/      # CartContext (localStorage-persisted)
        └── pages/        # Home, Catalog, ProductDetail, Cart, Checkout, OrderConfirmation, TrackingPage
```

The tracking page is available at `/track`; `/track/:orderId` opens a specific
order's tracking result when this browser has its unexpired order access token.

## API surface

| Method | Path                          | Description |
|-------:|-------------------------------|-------------|
| GET    | `/api/health`                 | Liveness probe |
| GET    | `/api/products?category=…`    | List products (optional `pizza` / `merch`) |
| GET    | `/api/products/:id`           | Single product |
| POST   | `/api/orders`                 | Create order (prices recomputed server-side); returns `access_token` and `access_expires_at` for 24-hour purchaser access |
| GET    | `/api/orders/:id`             | Fetch order with line items; requires the `X-Order-Access-Token` header |
| POST   | `/api/orders/track`           | Look up tracking by order number and email, or by order number and access token; returns stage, items, and total |

`POST /api/orders/track` and `GET /api/orders/:id` share a rate limit of 10
requests per minute per IP observed by Express (`req.ip`); excess requests receive
`429 Too Many Requests` with JSON `error: "Too many lookups"` and a one-minute
cooldown. The response includes `Retry-After` and `retry_after_seconds` for the
remaining cooldown.

## Notes & scope

- **MVP scope**: catalog browsing, cart, mock checkout, persisted orders.
- If the orders table misbehaves after a schema change, back up any data you need and stop the backend (and any other process using the database) before resetting it. Deleting the database permanently removes all orders and order items; startup seeds products only, not purchases. Delete the database file and its SQLite `-wal` and `-shm` files, if present: by default these are `backend/data/app.db`, `backend/data/app.db-wal`, and `backend/data/app.db-shm`. If `DB_PATH` is set, use that path and its corresponding `-wal` and `-shm` files instead. Restart the backend to recreate the database.
- **No real payment** — the "Pay" button just creates the order with status `paid`.
- **No auth / admin** — out of scope for the MVP.
- **Pizzas are fixed-menu items** — no size or topping customization.
- Product images reference per-item SVGs that don't exist; the UI falls back to a generic neon-UFO placeholder.

👽 *This site does not officially exist.*
