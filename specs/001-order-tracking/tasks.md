---
description: "Task list for Track Your Abduction (order tracking)"
---

# Tasks: Track Your Abduction (Order Tracking)

**Input**: Design documents from `specs/001-order-tracking/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/orders-api.md](./contracts/orders-api.md), [contracts/tracking-ui.md](./contracts/tracking-ui.md), [quickstart.md](./quickstart.md)

**Tests**: No test tasks. The repo has no test runner and the constitution (VI) forbids
adding one. Each story ends with a verification task that uses `npm run build`, `curl`
and the browser steps in [quickstart.md](./quickstart.md).

**Organization**: Tasks are grouped by user story so each story can be built and
verified on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1, US2, US3 map to the user stories in [spec.md](./spec.md)

## Path Conventions

Two-package web app: `backend/src/` (Express + `node:sqlite` + zod) and
`frontend/src/` (React + Vite + Tailwind). Follow
`.github/instructions/backend.instructions.md`, `frontend.instructions.md` and
`styling.instructions.md`. No new dependencies.

---

## Phase 1: Setup

**Purpose**: Confirm a green baseline before changing anything.

- [ ] T001 Run `npm run build` from the repo root and confirm both `backend/` and `frontend/` build cleanly before any change (no files edited)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, safe order serialization and the shared frontend types that every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Add `tracking_stage TEXT NOT NULL DEFAULT 'confirmed' CHECK (tracking_stage IN ('confirmed','hand_tossed','tractor_beam','abducted'))`, `access_token_hash TEXT` and `access_expires_at TEXT` to the `CREATE TABLE IF NOT EXISTS orders` statement in backend/src/db/index.ts (data-model.md, research R1)
- [ ] T003 Add an idempotent upgrade guard at the end of `migrate()` in backend/src/db/index.ts: read `PRAGMA table_info(orders)` and run `ALTER TABLE orders ADD COLUMN ...` for each of the three columns that is missing, using the same definitions as T002 so existing rows backfill to `'confirmed'` (research R2)
- [ ] T004 [P] In backend/src/routes/orders.ts: add a shared `const NOT_FOUND = { error: 'Order not found' }` and use it for the existing 404; add explicit `OrderRow` / `OrderItemRow` types; rewrite `loadOrder()` to select an explicit column list (`id, created_at, customer_name, customer_email, shipping_address, total_cents, status, tracking_stage`) so `access_token_hash` and `access_expires_at` are never serialized, and select explicit item columns instead of `SELECT *`
- [ ] T005 [P] In frontend/src/api/client.ts: add `export type TrackingStage = 'confirmed' | 'hand_tossed' | 'tractor_beam' | 'abducted'`, add `tracking_stage: TrackingStage` to `Order`, add `OrderTrackingItem` and `OrderTracking` types exactly as in contracts/orders-api.md, and add `export class ApiError extends Error` with a public `status: number`
- [ ] T006 In frontend/src/api/client.ts: make `request()` throw `new ApiError(res.status, \`API ${res.status}: ${text}\`)` on non-2xx (same message format as today so existing callers keep working); let `fetch` rejections propagate unchanged so the UI can treat them as "signal lost" (research R9)

**Checkpoint**: `npm --prefix backend run build` and `npm --prefix frontend run build` pass; backend boots against an existing `backend/data/app.db` and new orders have `tracking_stage = 'confirmed'`.

---

## Phase 3: User Story 1 - Look up an order by number and transmission (Priority: P1) 🎯 MVP

**Goal**: From the nav, an earthling enters order number + email and sees the 4-stage timeline, items (name, quantity, line amount) and total.

**Independent Test**: Place an order, open **Track Your Abduction** from the nav, enter the number and ` earthling@example.com ` (different case/spaces) and confirm stage 1 is current, stages 2–4 upcoming, and items + total match checkout. No name, email or address appears in the response or UI.

### Implementation for User Story 1

- [ ] T007 [US1] In backend/src/routes/orders.ts add zod schemas for the tracking body: an `orderNumberSchema` that accepts string or number, trims, strips one leading `#` and surrounding spaces, requires `/^\d{1,10}$/`, and parses to an int in `1..2147483647`; and a `.strict()` email-variant object `{ order_number, email }` where email is trimmed, lowercased, `.email()`, max 200 (research R5, data-model "Tracking Lookup")
- [ ] T008 [US1] In backend/src/routes/orders.ts add `ordersRouter.post('/track', ...)`: on invalid body return `400 { error: 'Invalid', details: parsed.error.flatten() }`; otherwise run one prepared statement `SELECT id, tracking_stage, total_cents FROM orders WHERE id = ? AND lower(trim(customer_email)) = ?`; on miss return `res.status(404).json(NOT_FOUND)`; on match load `SELECT id, name_snapshot, quantity, unit_price_cents FROM order_items WHERE order_id = ?`, add server-computed `line_total_cents = unit_price_cents * quantity`, and respond with the `OrderTracking` shape only (`id, tracking_stage, items, total_cents`). Do not log request bodies (research R3, R4)
- [ ] T009 [P] [US1] In frontend/src/api/client.ts add `trackOrder: (body: { order_number: string; email: string }) => request<OrderTracking>('/orders/track', { method: 'POST', body: JSON.stringify(body) })` to `api`
- [ ] T010 [P] [US1] Create frontend/src/components/TrackingTimeline.tsx: props `{ stage: TrackingStage }`; a module-level ordered `TRACKING_STAGES` array of `{ id, label }` with the four labels from data-model.md; for current index `c`, render stage `i` as done (`i < c`, `alien-600` check), current (`i === c`, pulsing `cosmic-500`, `aria-current="step"`) or upcoming (`slate-400`), each with a visible text status so it doesn't rely on color; Tailwind only
- [ ] T011 [US1] Create frontend/src/components/TrackingLookup.tsx: a form with **Order number** (`input` class, `inputMode="numeric"`, placeholder `#42`) and **Email transmission** (`input` class, `type="email"`), submit `btn-primary` reading `Scan the skies` / `Scanning…`; on submit clear any previous result/message, call `api.trackOrder`, and render the result in a `card`: eyebrow `Order #{id}. Status decrypted.`, `<TrackingTimeline stage=... />`, heading `Itemized cargo manifest` with `name_snapshot × quantity` and `formatPrice(line_total_cents)`, and `Total charged` with `formatPrice(total_cents)`; on any error show the `noMatch` copy from contracts/tracking-ui.md (refined in US2)
- [ ] T012 [US1] Create frontend/src/pages/TrackingPage.tsx for `/track`: eyebrow `Classified tracking terminal`, heading `Track Your Abduction 🛸`, the intro copy from contracts/tracking-ui.md, then `<TrackingLookup />` with empty fields
- [ ] T013 [P] [US1] In frontend/src/App.tsx add `<Route path="/track" element={<TrackingPage />} />` inside the existing `<Layout />` route, above the `*` catch-all
- [ ] T014 [P] [US1] In frontend/src/components/Layout.tsx add a `NavLink to="/track"` labelled `Track Your Abduction` between **Merch** and **Cart**, styled like the existing nav links
- [ ] T015 [US1] Verify US1: `npm run build`; run quickstart.md §1 and the "match" command in §2 (expect 200 with `tracking_stage`, items with `line_total_cents`, `total_cents`, and no name/email/address); browser walkthrough step 3 match path, plus submit a second lookup and confirm the first result is replaced

**Checkpoint**: US1 works end-to-end from the nav. This is a shippable MVP.

---

## Phase 4: User Story 2 - Friendly, non-revealing message on no match (Priority: P1)

**Goal**: Every miss shows one identical in-character message; invalid input is caught before lookup; brute-forcing is throttled; "signal lost" is distinct from "no match".

**Independent Test**: Submit (a) a real number + wrong email, (b) a non-existent number, (c) the real email + wrong number. All three return byte-identical `404 {"error":"Order not found"}` with comparable timings and the UI shows the same `noMatch` copy. Invalid inputs show field prompts and send no request. The 11th lookup in a minute returns 429 and shows `cooldown`.

### Implementation for User Story 2

- [ ] T016 [P] [US2] Create backend/src/lib/rateLimit.ts exporting a single shared `lookupRateLimit` Express middleware: in-memory `Map<string, { windowStart: number; count: number; blockedUntil: number }>` keyed by `req.ip ?? 'unknown'`; if `now < blockedUntil` refuse; reset the window after 60s; when `++count > 10` set `blockedUntil = now + 60_000` and refuse; refusals return `429 { error: 'Too many lookups', retry_after_seconds: n }` with a `Retry-After: n` header; lazily prune entries whose window and block have both expired; do not enable `trust proxy` (research R8, data-model "Rate-limit state")
- [ ] T017 [US2] In backend/src/routes/orders.ts mount `lookupRateLimit` as route-level middleware on `POST /track` and `GET /:id` (one shared bucket, runs before zod and any DB access); do not add it globally in backend/src/index.ts
- [ ] T018 [US2] In backend/src/routes/orders.ts confirm the `/track` miss path never branches on whether the id exists: the single combined query from T008 is the only lookup, every miss returns `NOT_FOUND`, and invalid input always returns 400 (never 404) (FR-007, SC-003)
- [ ] T019 [US2] In frontend/src/components/TrackingLookup.tsx add client-side validation that mirrors research R5 (trim, strip one leading `#`, `/^\d{1,10}$/`, `1..2147483647`; trimmed email with a basic email check, max 200): show `required`, `invalidNumber` or `invalidEmail` copy under the relevant field and send **no** request when invalid; send the normalized order number and trimmed, lowercased email
- [ ] T020 [US2] In frontend/src/components/TrackingLookup.tsx replace the generic error handling with the outcome mapping from research R9: `ApiError` 404 → `noMatch` (one module-level constant string), 429 → `cooldown`, 400 → field prompts from `details.fieldErrors` (fallback `invalidNumber`), status ≥ 500 or a non-`ApiError` (network failure) → `signalLost`; any new submit clears the previous result and message first
- [ ] T021 [US2] Verify US2: `npm run build`; run the wrong-email vs non-existent-number and invalid-input commands in quickstart.md §2 (identical 404 bodies, comparable `time_total`, 400 for `4.2`, `-1`, `not-an-email`); restart the backend and run §4 (ten 404s, then 429 with `Retry-After`); browser walkthrough step 3 wrong-email path and step 5 (`signalLost` ≠ `noMatch`)

**Checkpoint**: US1 and US2 both work; the tracking page leaks nothing about which order numbers exist.

---

## Phase 5: User Story 3 - Jump to tracking from the order confirmation page (Priority: P2)

**Goal**: The purchasing browser gets a 24h order access token at checkout. The confirmation page shows full details only to that browser and links to `/track/:id`, which shows the result with no typing. Number-only access to order details is removed (FR-013).

**Independent Test**: Check out, click **Track your abduction →** on the confirmation page and see the timeline immediately with no email in the URL. Open `/order/<id>` and `/track/<id>` in a private window and get the form (number pre-filled) with no details. `GET /api/orders/<id>` without the header returns 404.

### Implementation for User Story 3

- [ ] T022 [US3] In backend/src/routes/orders.ts `POST /`: import `randomBytes` and `createHash` from `node:crypto`; generate `accessToken = randomBytes(32).toString('base64url')`, store `createHash('sha256').update(accessToken).digest('hex')` as `access_token_hash` and `new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()` as `access_expires_at` in the existing `INSERT` inside the `BEGIN/COMMIT` transaction; respond `201` with `{ ...loadOrder(id), access_token, access_expires_at }` (research R6)
- [ ] T023 [US3] In backend/src/routes/orders.ts `GET /:id`: validate `id` with zod (positive int → 400 if malformed); read `X-Order-Access-Token`, and if it is missing or doesn't match `/^[A-Za-z0-9_-]{43}$/` return `404 NOT_FOUND`; otherwise check `SELECT id FROM orders WHERE id = ? AND access_token_hash = ? AND access_expires_at > ?` (hash of header, `new Date().toISOString()`); miss → `404 NOT_FOUND`, match → `loadOrder(id)` (research R7, contracts/orders-api.md)
- [ ] T024 [US3] In backend/src/routes/orders.ts extend the `/track` body schema to a union of two `.strict()` objects — `{ order_number, email }` and `{ order_number, access_token }` with `access_token` matching `/^[A-Za-z0-9_-]{43}$/` — so both-or-neither returns 400; for the token variant query `SELECT id, tracking_stage, total_cents FROM orders WHERE id = ? AND access_token_hash = ? AND access_expires_at > ?` and reuse the same item loading and `NOT_FOUND` miss as the email variant
- [ ] T025 [P] [US3] In frontend/src/api/client.ts: add `CreatedOrder = Order & { access_token: string; access_expires_at: string }` and make `api.createOrder` return it; change `api.getOrder(id, accessToken)` to send the `X-Order-Access-Token` header; widen `api.trackOrder` to also accept `{ order_number: string | number; access_token: string }`; add `saveOrderAccess(id, token, expiresAt)`, `getOrderAccess(id)` (returns token or `null`, prunes expired entries, tolerates bad JSON) and `clearOrderAccess(id)` backed by `localStorage` key `planet-pizza-order-access` (`Record<string, { token; expires_at }>`)
- [ ] T026 [US3] In frontend/src/pages/CheckoutPage.tsx call `saveOrderAccess(order.id, order.access_token, order.access_expires_at)` right after `api.createOrder` succeeds and before navigating to `/order/:id`
- [ ] T027 [US3] In frontend/src/components/TrackingLookup.tsx accept props `initialOrderNumber?: string`, `orderId?: number`, `accessToken?: string`: pre-fill the order number from `initialOrderNumber`; when `orderId` and `accessToken` are both set, auto-lookup on mount via the token variant and show the result with no submit; if that lookup returns 404, call `clearOrderAccess(orderId)` and fall back to the form with the number pre-filled and email empty (research R10)
- [ ] T028 [US3] In frontend/src/pages/TrackingPage.tsx read the optional `:orderId` param; when present and a positive integer, pass `initialOrderNumber`, `orderId` and `getOrderAccess(orderId)` to `<TrackingLookup key={orderId} ... />`; keep `/track` behavior unchanged
- [ ] T029 [US3] In frontend/src/App.tsx add `<Route path="/track/:orderId" element={<TrackingPage />} />` next to the `/track` route
- [ ] T030 [US3] Update frontend/src/pages/OrderConfirmationPage.tsx: look up `getOrderAccess(id)`; with a token call `api.getOrder(id, token)` and render the existing full details plus a `Link to={\`/track/${order.id}\`}` reading `Track your abduction →` (`btn-primary`); on 404 call `clearOrderAccess(id)` and fall back; without a valid token render eyebrow `Restricted file`, the no-token intro from contracts/tracking-ui.md and `<TrackingLookup initialOrderNumber={id} />` — never show items, total, name or address in the fallback
- [ ] T031 [US3] Verify US3: `npm run build`; run quickstart.md §1 (`access_token` length 43, no `access_token_hash`) and §3 (404 without header, 200 with header, 200 for token tracking); browser walkthrough steps 1, 2, 4 and optionally 6

**Checkpoint**: All three stories work independently; number-only access to order details is gone.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs, leak review and the final green build.

- [ ] T032 [P] Update README.md: API table (`POST /api/orders` returns `access_token` + `access_expires_at`; `GET /api/orders/:id` requires `X-Order-Access-Token`; new `POST /api/orders/track`; 429 rate limit), pages/routes list (`/track`, `/track/:orderId`), new files (`backend/src/lib/rateLimit.ts`, `TrackingLookup`, `TrackingTimeline`, `TrackingPage`), and the "delete `backend/data/app.db*` if the orders table misbehaves" note
- [ ] T033 Review backend/src/routes/orders.ts and backend/src/lib/rateLimit.ts for leaks: no `SELECT *` on `orders`, `access_token_hash` never in any response, no `console.log` of bodies, emails or tokens, every tracking/order miss uses `NOT_FOUND`
- [ ] T034 Run `npm run build` from the repo root and fix any type errors
- [ ] T035 Run the full [quickstart.md](./quickstart.md) (§0–§5) against `npm run dev` and confirm every expected result

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. Blocks all stories.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on Foundational; builds on the `/track` route (T008) and `TrackingLookup` (T011) from US1.
- **US3 (Phase 5)**: depends on Foundational; extends the `/track` route (T008) and `TrackingLookup` / `TrackingPage` (T011, T012) from US1. Independent of US2.
- **Polish (Phase 6)**: depends on all stories you intend to ship.

### User Story Dependencies

- **US1 (P1)**: standalone after Foundational.
- **US2 (P1)**: hardens US1's lookup; ship together with US1 (it is a privacy guarantee, not polish).
- **US3 (P2)**: reuses US1 components; can be built in parallel with US2 once US1 is done, but T017 (US2) and T022–T024 (US3) both edit backend/src/routes/orders.ts, so serialize those edits.

### Within Each Story

- Backend schema/route before frontend calls.
- `client.ts` helpers before the components that use them.
- Components before the page, page before the route/nav entry.
- Verification task last.

### Task-level dependencies

- T003 → T002 · T006 → T005
- T008 → T007, T004 · T011 → T009, T010 · T012 → T011 · T013 → T012
- T017 → T016, T008 · T019, T020 → T011
- T023 → T022 · T024 → T022, T008 · T026 → T025 · T027 → T025, T011 · T028 → T027 · T029 → T028 · T030 → T025, T027

---

## Parallel Examples

### Foundational

```text
Task: "T004 Explicit loadOrder columns + NOT_FOUND in backend/src/routes/orders.ts"
Task: "T005 TrackingStage / OrderTracking / ApiError types in frontend/src/api/client.ts"
```

(T002 → T003 run in sequence alongside them, in backend/src/db/index.ts.)

### User Story 1

```text
# While T007–T008 are being written in backend/src/routes/orders.ts:
Task: "T009 api.trackOrder in frontend/src/api/client.ts"
Task: "T010 TrackingTimeline in frontend/src/components/TrackingTimeline.tsx"
# After T012:
Task: "T013 /track route in frontend/src/App.tsx"
Task: "T014 nav entry in frontend/src/components/Layout.tsx"
```

### User Story 2

```text
Task: "T016 lookupRateLimit in backend/src/lib/rateLimit.ts"
Task: "T019 client-side validation in frontend/src/components/TrackingLookup.tsx"
```

### User Story 3

```text
# While T022–T024 are being written in backend/src/routes/orders.ts:
Task: "T025 CreatedOrder, getOrder(id, token), access storage helpers in frontend/src/api/client.ts"
```

---

## Implementation Strategy

### MVP first (US1 + US2)

1. Phase 1 → Phase 2.
2. Phase 3 (US1) → **validate** with T015.
3. Phase 4 (US2) → **validate** with T021. US1 alone works, but don't ship it without US2's non-revealing misses and rate limit.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. US1 → lookup works from the nav.
3. US2 → privacy-safe misses, validation, cooldown, signal lost. **Ship (MVP).**
4. US3 → confirmation link, 24h access token, number-only gap closed. **Ship.**
5. Polish → README, leak review, full quickstart.

### Notes

- If the backend misbehaves on the `orders` table after T002/T003, delete `backend/data/app.db*` and restart (re-seeds automatically).
- Known, accepted MVP limits: in-memory per-process limiter keyed by `req.ip` (all dev traffic shares one bucket via the Vite proxy), ASCII-only `lower()`, and a `localStorage` token readable by same-origin scripts.
- Commit after each task or logical group.
