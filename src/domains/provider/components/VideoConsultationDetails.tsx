import type { ReactNode } from "react";
import { Calendar, ChevronLeft, Clock, MessageCircle, Video } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { useNow } from "../../../shared/hooks/useNow";
import type { Booking } from "../../../shared/schemas/booking";
import { consultationDateLabel, consultationTimeRange, describeTimezone, joinOpensAt } from "../../../shared/utils/consultationTime";
import { describeStart } from "../../../shared/utils/joinCountdown";
import { isWithinJoinWindow } from "../../../shared/utils/telemedicine";

type Props = {
  booking: Booking;
  timezone: string | undefined;
  joinWindowBeforeMinutes: number | undefined;
  statusLabel: string;
  statusClassName: string;
  /** Nobody joined: the provider is pointed at suggesting a new time instead of joining. */
  unattended: boolean;
  /** Whether payment to the provider is shown (some facilities handle it themselves). */
  showPayoutNote: boolean;
  onBack: () => void;
  onJoin: () => void;
  onChat: () => void;
  /** Rendered by the page: both need page state (reschedule rules, the notes API). */
  reschedule: ReactNode;
  notes: ReactNode;
};

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="text-sm font-semibold text-slate-500">{children}</h2>
);

// The provider's view of a video consultation: when it is, who it is with, and what to do now. No map, route,
// address or phone number: a video call has none of those, and the call itself happens in the app.
export const VideoConsultationDetails = ({
  booking,
  timezone,
  joinWindowBeforeMinutes,
  statusLabel,
  statusClassName,
  unattended,
  showPayoutNote,
  onBack,
  onJoin,
  onChat,
  reschedule,
  notes
}: Props) => {
  const now = useNow();
  const dateLabel = consultationDateLabel(booking.scheduledAt, timezone);
  const timeRange = consultationTimeRange(booking.scheduledAt, booking.estimateDurationMinutes, timezone);
  const countdown = describeStart(booking.scheduledAt, now);
  const joinOpen = isWithinJoinWindow(booking.scheduledAt, booking.estimateDurationMinutes, now, joinWindowBeforeMinutes);
  const opensAt = joinOpensAt(booking.scheduledAt, joinWindowBeforeMinutes, timezone);
  const client = booking.client;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-12">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-slate-900">Video consultation</h1>
          {booking.service?.name && booking.service.name !== "Video consultation" && (
            <p className="truncate text-sm text-slate-600">{booking.service.name}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClassName}`}>{statusLabel}</span>
      </header>

      <section aria-label="When" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle>When</SectionTitle>
        {dateLabel ? (
          <>
            <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Calendar className="h-5 w-5 shrink-0 text-tiba-blue" aria-hidden="true" />
              {dateLabel}
            </p>
            {timeRange && (
              <p className="mt-1 flex items-center gap-2 text-base text-slate-700">
                <Clock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                {timeRange} <span className="text-sm text-slate-500">({describeTimezone(timezone)})</span>
              </p>
            )}
            {countdown && (
              <p role="status" className="mt-2 text-sm font-semibold text-tiba-blue">
                {countdown}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-base text-slate-700">The time has not been set yet.</p>
        )}
      </section>

      <section aria-label="Client" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle>Client</SectionTitle>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-lg font-bold text-brand-600">
            {client?.avatarUrl ? (
              <img src={client.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (client?.fullName?.[0] ?? "C")
            )}
          </div>
          <p className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">{client?.fullName ?? "Client"}</p>
          <Button type="button" variant="outline" size="sm" icon={<MessageCircle className="h-4 w-4" />} onClick={onChat}>
            Message
          </Button>
        </div>
      </section>

      <section aria-label="Join" className="space-y-3">
        {unattended ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Nobody joined this consultation. You can suggest a new time below.
          </p>
        ) : joinOpen ? (
          <Button type="button" className="min-h-[56px] w-full text-base" icon={<Video className="h-5 w-5" />} onClick={onJoin}>
            Join video call
          </Button>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {opensAt
              ? `The call opens at ${opensAt}, ${joinWindowBeforeMinutes} minutes before the appointment. This page will show a Join button then.`
              : "The call opens shortly before the appointment. This page will show a Join button then."}
          </p>
        )}
      </section>

      {reschedule}

      {showPayoutNote && (
        <p className="text-sm text-slate-600">Your earnings for this consultation are credited to your wallet once it is complete.</p>
      )}

      {notes}
    </div>
  );
};

export default VideoConsultationDetails;
