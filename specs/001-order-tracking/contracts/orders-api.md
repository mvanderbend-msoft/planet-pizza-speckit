# API Contract: Orders (tracking-related changes)

**Feature**: `001-order-tracking`. All JSON is `snake_case` (Constitution III).
Frontend types in `frontend/src/api/client.ts` MUST mirror these shapes exactly.

## Shared responses

**No match**: identical for every miss on every endpoint below (unknown id, wrong
email, wrong, missing or expired token):

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{ "error": "Order not found" }
```

**Rate limited**: shared bucket across `POST /api/orders/track` and
`GET /api/orders/:id`. Applies to 10 requests per 60s per source, then a 60s
cooldown:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
Content-Type: application/json

{ "error": "Too many lookups", "retry_after_seconds": 42 }
```

**Validation error**: existing convention:

```json
{ "error": "Invalid", "details": { "formErrors": [], "fieldErrors": { "order_number": ["..."] } } }
```

---

## `POST /api/orders` (changed: response gains access token)

Request is unchanged. The `201` response is the full order plus a one-time access
token:

```json
{
  "id": 42,
  "created_at": "2026-11-26 18:33:43",
  "customer_name": "Fox Mulder",
  "customer_email": "Earthling@Example.com",
  "shipping_address": "2630 Hegal Pl, Alexandria VA",
  "total_cents": 2598,
  "status": "paid",
  "tracking_stage": "confirmed",
  "items": [
    { "id": 7, "order_id": 42, "product_id": 1, "quantity": 2, "unit_price_cents": 1299, "name_snapshot": "Roswell Margherita" }
  ],
  "access_token": "q3Xb...43-chars-base64url",
  "access_expires_at": "2026-11-27T18:33:43.468Z"
}
```

`access_token_hash` is **never** present in any response.

---

## `GET /api/orders/:id` (changed: now requires the access token)

| | |
|---|---|
| Header | `X-Order-Access-Token: <token>` (**required**) |
| Param | `id`: positive integer (zod) |
| Rate limited | yes |

- `200` returns the full `Order` (same as the 201 body **without** `access_token` /
  `access_expires_at`). This is only served when the token hash matches **and**
  `access_expires_at > now`.
- `400` is returned if `id` is malformed.
- `404` is the generic "no match", returned for any token problem as well as an
  unknown id.

> Breaking change: number-only access is removed (FR-013). The only caller is
> `OrderConfirmationPage`, which is updated in the same change.

---

## `POST /api/orders/track` (new)

Rate limited. The body is **one of**:

```json
{ "order_number": "#0042", "email": " Earthling@example.com " }
```

```json
{ "order_number": 42, "access_token": "q3Xb...43-chars-base64url" }
```

| Field | Rule |
|---|---|
| `order_number` | string or number. Trim, strip one leading `#`, then `/^\d{1,10}$/`, int `1..2147483647`. |
| `email` | trimmed, lowercased, valid email, max 200 |
| `access_token` | `/^[A-Za-z0-9_-]{43}$/` |

Exactly one of `email` / `access_token` must be present. If both or neither are
sent, the response is `400`.

**200: `OrderTracking`**. It intentionally excludes name, email, address and
`created_at` (FR-006):

```json
{
  "id": 42,
  "tracking_stage": "confirmed",
  "items": [
    { "id": 7, "name_snapshot": "Roswell Margherita", "quantity": 2, "unit_price_cents": 1299, "line_total_cents": 2598 }
  ],
  "total_cents": 2598
}
```

**Matching rules**

- Email variant: `WHERE id = ? AND lower(trim(customer_email)) = ?`. This is one
  query whether or not the id exists (SC-003).
- Token variant:
  `WHERE id = ? AND access_token_hash = ? AND access_expires_at > ?` (now, ISO).
- Items are only read after a match.

**Responses**: `200` match · `400` invalid input · `404` generic no match ·
`429` cooldown.

---

## Frontend types (to add or change in `client.ts`)

```ts
export type TrackingStage = 'confirmed' | 'hand_tossed' | 'tractor_beam' | 'abducted';

export type Order = { /* existing fields */ tracking_stage: TrackingStage; items: OrderItem[] };

export type CreatedOrder = Order & { access_token: string; access_expires_at: string };

export type OrderTrackingItem = {
  id: number;
  name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

export type OrderTracking = {
  id: number;
  tracking_stage: TrackingStage;
  items: OrderTrackingItem[];
  total_cents: number;
};

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

// api.createOrder(...)                    -> Promise<CreatedOrder>
// api.getOrder(id, accessToken)           -> Promise<Order>         (sends X-Order-Access-Token)
// api.trackOrder({ order_number, email }) -> Promise<OrderTracking>
// api.trackOrder({ order_number, access_token }) -> Promise<OrderTracking>
// saveOrderAccess(id, token, expiresAt) / getOrderAccess(id) / clearOrderAccess(id)
```
