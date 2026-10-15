import { useEffect, useState } from "react";

import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { ADMIN_CANCELLATION_REASONS, formatCancellationReason } from "../../../shared/constants/bookings";

type Props = {
  open: boolean;
  loading?: boolean;
  // A paid telemedicine booking cannot be undone and sends the payment to review.
  paidTelemedicine?: boolean;
  onClose: () => void;
  // Called with the text to store as the cancellation reason.
  onConfirm: (reason: string) => void;
};

const fieldClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50";

// One cancel dialog for every admin booking screen. The reason starts empty and has to be chosen, so
// a default can never be recorded by accident; "Other" needs a note; and a paid telemedicine booking
// gets a plain warning first.
export const CancelBookingDialog = ({ open, loading, paidTelemedicine = false, onClose, onConfirm }: Props) => {
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setCode("");
      setNote("");
    }
  }, [open]);

  const needsNote = code === "other";
  const ready = Boolean(code) && (!needsNote || note.trim().length > 0);

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => onConfirm(formatCancellationReason(code, note.trim() || undefined))}
      loading={loading}
      confirmDisabled={!ready}
      title="Cancel booking"
      description="Choose why this booking is being cancelled. The client and provider are told."
      confirmLabel="Cancel booking"
      cancelLabel="Keep booking"
      confirmVariant="secondary"
    >
      {paidTelemedicine && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <p className="font-semibold">This booking is already paid.</p>
          <p className="mt-1">
            Cancelling it cannot be undone. The time slot is released, nobody can be assigned to it afterwards, and the payment
            goes to review for a refund decision. To change who takes the call, reassign the provider instead.
          </p>
        </div>
      )}
      <label className="mt-3 flex flex-col gap-1 text-sm text-slate-700">
        <span>Reason (required)</span>
        <select className={fieldClass} value={code} onChange={(event) => setCode(event.target.value)}>
          <option value="" disabled>
            Choose a reason
          </option>
          {ADMIN_CANCELLATION_REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
              {reason.description ? ` — ${reason.description}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 flex flex-col gap-1 text-sm text-slate-700">
        <span>{needsNote ? "Note (required for Other)" : "Internal note (optional)"}</span>
        <textarea className={`${fieldClass} w-full`} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
    </ConfirmDialog>
  );
};

export default CancelBookingDialog;
