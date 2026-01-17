import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../shared/components/Button";
import { Spinner } from "../../../shared/components/Spinner";
import { useCancelBookingMutation } from "../../../shared/hooks/useBookings";
import { useToast } from "../../../shared/components/ToastProvider";
import type { Booking } from "../../../shared/schemas/booking";

type BookingSearchStatusProps = {
  booking: Booking;
  onView: () => void;
  onCancel?: () => void;
};

const formatCountdown = (ms: number | null) => {
  if (ms === null) {
    return "—";
  }
  const clamped = Math.max(0, ms);
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const BookingSearchStatus = ({ booking, onView, onCancel }: BookingSearchStatusProps) => {
  const cancelMutation = useCancelBookingMutation();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(() => {
    if (!booking.escalationAt) {
      return null;
    }
    return new Date(booking.escalationAt).getTime() - Date.now();
  });

  const serviceName = booking.service?.name ?? "Service request";
  const countdownLabel = formatCountdown(remainingMs);

  useEffect(() => {
    if (!booking.escalationAt) {
      return;
    }
    const interval = setInterval(() => {
      setRemainingMs(new Date(booking.escalationAt as string).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [booking.escalationAt]);

  const handleCancel = async () => {
    try {
      if (onCancel) {
        onCancel();
      }
      await cancelMutation.mutateAsync({ bookingId: booking.id, reason: "client_cancelled_during_matching" });
      showToast({
        title: "Request cancelled",
        description: "We stopped matching this request. Start a new booking anytime.",
        variant: "info"
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We could not cancel the booking. Please try again.";
      showToast({
        title: "Unable to cancel",
        description: message,
        variant: "error"
      });
    }
  };

  const showCountdown = Boolean(booking.escalationAt);
  const escalationEta = useMemo(() => {
    if (!booking.escalationAt) {
      return null;
    }
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(booking.escalationAt));
    } catch {
      return null;
    }
  }, [booking.escalationAt]);

  return (
    <section className="overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-brand-600 via-brand-500 to-accent-500 p-6 text-white shadow-elevated">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/80">Matching in progress</p>
          <h3 className="mt-1 text-2xl font-semibold">Finding a provider for {serviceName}</h3>
          <p className="mt-1 text-sm text-white/80">
            Nearby providers are reviewing your request. Sit tight—we’ll notify you the moment someone accepts.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold">
          <div className="flex flex-col text-center leading-tight">
            <span className="text-xs uppercase tracking-wide text-white/70">SLA countdown</span>
            <span className="text-lg font-bold">{showCountdown ? countdownLabel : "—"}</span>
          </div>
          {escalationEta && (
            <span className="text-xs text-white/70">Escalates ~ {escalationEta}</span>
          )}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold">
          <Spinner tone="inverted" />
          <span>Searching nearby providers…</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onView}>
            View request
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Cancel request
          </Button>
        </div>
      </div>
      {confirming && (
        <div className="mt-4 rounded-2xl bg-white/10 p-4">
          <p className="text-sm text-white">
            Cancel this request? Providers will stop receiving your invite.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={cancelMutation.isPending}
            >
              Keep searching
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleCancel}
              loading={cancelMutation.isPending}
            >
              Yes, cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

export default BookingSearchStatus;
