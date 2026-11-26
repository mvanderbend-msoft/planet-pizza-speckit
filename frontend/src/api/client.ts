export type Product = {
  id: number;
  sku: string;
  name: string;
  description: string;
  price_cents: number;
  category: 'pizza' | 'merch';
  image_url: string;
  stock: number;
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price_cents: number;
  name_snapshot: string;
};

export type TrackingStage = 'confirmed' | 'hand_tossed' | 'tractor_beam' | 'abducted';

export type Order = {
  id: number;
  created_at: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  total_cents: number;
  status: string;
  tracking_stage: TrackingStage;
  items: OrderItem[];
};

export type CreatedOrder = Order & {
  access_token: string;
  access_expires_at: string;
};

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

const BASE = import.meta.env.VITE_API_URL ?? '/api';
const ORDER_ACCESS_KEY = 'planet-pizza-order-access';

type OrderAccess = Record<string, { token: string; expires_at: string }>;

function readOrderAccess(): OrderAccess {
  const entries: OrderAccess = Object.create(null);
  try {
    const raw = localStorage.getItem(ORDER_ACCESS_KEY);
    if (!raw) return entries;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return entries;

    let pruned = false;
    for (const [id, value] of Object.entries(parsed)) {
      if (
        value && typeof value === 'object' &&
        typeof value.token === 'string' && value.token &&
        typeof value.expires_at === 'string' && Date.parse(value.expires_at) > Date.now()
      ) {
        entries[id] = { token: value.token, expires_at: value.expires_at };
      } else {
        pruned = true;
      }
    }
    if (pruned) localStorage.setItem(ORDER_ACCESS_KEY, JSON.stringify(entries));
  } catch {
    // Storage may be unavailable or contain invalid JSON.
  }
  return entries;
}

export function saveOrderAccess(id: number, token: string, expiresAt: string): void {
  const entries = readOrderAccess();
  entries[id] = { token, expires_at: expiresAt };
  try {
    localStorage.setItem(ORDER_ACCESS_KEY, JSON.stringify(entries));
  } catch {
    // Storage may be unavailable.
  }
}

export function getOrderAccess(id: number): string | null {
  return readOrderAccess()[id]?.token ?? null;
}

export function clearOrderAccess(id: number): void {
  const entries = readOrderAccess();
  delete entries[id];
  try {
    localStorage.setItem(ORDER_ACCESS_KEY, JSON.stringify(entries));
  } catch {
    // Storage may be unavailable.
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, `API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listProducts: (category?: 'pizza' | 'merch') =>
    request<Product[]>(`/products${category ? `?category=${category}` : ''}`),
  getProduct: (id: number) => request<Product>(`/products/${id}`),
  createOrder: (body: {
    customer: { name: string; email: string; address: string };
    items: { productId: number; quantity: number }[];
  }) => request<CreatedOrder>('/orders', { method: 'POST', body: JSON.stringify(body) }),
  getOrder: (id: number, accessToken?: string) =>
    request<Order>(`/orders/${id}`, accessToken
      ? { headers: { 'X-Order-Access-Token': accessToken } }
      : undefined),
  trackOrder: (body: { order_number: string; email: string } | { order_number: string | number; access_token: string }) =>
    request<OrderTracking>('/orders/track', { method: 'POST', body: JSON.stringify(body) }),
};

export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
