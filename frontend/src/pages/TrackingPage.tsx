import TrackingLookup from '../components/TrackingLookup';

export default function TrackingPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Classified tracking terminal</p>
        <h1 className="mt-2 text-4xl text-alien-700">Track Your Abduction 🛸</h1>
        <p className="mt-4 max-w-2xl text-slate-700">
          Enter your order number and the transmission you used at checkout, earthling. The mothership will check its logs.
        </p>
      </div>
      <TrackingLookup />
    </div>
  );
}
