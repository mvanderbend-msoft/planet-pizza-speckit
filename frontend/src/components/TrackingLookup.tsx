import { useState, type FormEvent } from 'react';
import { api, formatPrice, type OrderTracking } from '../api/client';
import TrackingTimeline from './TrackingTimeline';

export default function TrackingLookup() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<OrderTracking | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setOrder(null);
    setMessage(null);
    setSubmitting(true);
    try {
      setOrder(await api.trackOrder({ order_number: orderNumber, email }));
    } catch {
      setMessage("The mothership couldn't find a matching abduction. Double-check your order number and transmission, then try again. 👽");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="card p-6 space-y-4">
        <div>
          <label htmlFor="tracking-order-number" className="font-mono text-sm uppercase text-slate-600">Order number</label>
          <input
            id="tracking-order-number"
            className="input mt-1"
            inputMode="numeric"
            placeholder="#42"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="tracking-email" className="font-mono text-sm uppercase text-slate-600">Email transmission</label>
          <input
            id="tracking-email"
            type="email"
            className="input mt-1"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {message && <p role="alert" className="text-red-600 text-sm">{message}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Scanning…' : 'Scan the skies'}
        </button>
      </form>

      {order && (
        <section className="card p-6 space-y-6">
          <p className="eyebrow">Order #{order.id}. Status decrypted.</p>
          <TrackingTimeline stage={order.tracking_stage} />
          <div>
            <h2 className="text-lg text-alien-700 mb-3">Itemized cargo manifest</h2>
            <ul className="space-y-1 text-sm font-mono text-slate-800">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4">
                  <span>{item.name_snapshot} × {item.quantity}</span>
                  <span>{formatPrice(item.line_total_cents)}</span>
                </li>
              ))}
            </ul>
            <hr className="my-3 border-slate-200" />
            <div className="flex justify-between font-mono text-lg">
              <span className="text-slate-700">Total charged</span>
              <span className="text-alien-700">{formatPrice(order.total_cents)}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
