# Research: Track Your Abduction (Order Tracking)

**Feature**: `001-order-tracking` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

The Technical Context had no open `NEEDS CLARIFICATION` items after the spec's
clarification session. This document records the design decisions that turn the
clarified spec into a concrete approach on the existing stack.

---

## R1. Where the tracking stage lives

- **Decision**: Add a `tracking_stage TEXT NOT NULL DEFAULT 'confirmed'` column to
  `orders`, with a `CHECK` restricting it to `confirmed`, `hand_tossed`,
  `tractor_beam`, `abducted`. Keep the existing `status` column (`'paid'`) unchanged.
  It describes payment, not delivery.
- **Rationale**: FR-011 requires every order to have exactly one current stage. A
  column with a default makes new orders start at stage 1 automatically. Stable
  `snake_case` identifiers keep the API on-convention (Constitution III). The
  user-facing labels live only in the frontend.
- **Alternatives considered**:
  - *Separate `order_stage_events` history table*: this gives a timeline with
    timestamps, but nothing advances stages in this release (FR-012). It would be
    unused complexity.
  - *Reuse `status`*: this mixes payment state with delivery state and would change
    the meaning of an existing field.
  - *Derive the stage at read time (always "confirmed")*: this violates FR-011 and
    would force a schema change later anyway.

## R2. Upgrading existing local databases

- **Decision**: Update the `CREATE TABLE IF NOT EXISTS orders` statement with the
  new columns. In `migrate()`, also add a small idempotent guard that checks
  `PRAGMA table_info(orders)` and runs `ALTER TABLE orders ADD COLUMN ...` for each
  missing column. Still document "delete `backend/data/app.db*`" as the fallback.
- **Rationale**: The spec assumes existing orders show as stage 1. `ADD COLUMN ...
  DEFAULT 'confirmed'` backfills them for free. Without the guard, an existing DB
  keeps the old table shape and every tracking query fails. This is a few lines,
  not a migration framework. It's additive only and doesn't add a dependency.
- **Alternatives considered**:
  - *Require a DB reset*: this is simplest, but it silently breaks the dev server
    for anyone who doesn't read the note and throws away existing test orders.
  - *A migration library*: this is a new dependency (Constitution IV) for two
    columns.

## R3. Lookup endpoint shape (number + email)

- **Decision**: `POST /api/orders/track` with a JSON body. The response is a
  dedicated `OrderTracking` shape (`id`, `tracking_stage`, `items`, `total_cents`).
  It contains no name, address or email.
- **Rationale**: A POST body keeps the email out of URLs, browser history, proxy
  logs and `Referer` headers (FR-010 spirit, FR-006). A dedicated response shape
  makes it structurally impossible to leak personal details through the tracking
  path.
- **Alternatives considered**: `GET /api/orders/:id?email=…` puts the email in the
  URL and logs. Reusing the full `Order` shape risks leaking `customer_name` and
  `shipping_address`.

## R4. Non-revealing "no match" and equal timing (FR-007, SC-003)

- **Decision**: Run one prepared statement that matches id AND normalized email
  together:
  `SELECT id, tracking_stage, total_cents FROM orders WHERE id = ? AND lower(trim(customer_email)) = ?`.
  Load items only on a match. Every miss (no such id, or wrong email) returns the
  identical `404 { "error": "Order not found" }`.
- **Rationale**: Both miss cases run the exact same primary-key lookup and return
  the same bytes, so neither the body nor the timing can tell them apart. Fetching
  the row first and comparing the email in JS would branch on existence.
- **Normalization**: The server's zod schema trims and lowercases the email. SQL
  applies `lower(trim(...))` to the stored value, because checkout stores the
  email exactly as typed. SQLite's `lower()` only folds ASCII. That's acceptable
  for an MVP, and non-ASCII local parts are rare. This is noted as a known
  limitation.

## R5. Order number parsing (FR-008, edge cases)

- **Decision**: `order_number` is accepted as a string or number. The zod
  preprocessing trims it, strips one leading `#` and surrounding spaces, and
  requires `/^\d{1,10}$/`. It then parses to an integer and requires
  `1 ≤ n ≤ 2_147_483_647`. Leading zeros are naturally tolerated (`"#0042"` → 42).
  Anything else (letters, decimals, negatives, too large) returns `400` with
  field-specific `details`. It is never treated as a miss.
- **Rationale**: This matches the edge-case list exactly, keeps validation on the
  server (Constitution I), and stays far below `Number.MAX_SAFE_INTEGER`. The
  frontend mirrors the same rules, so invalid input never triggers a request (FR-008
  "no lookup is attempted").

## R6. "The browser that placed the order" — 24h access (FR-010, FR-013)

- **Decision**: When `POST /api/orders` succeeds, the server generates a random
  **order access token** (`crypto.randomBytes(32)`, base64url). It stores only its
  SHA-256 hash in `orders.access_token_hash`, plus `orders.access_expires_at`
  (ISO-8601 UTC, now + 24h). The raw token and the expiry are returned once in the
  201 response. The frontend saves `{ token, expires_at }` in `localStorage` under
  `planet-pizza-order-access`, keyed by order id.
  - Confirmation page: `GET /api/orders/:id` with the header
    `X-Order-Access-Token: <token>` returns the full order (FR-013 keeps full
    details for the purchasing browser).
  - Tracking from the confirmation link: `POST /api/orders/track` with
    `{ order_number, access_token }` returns the tracking view, with no typing.
  - The server checks `id = ? AND access_token_hash = ? AND access_expires_at > ?`.
    An expired, missing or wrong token gives the same 404 as R4.
