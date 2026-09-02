import { AlertCircle } from "lucide-react";

type Props = {
  /** Where to look at the booking this concerns. */
  onViewBooking?: () => void;
};

/**
 * Shown when a client's payment succeeded but the appointment could not be confirmed.
 *
 * The honest version of a bad situation: their money arrived, the slot did not survive, and a
 * person is now deciding what happens. Two things this must not do -- imply the appointment
 * stands, or promise a refund. No refund has been approved at this point, and saying otherwise
 * would be a second and worse error than the silence this replaced.
 */
export const PaymentReviewNotice = ({ onViewBooking }: Props) => (
  <section
    role="status"
    className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"
  >
    <div className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-amber-900">
          We have your payment and are checking this booking
        </h3>
        <p className="mt-1 text-sm text-amber-800">
          Your payment went through, but the time slot was no longer held. Nothing is confirmed
          yet and your money is safe while our team sorts it out. We will contact you shortly.
        </p>
        {onViewBooking && (
          <button
            type="button"
            onClick={onViewBooking}
            className="mt-3 rounded-full border border-amber-300 bg-white px-4 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            View booking
          </button>
        )}
      </div>
    </div>
  </section>
);
