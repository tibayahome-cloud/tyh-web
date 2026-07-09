import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import classNames from "classnames";

import { BookingLiveMapCard } from "../../../../shared/components/BookingLiveMapCard";
import {
  useBookingDetail,
  useBookingEvents,
  useCancelBookingMutation,
  usePayBookingMutation
} from "../../../../shared/hooks/useBookings";
import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import { Button } from "../../../../shared/components/Button";
import { useToast } from "../../../../shared/components/ToastProvider";
import ReassignBookingModal from "../../components/ReassignBookingModal";
import ConfirmDialog from "../../../../shared/components/ConfirmDialog";
import { ADMIN_CANCELLATION_REASONS, formatCancellationReason } from "../../../../shared/constants/bookings";

const STK_PUSH_ELIGIBLE_STATUSES = ["client_completed", "completed_by_provider"];

const AdminBookingDetailPage = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const detailQuery = useBookingDetail(bookingId ?? null, "detail");
  const eventsQuery = useBookingEvents(bookingId ?? null);
  const cancelMutation = useCancelBookingMutation("detail");
  const stkPushMutation = usePayBookingMutation("detail");
  const toast = useToast();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState(ADMIN_CANCELLATION_REASONS[0].value);
  const [cancelNote, setCancelNote] = useState("");
  const [stkModalOpen, setStkModalOpen] = useState(false);
  const [stkPhone, setStkPhone] = useState("");
  const [stkPhoneError, setStkPhoneError] = useState("");
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

  const openStkPushModal = () => {
    const defaultPhone = booking?.client?.phone?.replace(/^\+254/, "0") ?? "";
    setStkPhone(defaultPhone);
    setStkPhoneError("");
    setStkModalOpen(true);
  };

  const closeStkPushModal = () => {
    if (stkPushMutation.isPending) {
      return;
    }
    setStkModalOpen(false);
  };

  const handleSendStkPush = async () => {
    if (!booking) {
      return;
    }
    if (!/^(07|01)\d{8}$|^(\+?254)(7|1)\d{8}$/.test(stkPhone.trim())) {
      setStkPhoneError("Enter a valid Safaricom number e.g. 0712345678");
      return;
    }
    setStkPhoneError("");
    try {
      await stkPushMutation.mutateAsync({ bookingId: booking.id, phone: stkPhone.trim(), method: "mpesa" });
      toast.showToast({
        title: "STK push sent",
        description: "The client should receive a payment prompt shortly.",
        variant: "success"
      });
      setStkModalOpen(false);
    } catch (error) {
      toast.showToast({
        title: "Failed to send STK push",
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
          {STK_PUSH_ELIGIBLE_STATUSES.includes(booking.status) && (
            <Button variant="success" onClick={openStkPushModal}>
              Request payment (STK push)
            </Button>
          )}
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

      <Dialog
        disablePortal={false}
        container={() => document.body}
        open={stkModalOpen}
        onClose={closeStkPushModal}
        PaperProps={{ sx: { borderRadius: "24px", p: 1 } }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle className="text-xl font-bold text-slate-900">Request payment</DialogTitle>
        <DialogContent>
          <p className="text-sm text-slate-500 leading-relaxed">
            Send an M-Pesa STK push to the client to collect payment for this booking.
          </p>
          <div className="mt-4 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
              M-Pesa phone number
            </label>
            <input
              type="tel"
              value={stkPhone}
              onChange={(event) => {
                setStkPhone(event.target.value);
                setStkPhoneError("");
              }}
              placeholder="e.g. 0712345678"
              disabled={stkPushMutation.isPending}
              className={classNames(
                "w-full rounded-xl border px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition-colors",
                "placeholder:text-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500",
                stkPhoneError ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"
              )}
            />
            {stkPhoneError && <p className="text-[11px] text-red-500 font-medium pl-1">{stkPhoneError}</p>}
          </div>
        </DialogContent>
        <DialogActions className="p-4 gap-2">
          <Button variant="ghost" className="flex-1 rounded-xl h-12" onClick={closeStkPushModal} disabled={stkPushMutation.isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl h-12"
            onClick={handleSendStkPush}
            loading={stkPushMutation.isPending}
          >
            Send STK push
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AdminBookingDetailPage;