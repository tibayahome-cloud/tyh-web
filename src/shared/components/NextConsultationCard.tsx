import { Link } from "react-router-dom";
import { Video } from "lucide-react";

import { useNow } from "../hooks/useNow";
import type { Booking } from "../schemas/booking";
import { describeStart } from "../utils/joinCountdown";
import { formatTelemedicineDateTime, isWithinJoinWindow } from "../utils/telemedicine";

type Props = {
  booking: Booking;
  // Who the person is meeting, in the words for their side ("Dr Example" for a client, the client for a provider).
  withName: string | null | undefined;
  // Where "Join" goes. The booking page opens the call itself when it is sent here.
  joinTo: string;
  detailsTo: string;
  joinWindowBeforeMinutes?: number;
};

// The next video consultation, with the one thing to do about it. Before the call opens it says how long to
// wait and when it opens; once it opens the Join button is large and is the only action. A phone user used to
// have to find the booking, scroll to a small button, and guess whether the call had opened.
export const NextConsultationCard = ({ booking, withName, joinTo, detailsTo, joinWindowBeforeMinutes }: Props) => {
  const now = useNow();
  const open = isWithinJoinWindow(booking.scheduledAt, booking.estimateDurationMinutes, now, joinWindowBeforeMinutes);
  const countdown = describeStart(booking.scheduledAt, now);

  return (
    <section
      aria-labelledby={`next-consultation-${booking.id}`}
      className="rounded-2xl border border-tiba-blue/20 bg-blue-50 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tiba-blue text-white" aria-hidden="true">
          <Video className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id={`next-consultation-${booking.id}`} className="text-base font-semibold text-slate-900">
            Your video consultation{withName ? ` with ${withName}` : ""}
          </h2>
          <p className="text-sm text-slate-700">
            {booking.service?.name ? `${booking.service.name}. ` : ""}
            {formatTelemedicineDateTime(booking.scheduledAt)}
          </p>
          {countdown && (
            <p role="status" className="mt-1 text-sm font-semibold text-tiba-blue">
              {countdown}
            </p>
          )}
        </div>
      </div>

      {open ? (
        <Link
          to={joinTo}
          className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-tiba-blue px-4 text-base font-semibold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue focus-visible:ring-offset-2"
        >
          <Video className="h-5 w-5" aria-hidden="true" />
          Join video call
        </Link>
      ) : (
        <p className="mt-3 text-sm text-slate-700">
          The call opens {joinWindowBeforeMinutes ?? 10} minutes before the start. This button appears here when it does.
        </p>
      )}

      <Link
        to={detailsTo}
        className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-tiba-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
      >
        View booking details
      </Link>
    </section>
  );
};

export default NextConsultationCard;
