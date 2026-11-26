import { useParams } from 'react-router-dom';
import { getOrderAccess } from '../api/client';
import TrackingLookup from '../components/TrackingLookup';

export default function TrackingPage() {
  const { orderId: orderIdParam } = useParams<{ orderId: string }>();
  const parsedOrderId = orderIdParam && /^\d+$/.test(orderIdParam) ? Number(orderIdParam) : NaN;
  const orderId = Number.isSafeInteger(parsedOrderId) && parsedOrderId > 0 ? parsedOrderId : undefined;

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Classified tracking terminal</p>
        <h1 className="mt-2 text-4xl text-alien-700">Track Your Abduction 🛸</h1>
        <p className="mt-4 max-w-2xl text-slate-700">
          Enter your order number and the transmission you used at checkout, earthling. The mothership will check its logs.
        </p>
      </div>
      {orderId ? (
        <TrackingLookup
          key={orderId}
          initialOrderNumber={String(orderId)}
          orderId={orderId}
          accessToken={getOrderAccess(orderId) ?? undefined}
        />
      ) : (
        <TrackingLookup />
      )}
    </div>
  );
}
