# Data Model: Track Your Abduction

**Feature**: `001-order-tracking` | **Date**: 2026-11-26

> ⚠️ **Schema change.** `migrate()` adds the new columns to existing databases with
> an idempotent `ALTER TABLE ... ADD COLUMN` guard (see research R2). If the backend
> fails to boot or behaves oddly after pulling this change, delete
> `backend/data/app.db*` and restart to re-create and re-seed.

## Order (table `orders`, modified)

| Column | Type | Constraints | New? | Notes |
|---|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | | The customer-facing **order number** (`Order #42`). |
| `created_at` | TEXT | NOT NULL DEFAULT `datetime('now')` | | |
| `customer_name` | TEXT | NOT NULL | | Never returned by tracking (FR-006). |
| `customer_email` | TEXT | NOT NULL | | Stored as typed. Matched as `lower(trim(customer_email))`. Never returned by tracking. |
| `shipping_address` | TEXT | NOT NULL | | Never returned by tracking. |
| `total_cents` | INTEGER | NOT NULL | | Server-computed at checkout (Constitution I). |
| `status` | TEXT | NOT NULL DEFAULT `'paid'` | | Payment status. Unchanged and unrelated to tracking. |
| `tracking_stage` | TEXT | NOT NULL DEFAULT `'confirmed'`, `CHECK (tracking_stage IN ('confirmed','hand_tossed','tractor_beam','abducted'))` | ✅ | FR-011. Existing rows are backfilled to `'confirmed'` by the column default. |
| `access_token_hash` | TEXT | NULL | ✅ | SHA-256 hex of the order access token. NULL for orders created before this feature. **Never serialized.** |
| `access_expires_at` | TEXT | NULL | ✅ | ISO-8601 UTC (`2026-11-27T18:33:43.468Z`), created_at + 24h. Compared lexicographically against `new Date().toISOString()`. |

**Validation and rules**

- New orders: `tracking_stage` is left to its default (`'confirmed'`).
  `access_token_hash` and `access_expires_at` are set in the same `INSERT` inside
  the existing checkout transaction.
- Stage only moves forward. Nothing writes `tracking_stage` in this release
  (FR-012).
- `loadOrder()` MUST select an explicit column list that excludes
  `access_token_hash`.

## Tracking Stage (enumeration, not a table)

Ordered values. The array index is the stage number minus 1.

| # | `tracking_stage` | User-facing label (frontend only) |
|---|---|---|
| 1 | `confirmed` | Confirmed by the mothership |
| 2 | `hand_tossed` | Hand-tossed in Hangar 18 |
| 3 | `tractor_beam` | In the tractor beam |
| 4 | `abducted` | Abducted to your drop coordinates |

**State transitions**: `confirmed → hand_tossed → tractor_beam → abducted`, forward
only. No transition is triggered in this release.

**Timeline rendering rule**: for current index `c`, stage `i` is
`done` if `i < c`, `current` if `i === c`, and `upcoming` if `i > c`.

## Order Item (table `order_items`, unchanged)

| Column | Notes |
|---|---|
| `id`, `order_id`, `product_id`, `quantity` | unchanged |
| `unit_price_cents` | Price captured at checkout. Tracking uses this, not the current catalog. |
| `name_snapshot` | Name captured at checkout. Tracking uses this, not the current catalog. |

In tracking responses, each item also gets a derived
`line_total_cents = unit_price_cents * quantity`, computed on the server.

## Order Access Token (not stored in plain form)

| Attribute | Where | Notes |
|---|---|---|
| raw token | 201 response of `POST /api/orders` only, then browser `localStorage` | 32 random bytes, base64url (43 chars). |
| hash | `orders.access_token_hash` | `sha256(token)` hex. |
| expiry | `orders.access_expires_at` + browser copy | 24h after checkout. The server is authoritative. |

Browser storage (`localStorage` key `planet-pizza-order-access`):

```ts
type OrderAccessStore = Record<string /* order id */, { token: string; expires_at: string }>;
```

Expired entries are pruned on read.

## Tracking Lookup (request, no stored state)

One of two variants, both validated with zod:

| Variant | Fields | Validation |
|---|---|---|
| by email | `order_number`, `email` | `order_number`: trim, strip one leading `#`, `/^\d{1,10}$/`, int in `1..2147483647`. `email`: trim, lowercase, `.email()`, max 200. |
| by access token | `order_number`, `access_token` | `order_number` as above. `access_token`: `/^[A-Za-z0-9_-]{43}$/`. |

Outcome: `OrderTracking` (match) or the single generic 404 (no match). See
[contracts/orders-api.md](./contracts/orders-api.md).

## Rate-limit state (in memory, not persisted)

`Map<string /* req.ip */, { windowStart: number; count: number; blockedUntil: number }>`.
The limit is 10 requests per 60s window, then a 60s block. Entries whose window and
block have both expired are pruned lazily.
