import type { TrackingStage } from '../api/client';

const TRACKING_STAGES: { id: TrackingStage; label: string }[] = [
  { id: 'confirmed', label: 'Confirmed by the mothership' },
  { id: 'hand_tossed', label: 'Hand-tossed in Hangar 18' },
  { id: 'tractor_beam', label: 'In the tractor beam' },
  { id: 'abducted', label: 'Abducted to your drop coordinates' },
];

export default function TrackingTimeline({ stage }: { stage: TrackingStage }) {
  const currentIndex = TRACKING_STAGES.findIndex(({ id }) => id === stage);

  return (
    <ol className="space-y-4">
      {TRACKING_STAGES.map(({ id, label }, index) => {
        const status = index < currentIndex ? 'Done' : index === currentIndex ? 'Current' : 'Upcoming';

        return (
          <li key={id} aria-current={status === 'Current' ? 'step' : undefined} className="flex items-start gap-3">
            {status === 'Done' ? (
              <span aria-hidden="true" className="text-alien-600">✓</span>
            ) : (
              <span
                aria-hidden="true"
                className={status === 'Current' ? 'text-cosmic-500 motion-safe:animate-pulse' : 'text-slate-400'}
              >
                ●
              </span>
            )}
            <div>
              <p className="text-slate-900">{label}</p>
              <p className="text-sm text-slate-600">{status}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
