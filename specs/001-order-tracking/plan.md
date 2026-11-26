# Implementation Plan: Track Your Abduction (Order Tracking)

**Branch**: `001-order-tracking` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-order-tracking/spec.md`

## Summary

Earthlings can look up an order with **order number + email** on a new
`/track` page. If both match, they see a four-stage timeline, the items and the
total. Every miss returns one identical, non-revealing response.

Technically, the plan has five parts:

- **Data**: add a `tracking_stage` column (default `confirmed`, nothing advances it
  yet).
- **Lookup API**: add `POST /api/orders/track`, which runs a single combined
  id+email query and returns a dedicated `OrderTracking` shape with no personal
  details.
- **Purchaser access**: close the number-only `GET /api/orders/:id` gap with a
  24-hour **order access token**. It is returned once at checkout, hashed in the
  DB, kept in the purchasing browser's `localStorage`, and sent in a header.
- **Rate limit**: protect both read paths with a small hand-written in-memory limit
  (10/min, then a 60s cooldown).
- **Confirmation link**: the confirmation page links to `/track/:id`, which
  auto-loads using that token.

## Technical Context

**Language/Version**: TypeScript 5.4 (`strict`), Node.js ≥ 22.5  
**Primary Dependencies**: Express 4, `zod` 3, built-in `node:sqlite`, `node:crypto`; React 18, React Router v6, Vite, Tailwind. **No new dependencies.**  
**Storage**: SQLite (`backend/data/app.db`). Adds 3 columns to `orders` via `CREATE TABLE IF NOT EXISTS` plus an idempotent `ADD COLUMN` guard.  
**Testing**: No test runner (Constitution VI). Verify with `npm run build`, `curl`, and the browser walkthrough in [quickstart.md](./quickstart.md).  
**Target Platform**: Node server (:3001) and a modern browser SPA (:5173, `/api` proxied)  
**Project Type**: Web application (two-package monorepo: `backend/`, `frontend/`)  
**Performance Goals**: Tracking lookup is a single PK query, so it effectively returns instantly at MVP scale. The confirmation-to-tracking path takes 1 click (SC-004).  
**Constraints**: Hit and miss must not reveal whether an order exists (body and timing, SC-003). The email is never in a URL. The tracking response contains no name, address or email. Limit is 10 lookups per minute per source, then a 60s cooldown.  
**Scale/Scope**: MVP, single process. About 2 backend files changed and 1 added, 5 frontend files changed and 3 added, plus the README.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|---|---|---|
| I | Server is the source of truth | ✅ Pass | `zod` validates every body, param and header on the new and changed routes. `line_total_cents` is computed on the server from the checkout snapshot. Money stays in integer `*_cents`. The order + token insert stays inside the existing `BEGIN/COMMIT/ROLLBACK`. |
| II | Strict type safety | ✅ Pass | No `any`. Rows are narrowed with explicit row types, and request types are `z.infer`. `ApiError` is a typed class. |
| III | Consistent API contracts | ✅ Pass | All new fields are `snake_case`. `client.ts` mirrors the [contracts](./contracts/orders-api.md). The README API table is updated in the same change. The schema change updates `CREATE TABLE IF NOT EXISTS`, and the DB-reset fallback is called out (data-model, quickstart). |
| IV | Use the existing stack | ✅ Pass | No new runtime or dev dependencies. The rate limiter and token use `node:crypto` plus about 40 lines of code. Tailwind and shared classes only. |
| V | Planet Pizza voice | ✅ Pass | All copy is specified in [contracts/tracking-ui.md](./contracts/tracking-ui.md) and uses "earthling", "transmission", "mothership" and "drop coordinates". No emoji in identifiers. |
| VI | Green build quality gate | ✅ Pass | `npm run build` is required. API behavior is verified with `curl` per the quickstart. No test framework is added. |
| — | Scope constraints | ✅ Pass | No auth or accounts. The access token is a per-order capability, not a login. There are no notifications, no admin UI and no stage advancement (FR-012, FR-015). |

**Post-design re-check (after Phase 1)**: still all pass. The design introduces no
violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-order-tracking/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0: decisions R1–R11
├── data-model.md        # Phase 1: orders columns, stage enum, token, rate-limit state
├── quickstart.md        # Phase 1: build + curl + browser verification
├── contracts/
│   ├── orders-api.md    # POST /orders (changed), GET /orders/:id (changed), POST /orders/track (new)
│   └── tracking-ui.md   # routes, components, copy
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks, not created here)
```

### Source Code (repository root)

```text
backend/src/
├── index.ts                 # unchanged (ordersRouter already mounted at /api/orders)
├── db/index.ts              # MODIFY: orders gets tracking_stage, access_token_hash, access_expires_at; idempotent ADD COLUMN guard
├── lib/rateLimit.ts         # NEW: route-scoped in-memory limiter (10/60s, then 60s block), 429 + Retry-After
└── routes/orders.ts         # MODIFY: token on create; GET /:id requires X-Order-Access-Token;
                             #         NEW POST /track (email | access_token variants); explicit column lists

frontend/src/
├── App.tsx                  # MODIFY: routes /track and /track/:orderId
├── api/client.ts            # MODIFY: TrackingStage, OrderTracking, CreatedOrder, ApiError,
                             #         api.trackOrder, api.getOrder(id, token), order-access localStorage helpers
├── components/
│   ├── Layout.tsx           # MODIFY: "Track Your Abduction" nav entry
│   ├── TrackingLookup.tsx   # NEW: form + client validation + outcome states + result
│   └── TrackingTimeline.tsx # NEW: 4-stage done/current/upcoming timeline
└── pages/
    ├── CheckoutPage.tsx     # MODIFY: saveOrderAccess(...) after createOrder
    ├── OrderConfirmationPage.tsx # MODIFY: token-gated details, "Track your abduction" link, fallback to TrackingLookup
    └── TrackingPage.tsx     # NEW: /track and /track/:orderId (auto-lookup with stored token)

README.md                    # MODIFY: API table (GET /orders/:id header, POST /orders/track), layout/pages list
```

**Structure Decision**: Keep the existing two-package web app layout. New backend
logic stays in the existing `orders` router. The only new backend module is
`lib/rateLimit.ts`, which keeps limiter state out of the route file and can be
reused. Frontend additions follow the folder conventions: one page per route,
reusable pieces in `components/`, and all API and storage helpers in
`api/client.ts`.

## Implementation Notes (for /speckit.tasks)

1. **Order of work**: DB columns → router changes (create token, guard GET, add
   `/track`) → rate limiter → `client.ts` types/helpers → Checkout saves token →
   Timeline + Lookup components → TrackingPage + routes + nav → Confirmation page →
   README → `npm run build` → quickstart.
2. **Must not leak**: replace `SELECT *` in `loadOrder` with explicit columns.
   `access_token_hash` must never appear in a response.
3. **Same miss for every cause**: one shared `NOT_FOUND = { error: 'Order not found' }`
   constant for every 404 on these routes. The email and token queries must not
   branch on whether the id exists.
4. **Don't log** request bodies or tokens (backend instructions).
5. **DB reset note** for users: the guard handles existing DBs. If anything is
   off, delete `backend/data/app.db*` and restart.
6. **Known limitations** (documented, accepted for the MVP):
   - The rate limiter is in-memory, per process, keyed by `req.ip`. Through the Vite
     dev proxy, all clients share one bucket.
   - SQLite `lower()` only folds ASCII.
   - The token in `localStorage` is readable by same-origin scripts.

## Complexity Tracking

No constitution violations, so no entries are needed.
