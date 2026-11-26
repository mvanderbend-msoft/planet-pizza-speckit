import { useState, type FormEvent } from 'react';
import { api, formatPrice, type OrderTracking } from '../api/client';
import TrackingTimeline from './TrackingTimeline';

const REQUIRED_MESSAGE = 'The mothership needs this field filled in.';
const INVALID_NUMBER_MESSAGE = 'That order number looks scrambled. Use the digits from your confirmation, like #42.';
const INVALID_EMAIL_MESSAGE = "That transmission address won't reach orbit. Double-check your email.";
// Match the backend's Zod v3 email validator.
const EMAIL_PATTERN = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;

export default function TrackingLookup() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ orderNumber?: string; email?: string }>({});
  const [order, setOrder] = useState<OrderTracking | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setOrder(null);
    setMessage(null);

    const trimmedOrderNumber = orderNumber.trim();
    const numberWithoutPrefix = trimmedOrderNumber.replace(/^#/, '').trim();
    const parsedOrderNumber = Number(numberWithoutPrefix);
    const normalizedEmail = email.trim().toLowerCase();
    const errors: { orderNumber?: string; email?: string } = {};

    if (!trimmedOrderNumber) {
      errors.orderNumber = REQUIRED_MESSAGE;
    } else if (
      !/^\d{1,10}$/.test(numberWithoutPrefix) ||
      !Number.isInteger(parsedOrderNumber) ||
      parsedOrderNumber < 1 ||
      parsedOrderNumber > 2147483647
    ) {
      errors.orderNumber = INVALID_NUMBER_MESSAGE;
    }

    if (!normalizedEmail) {
      errors.email = REQUIRED_MESSAGE;
    } else if (
      normalizedEmail.length > 200 ||
      !EMAIL_PATTERN.test(normalizedEmail)
    ) {
      errors.email = INVALID_EMAIL_MESSAGE;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      setOrder(await api.trackOrder({
        order_number: String(parsedOrderNumber),
        email: normalizedEmail,
      }));
    } catch {
      setMessage("The mothership couldn't find a matching abduction. Double-check your order number and transmission, then try again. 👽");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="card p-6 space-y-4">
        <div>
          <label htmlFor="tracking-order-number" className="font-mono text-sm uppercase text-slate-600">Order number</label>
          <input
            id="tracking-order-number"
            className="input mt-1"
            inputMode="numeric"
            placeholder="#42"
            aria-invalid={Boolean(fieldErrors.orderNumber)}
            aria-describedby={fieldErrors.orderNumber ? 'tracking-order-number-error' : undefined}
            value={orderNumber}
            onChange={(e) => {
              setOrderNumber(e.target.value);
              setFieldErrors((current) => ({ ...current, orderNumber: undefined }));
            }}
          />
          {fieldErrors.orderNumber && (
            <p id="tracking-order-number-error" role="alert" className="mt-1 text-red-600 text-sm">
              {fieldErrors.orderNumber}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="tracking-email" className="font-mono text-sm uppercase text-slate-600">Email transmission</label>
          <input
            id="tracking-email"
            type="email"
            className="input mt-1"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'tracking-email-error' : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
          />
          {fieldErrors.email && (
            <p id="tracking-email-error" role="alert" className="mt-1 text-red-600 text-sm">
              {fieldErrors.email}
            </p>
          )}
        </div>
        {message && <p role="alert" className="text-red-600 text-sm">{message}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Scanning…' : 'Scan the skies'}
        </button>
      </form>

      <p role="status" className="sr-only">
        {order ? `Order #${order.id}. Status decrypted.` : ''}
      </p>

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
