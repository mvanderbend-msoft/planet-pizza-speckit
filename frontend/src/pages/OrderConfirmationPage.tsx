import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api, clearOrderAccess, formatPrice, getOrderAccess, type Order } from '../api/client';
import TrackingLookup from '../components/TrackingLookup';

type ConfirmationState =
  | { id: string; status: 'loading' }
  | { id: string; status: 'restricted' }
  | { id: string; status: 'error' }
  | { id: string; status: 'loaded'; order: Order };

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const [state, setState] = useState<ConfirmationState | null>(null);

  useEffect(() => {
    if (!id) return;
    const orderId = Number(id);
    const token = getOrderAccess(orderId);
    if (!token) {
      setState({ id, status: 'restricted' });
      return;
    }

    let active = true;
    setState({ id, status: 'loading' });
    api.getOrder(orderId, token)
      .then((order) => {
        if (active) setState({ id, status: 'loaded', order });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 404) {
          clearOrderAccess(orderId);
          setState({ id, status: 'restricted' });
        } else {
          setState({ id, status: 'error' });
        }
      });

    return () => { active = false; };
  }, [id]);

  if (!id || !state || state.id !== id || state.status === 'loading') {
    return <p className="text-slate-500">Decrypting confirmation…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-red-600">Signal lost somewhere over Nevada. Try again in a moment. 📡</p>;
  }
  if (state.status === 'restricted') {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="eyebrow">Restricted file</p>
        <p className="mt-4 mb-6 text-slate-700">
          This confirmation is classified. Enter the order number and transmission to see where it stands.
        </p>
        <TrackingLookup key={id} initialOrderNumber={id} />
      </div>
    );
  }

  const { order } = state;

  return (
    <div className="max-w-2xl mx-auto card p-8">
      <p className="eyebrow">Transmission received</p>
      <h1 className="mt-2 text-4xl text-alien-700">Order #{order.id} confirmed 👽</h1>
      <p className="mt-4 text-slate-700">
        Thanks, <span className="text-alien-700 font-bold">{order.customer_name}</span>. The mothership is preparing your delivery.
      </p>

      <div className="mt-6 rounded border border-slate-200 p-4 bg-alien-50/40">
        <h2 className="text-lg text-alien-700 mb-3">Itemized cargo manifest</h2>
        <ul className="space-y-1 text-sm font-mono text-slate-800">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span>{it.name_snapshot} × {it.quantity}</span>
              <span>{formatPrice(it.unit_price_cents * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <hr className="my-3 border-slate-200" />
        <div className="flex justify-between font-mono text-lg">
          <span className="text-slate-700">Total charged</span>
          <span className="text-alien-700">{formatPrice(order.total_cents)}</span>
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        Drop coordinates: <span className="text-slate-900">{order.shipping_address}</span>
      </p>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link to={`/track/${order.id}`} className="btn-primary">Track your abduction →</Link>
        <Link to="/" className="btn-secondary">Return to base</Link>
      </div>
    </div>
  );
}