- **Rationale**: The token is unguessable (256-bit), never appears in a URL
  (FR-010), is enforced server-side for 24h, and is per-browser because it lives in
  that browser's storage. Only a hash is stored, so a DB leak doesn't grant access.
  `localStorage` matches the existing `CartContext` pattern and works when the
  frontend talks to a cross-origin backend via `VITE_API_URL`.
- **Alternatives considered**:
  - *HttpOnly cookie*: this is more XSS-resistant, but it needs cookie parsing
    (hand-written or `cookie-parser`). It also needs `credentials` and CORS changes
    to work cross-origin with `VITE_API_URL`, and cookies would be sent on every
    `/api` call. That's too heavy for the MVP. The XSS trade-off is accepted
    because the site renders no user-generated HTML.
  - *Client-only flag ("I placed this order") with no server check*: this doesn't
    close the FR-013 gap, because the server would still have to serve details by
    number alone.
  - *Token in the URL (`/track/42?t=…`)*: the link can be shared or bookmarked,
    which violates Story 3 scenario 2.

## R7. Closing the number-only gap (FR-013)

- **Decision**: `GET /api/orders/:id` requires a valid `X-Order-Access-Token`.
  Without one, it returns the R4 404. `loadOrder` selects an explicit column list,
  so `access_token_hash` is never serialized. There is no other customer-facing
  read path by number alone.
- **Rationale**: This is the smallest change that removes the enumeration hole
  while keeping the confirmation page working for the purchaser.

## R8. Rate limiting: 10 per minute, then a 1-minute cooldown (FR-009)

- **Decision**: A small hand-written, route-scoped, in-memory limiter in
  `backend/src/lib/rateLimit.ts`. It is applied to `POST /api/orders/track` and
  `GET /api/orders/:id`, which share one bucket per source. The key is `req.ip`.
  Each source tracks `{ windowStart, count, blockedUntil }`:
  - Within `blockedUntil`, the request is refused.
  - If the window is older than 60s, it resets.
  - When `++count > 10`, set `blockedUntil = now + 60s` and refuse.
  - Refusals return `429 { "error": "Too many lookups", "retry_after_seconds": n }`
    with a `Retry-After` header. Expired entries are pruned lazily.
- **Rationale**: The rule is tiny and specific (fixed window plus a cooldown), so
  writing it by hand avoids a dependency (Constitution IV) and keeps the exact
  semantics. Route-scoped use respects "don't add Express middleware globally". The
  limiter runs before any DB access, so a refusal reveals nothing.
- **Known limitations** (acceptable for the MVP):
  - State is per-process and resets on restart.
  - In dev, all traffic arrives through the Vite proxy, so `req.ip` is loopback
    and everyone shares one bucket.
  - `trust proxy` is deliberately **not** enabled, because `X-Forwarded-For` would
    be spoofable without a known proxy in front.
- **Alternatives considered**: `express-rate-limit` needs a new dependency, and its
  sliding/fixed window doesn't natively model "then a full 1-minute cooldown".

## R9. Distinguishing "no match", "invalid", "cooldown" and "signal lost"

- **Decision**: Add a small `ApiError` class (with `status`) to
  `frontend/src/api/client.ts`. `request()` throws it on non-2xx responses. A
  network failure (fetch rejects) or a 5xx maps to "signal lost". The UI maps
  status codes as follows:

  | Outcome | Server | UI copy key |
  |---|---|---|
  | match | 200 | timeline + items + total |
  | no match | 404 | `noMatch` |
  | invalid input | 400 | field prompts (normally caught client-side first) |
  | cooldown | 429 | `cooldown` |
  | unreachable / 5xx | network error, 500 | `signalLost` |

- **Rationale**: The spec requires "signal lost" to differ from "no match". The
  existing `request()` only throws a generic `Error` string, so the status isn't
  usable today.

## R10. Frontend structure

- **Decision**:
  - New route `/track` and `/track/:orderId` → `pages/TrackingPage.tsx`.
  - Shared `components/TrackingLookup.tsx` (form + outcome) and
    `components/TrackingTimeline.tsx` (the 4-stage timeline).
  - `OrderConfirmationPage` uses the stored token. Without a valid one, it renders
    `TrackingLookup` (FR-013) with the order number pre-filled.
  - Access-token storage helpers live in `api/client.ts`, which is the "one
    module" api convention.
- **Behaviour of `/track/:orderId`**: If the browser holds an unexpired token for
  that id, the page auto-looks-up immediately (Story 3, scenario 1). Otherwise it
  shows the form with the order number pre-filled and the email empty (Story 3,
  scenario 2). If the server rejects a stored token, the token is removed and the
  page falls back to the form.
- **Timeline rendering**: The stage order is a frontend constant. The index of
  `tracking_stage` decides done / current / upcoming, so any of the 4 stages
  renders correctly (FR-012).

## R11. Verification approach

- **Decision**: No test runner (Constitution VI). Verify with `npm run build` plus
  the `curl` script and manual browser walkthrough in [quickstart.md](./quickstart.md).
  For SC-003 timing, use `curl -w '%{time_total}'` comparisons.
