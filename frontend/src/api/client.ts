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
  }) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(body) }),
  getOrder: (id: number) => request<Order>(`/orders/${id}`),
};

export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
