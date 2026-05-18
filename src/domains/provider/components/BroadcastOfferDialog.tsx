import { Modal } from "../../../shared/components/Modal";
import { Button } from "../../../shared/components/Button";
import type { BroadcastOffer } from "../hooks/useBroadcastQueue";

const formatCurrency = (valueCents?: number, currency = "KES") => {
  if (typeof valueCents !== "number") {
    return "—";
  }
  const amount = valueCents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

type BroadcastOfferDialogProps = {
  offer: BroadcastOffer | null;
  onDismiss: (bookingId: string) => void;
  onView: (bookingId: string) => void;
  onAccept: (bookingId: string) => void;
  accepting?: boolean;
};

export const BroadcastOfferDialog = ({
  offer,
  onDismiss,
  onView,
  onAccept,
  accepting
}: BroadcastOfferDialogProps) => {
  if (!offer) {
    return null;
  }
  const { booking, distanceM, emergency, radiusM, wave, candidateCount } = offer;

  return (
    <Modal
      open={Boolean(offer)}
      onClose={() => onDismiss(booking.id)}
      title="New booking invite"
      maxWidth="sm"
    >
      <div className="space-y-3 py-1 text-sm text-slate-700">
        {emergency && (
          <p className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600">
            Emergency request
          </p>
        )}
        <div>
          <p className="text-xs uppercase tracking-wide text-primary-600">Service</p>
          <p className="text-lg font-semibold text-slate-900">{booking.service?.name ?? "Booking request"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Estimated duration</p>
          <p className="font-semibold text-slate-900">
            {booking.estimateDurationMinutes ? `${booking.estimateDurationMinutes} mins` : "—"}
          </p>
          <p className="text-xs text-slate-400 mt-1">Earnings credited to wallet after completion</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Location</p>
          <p className="font-semibold text-slate-900">{booking.addressText ?? "Location shared privately"}</p>
          {typeof distanceM === "number" && (
            <p className="text-xs text-slate-500">
              Approx. {(distanceM / 1000).toFixed(1)} km from your base
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span>Wave {wave}</span>
          <span>Radius {radiusM} m</span>
          <span>{candidateCount} providers invited</span>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => onDismiss(booking.id)} disabled={accepting}>
          Skip for now
        </Button>
        <Button type="button" variant="secondary" onClick={() => onView(booking.id)} disabled={accepting}>
          View details
        </Button>
        <Button type="button" onClick={() => onAccept(booking.id)} loading={accepting}>
          Accept &amp; continue
        </Button>
      </div>
    </Modal>
  );
};

export default BroadcastOfferDialog;
