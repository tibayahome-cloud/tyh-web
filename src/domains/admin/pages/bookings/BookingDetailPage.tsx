import { useParams, Link } from "react-router-dom";
import { useState } from "react";

import { BookingLiveMapCard } from "../../../../shared/components/BookingLiveMapCard";
import { useBookingDetail, useBookingEvents, useCancelBookingMutation } from "../../../../shared/hooks/useBookings";
import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import { Button } from "../../../../shared/components/Button";
import { useToast } from "../../../../shared/components/ToastProvider";
import ReassignBookingModal from "../../components/ReassignBookingModal";
import ConfirmDialog from "../../../../shared/components/ConfirmDialog";
import { ADMIN_CANCELLATION_REASONS, formatCancellationReason } from "../../../../shared/constants/bookings";

const AdminBookingDetailPage = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const detailQuery = useBookingDetail(bookingId ?? null, "detail");
  const eventsQuery = useBookingEvents(bookingId ?? null);
  const cancelMutation = useCancelBookingMutation("detail");
  const toast = useToast();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState(ADMIN_CANCELLATION_REASONS[0].value);
  const [cancelNote, setCancelNote] = useState("");
  const dispatchChat = (id: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chat:open", { detail: { bookingId: id } }));
    }
  };

  const booking = detailQuery.data;
  const events = eventsQuery.data ?? [];

  const handleCancelConfirm = async () => {
    if (!booking) {
      return;
    }
    try {
      const finalReason = formatCancellationReason(cancelReasonCode, cancelNote);
      await cancelMutation.mutateAsync({ bookingId: booking.id, reason: finalReason });
      toast.showToast({ title: "Booking cancelled", variant: "success" });
      setCancelDialogOpen(false);
      setCancelNote("");
    } catch (error) {
      toast.showToast({
        title: "Cancellation failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "error"
      });
    }
  };

  if (detailQuery.isLoading) {
    return <Loading fullHeight />;
  }

  if (!booking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        Booking not found. <Link className="text-primary-600" to="/admin/bookings/monitoring">
          Return to monitor
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Booking {booking.id}</h1>
          <p className="text-sm text-slate-500">
            {booking.client?.fullName ?? "Client"} · {booking.service?.name ?? "Service"} · {booking.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setReassignOpen(true)}>
            Reassign provider
          </Button>
          <Button
            variant="secondary"
            className="border-rose-200 text-rose-600 hover:bg-rose-50"
            onClick={() => {
              setCancelReasonCode(ADMIN_CANCELLATION_REASONS[0].value);
              setCancelNote("");
              setCancelDialogOpen(true);
            }}
          >
            Cancel booking
          </Button>
        </div>
      </div>

      <BookingLiveMapCard bookingId={booking.id} role="admin" onOpenChat={dispatchChat} />

      <Card title="Event timeline" description="Audit trail for this booking">
        {eventsQuery.isLoading ? (
          <Loading />
        ) : events.length === 0 ? (
          <p className="text-sm text-slate-500">No events yet.</p>
        ) : (
          <ol className="space-y-3">
            {events
              .slice()
              .reverse()
              .map((event) => (
                <li key={event.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{event.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-400">{event.at ? new Date(event.at).toLocaleString() : ""}</p>
                  </div>
                  {event.payload?.reason && (
                    <p className="text-xs text-slate-500">Reason: {String(event.payload.reason)}</p>
                  )}
                  {event.payload?.note && (
                    <p className="text-xs text-slate-500">Note: {String(event.payload.note)}</p>
                  )}
                </li>
              ))}
          </ol>
        )}
      </Card>
      <ReassignBookingModal
        bookingId={reassignOpen ? booking.id : null}
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        onSuccess={() => detailQuery.refetch()}
      />
      <ConfirmDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelConfirm}
        loading={cancelMutation.isPending}
        title="Cancel booking"
        description="Let the client and provider know why this booking is being cancelled."
        confirmLabel="Cancel booking"
        confirmVariant="secondary"
      >
        <label className="mt-3 flex flex-col gap-1 text-sm text-slate-700">
          <span>Reason</span>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            value={cancelReasonCode}
            onChange={(event) => setCancelReasonCode(event.target.value)}
          >
            {ADMIN_CANCELLATION_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
                {reason.description ? ` — ${reason.description}` : ""}
              </option>
            ))}
          </select>
        </label>
        <textarea
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          rows={3}
          value={cancelNote}
          onChange={(event) => setCancelNote(event.target.value)}
          placeholder="Internal note (optional)"
        />
      </ConfirmDialog>
    </div>
  );
};

export default AdminBookingDetailPage;
