import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import { lookupRateLimit } from '../lib/rateLimit';

export const ordersRouter = Router();

const NOT_FOUND = { error: 'Order not found' };

const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(200),
    address: z.string().min(1).max(500),
  }),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive().max(99),
      })
    )
    .min(1),
});

const orderNumberSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return value;
    return String(value).trim().replace(/^#/, '').trim();
  },
  z.string().regex(/^\d{1,10}$/).transform(Number).pipe(z.number().int().min(1).max(2147483647))
);

const trackingEmailSchema = z.object({
  order_number: orderNumberSchema,
  email: z.string().trim().toLowerCase().email().max(200),
}).strict();

type ProductRow = { id: number; name: string; price_cents: number; stock: number };
type OrderRow = {
  id: number;
  created_at: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  total_cents: number;
  status: string;
  tracking_stage: 'confirmed' | 'hand_tossed' | 'tractor_beam' | 'abducted';
};
type OrderItemRow = {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price_cents: number;
  name_snapshot: string;
};

ordersRouter.post('/', (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid order', details: parsed.error.flatten() });
  }
  const { customer, items } = parsed.data;

  const getProduct = db.prepare('SELECT id, name, price_cents, stock FROM products WHERE id = ?');
  const insertOrder = db.prepare(
    'INSERT INTO orders (customer_name, customer_email, shipping_address, total_cents, access_token_hash, access_expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents, name_snapshot) VALUES (?, ?, ?, ?, ?)'
  );

  try {
    let createdId = 0;
    const accessToken = randomBytes(32).toString('base64url');
    const accessTokenHash = createHash('sha256').update(accessToken).digest('hex');
    const accessExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.exec('BEGIN');
    try {
      let total = 0;
      const resolved: Array<{ p: ProductRow; qty: number }> = [];
      for (const it of items) {
        const p = getProduct.get(it.productId) as ProductRow | undefined;
        if (!p) throw Object.assign(new Error(`Product ${it.productId} not found`), { status: 400 });
        if (p.stock < it.quantity) {
          throw Object.assign(new Error(`Insufficient stock for ${p.name}`), { status: 409 });
        }
        total += p.price_cents * it.quantity;
        resolved.push({ p, qty: it.quantity });
      }

      const info = insertOrder.run(customer.name, customer.email, customer.address, total, accessTokenHash, accessExpiresAt);
      createdId = Number(info.lastInsertRowid);
      for (const { p, qty } of resolved) {
        insertItem.run(createdId, p.id, qty, p.price_cents, p.name);
      }
      db.exec('COMMIT');
    } catch (innerErr) {
      db.exec('ROLLBACK');
      throw innerErr;
    }

    const order = loadOrder(createdId);
    res.status(201).json({ ...order, access_token: accessToken, access_expires_at: accessExpiresAt });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    res.status(e.status ?? 500).json({ error: e.message ?? 'Order failed' });
  }
});

ordersRouter.post('/track', lookupRateLimit, (req, res) => {
  const parsed = trackingEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid', details: parsed.error.flatten() });
  }

  const order = db.prepare(
    'SELECT id, tracking_stage, total_cents FROM orders WHERE id = ? AND lower(trim(customer_email)) = ?'
  ).get(parsed.data.order_number, parsed.data.email) as Pick<OrderRow, 'id' | 'tracking_stage' | 'total_cents'> | undefined;
  if (!order) return res.status(404).json(NOT_FOUND);

  const items = db.prepare(
    'SELECT id, name_snapshot, quantity, unit_price_cents FROM order_items WHERE order_id = ?'
  ).all(order.id) as Array<Pick<OrderItemRow, 'id' | 'name_snapshot' | 'quantity' | 'unit_price_cents'>>;

  return res.json({
    id: order.id,
    tracking_stage: order.tracking_stage,
    items: items.map((item) => ({
      ...item,
      line_total_cents: item.unit_price_cents * item.quantity,
    })),
    total_cents: order.total_cents,
  });
});

ordersRouter.get('/:id', lookupRateLimit, (req, res) => {
  const parsed = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().safe()).safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid id' });

  const token = req.get('X-Order-Access-Token');
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(404).json(NOT_FOUND);

  const id = parsed.data;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const match = db.prepare(
    'SELECT id FROM orders WHERE id = ? AND access_token_hash = ? AND access_expires_at > ?'
  ).get(id, tokenHash, new Date().toISOString());
  if (!match) return res.status(404).json(NOT_FOUND);

  const order = loadOrder(id);
  if (!order) return res.status(404).json(NOT_FOUND);
  res.json(order);
});

function loadOrder(id: number) {
  const order = db.prepare(
    'SELECT id, created_at, customer_name, customer_email, shipping_address, total_cents, status, tracking_stage FROM orders WHERE id = ?'
  ).get(id) as OrderRow | undefined;
  if (!order) return null;
  const items = db.prepare(
    'SELECT id, order_id, product_id, quantity, unit_price_cents, name_snapshot FROM order_items WHERE order_id = ?'
  ).all(id) as OrderItemRow[];
  return { ...order, items };
}
