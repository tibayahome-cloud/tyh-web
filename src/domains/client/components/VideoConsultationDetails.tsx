import type { ReactNode } from "react";
import { Calendar, ChevronLeft, Clock, MessageCircle, Video } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { useNow } from "../../../shared/hooks/useNow";
import type { Booking } from "../../../shared/schemas/booking";
import { consultationDateLabel, consultationTimeRange, describeTimezone, joinOpensAt } from "../../../shared/utils/consultationTime";
import { describeStart } from "../../../shared/utils/joinCountdown";
import { isWithinJoinWindow } from "../../../shared/utils/telemedicine";
import { bookingReference } from "../../../shared/utils/bookingReference";

type Props = {
  booking: Booking;
  timezone: string | undefined;
  joinWindowBeforeMinutes: number | undefined;
  statusLabel: string;
  statusClassName: string;
  /** The consultation was never attended; the person is invited to propose a new time instead of joining. */
  unattended: boolean;
  onBack: () => void;
  onJoin: () => void;
  onChat: () => void;
  /** Null when cancelling is not offered. The label says what it does ("Remove unpaid request"). */
  cancel: { label: string; onClick: () => void; loading: boolean } | null;
  /** Null when the person cannot report a missed call (not started yet, or already reported). */
  reportNoShow: (() => void) | null;
  noShowReported: boolean;
  reportTechnicalIssue: (() => void) | null;
  /** Rendered by the page: the reschedule panel and the payment-review notice need page state. */
  reschedule: ReactNode;
  paymentNotice: ReactNode;
  feedback: ReactNode;
  onBackToBookings: () => void;
};

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="text-sm font-semibold text-slate-500">{children}</h2>
);

const secondaryActionClass =
  "w-full min-h-[44px] rounded-xl text-sm font-semibold text-slate-600 hover:text-danger-600";

// A booked video consultation, built around three questions: when is it, who is it with, and what can I do
// now. Nothing about places: a video call has no address, map or route, so none is shown, and no internal ids
// (one short reference sits at the bottom for the rare call to support).
export const VideoConsultationDetails = ({
  booking,
  timezone,
  joinWindowBeforeMinutes,
  statusLabel,
  statusClassName,
  unattended,
  onBack,
  onJoin,
  onChat,
  cancel,
  reportNoShow,
  noShowReported,
  reportTechnicalIssue,
  reschedule,
  paymentNotice,
  feedback,
  onBackToBookings
}: Props) => {
  const now = useNow();
  const dateLabel = consultationDateLabel(booking.scheduledAt, timezone);
  const timeRange = consultationTimeRange(booking.scheduledAt, booking.estimateDurationMinutes, timezone);
  const countdown = describeStart(booking.scheduledAt, now);
  const doctor = booking.provider;
  // There is nothing to join until a doctor is assigned, whatever the clock says.
  const joinOpen = Boolean(doctor) && isWithinJoinWindow(booking.scheduledAt, booking.estimateDurationMinutes, now, joinWindowBeforeMinutes);
  const opensAt = joinOpensAt(booking.scheduledAt, joinWindowBeforeMinutes, timezone);
  const reference = bookingReference(booking.id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-12 pt-20">
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
          <h1 className="truncate text-xl font-bold text-slate-900">Telemedicine consultation</h1>
          {booking.service?.name && booking.service.name !== "Telemedicine consultation" && booking.service.name !== "Video consultation" && (
            <p className="truncate text-sm text-slate-600">{booking.service.name}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClassName}`}>{statusLabel}</span>
      </header>

      {paymentNotice}

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
            {countdown && doctor && (
              <p role="status" className="mt-2 text-sm font-semibold text-tiba-blue">
                {countdown}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-base text-slate-700">The time has not been set yet.</p>
        )}
      </section>

      <section aria-label="Your doctor" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle>Your doctor</SectionTitle>
        {doctor ? (
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-lg font-bold text-brand-600">
              {doctor.avatarUrl ? (
                <img src={doctor.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (doctor.fullName?.[0] ?? "D")
              )}
            </div>
            <p className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">{doctor.fullName}</p>
            <Button type="button" variant="outline" size="sm" icon={<MessageCircle className="h-4 w-4" />} onClick={onChat}>
              Message
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-base text-slate-700">
            We are finding a doctor for you. We will tell you as soon as one is assigned.
          </p>
        )}
      </section>

      <section aria-label="Join" className="space-y-3">
        {unattended ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Nobody joined this consultation. You can suggest a new time below.
          </p>
        ) : joinOpen ? (
          <Button type="button" className="min-h-[56px] w-full text-base" icon={<Video className="h-5 w-5" />} onClick={onJoin}>
            Join call
          </Button>
        ) : !doctor ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            There is no call to join yet because a doctor has not been assigned. We will tell you as soon as one is. If the time no longer suits you, you can suggest a new one or cancel below.
          </p>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {opensAt
              ? `The call opens at ${opensAt}, ${joinWindowBeforeMinutes} minutes before your appointment. This page will show a Join button then.`
              : "The call opens shortly before your appointment. This page will show a Join button then."}
          </p>
        )}
      </section>

      <div className="space-y-2">
        {reschedule}
        {noShowReported ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            You reported that your doctor did not join. We are looking into it.
          </p>
        ) : (
          reportNoShow && (
            <Button type="button" variant="ghost" className={secondaryActionClass} onClick={reportNoShow}>
              My doctor did not join
            </Button>
          )
        )}
        {reportTechnicalIssue && (
          <Button type="button" variant="ghost" className={secondaryActionClass} onClick={reportTechnicalIssue}>
            Report a technical problem
          </Button>
        )}
        {cancel && (
          <Button type="button" variant="ghost" className={secondaryActionClass} onClick={cancel.onClick} loading={cancel.loading}>
            {cancel.label}
          </Button>
        )}
      </div>

      <p className="text-sm text-slate-600">
        Fee: <span className="font-semibold text-slate-900">{booking.currency} {(booking.priceCents / 100).toLocaleString()}</span>
      </p>

      {feedback}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500">
        <span>
          Reference <span className="font-mono font-semibold text-slate-700">{reference}</span>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(reference).catch(() => undefined)}
            className="ml-2 font-semibold text-tiba-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
          >
            Copy
          </button>
        </span>
        <button
          type="button"
          onClick={onBackToBookings}
          className="min-h-[44px] font-semibold text-tiba-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
        >
          Back to my bookings
        </button>
      </footer>
    </div>
  );
};

export default VideoConsultationDetails;
