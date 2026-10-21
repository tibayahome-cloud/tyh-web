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
import { useTelemedicineReschedules } from "../../../../shared/hooks/useTelemedicine";
import { useOpenBookingChat } from "../../../../shared/hooks/useOpenBookingChat";
import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import { Button } from "../../../../shared/components/Button";
import { useToast } from "../../../../shared/components/ToastProvider";
import ReassignBookingModal from "../../components/ReassignBookingModal";
import TelemedicineReassignModal from "../../components/TelemedicineReassignModal";
import CancelBookingDialog from "../../components/CancelBookingDialog";
import { formatTelemedicineDateTime } from "../../../../shared/utils/telemedicine";

// Final states: nothing can be cancelled or assigned from here.
const CLOSED_STATUSES = [
  "cancelled_by_client",
  "cancelled_by_admin",
  "telemedicine_cancelled_payment_review",
  "fully_completed",
  "disputed"
];

const STK_PUSH_ELIGIBLE_STATUSES = ["client_completed", "completed_by_provider"];

const AdminBookingDetailPage = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const detailQuery = useBookingDetail(bookingId ?? null, "detail");
  const eventsQuery = useBookingEvents(bookingId ?? null);
  const reschedulesQuery = useTelemedicineReschedules(bookingId ?? null, { enabled: Boolean(detailQuery.data?.isTelemedicine) });
  const cancelMutation = useCancelBookingMutation("detail");
  const stkPushMutation = usePayBookingMutation("detail");
  const toast = useToast();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [stkModalOpen, setStkModalOpen] = useState(false);
  const [stkPhone, setStkPhone] = useState("");
  const [stkPhoneError, setStkPhoneError] = useState("");
  const { openBookingChat } = useOpenBookingChat("/admin/conversations");
  const dispatchChat = (id: string) => void openBookingChat(id);

  const booking = detailQuery.data;
  const events = eventsQuery.data ?? [];
  const reschedules = reschedulesQuery.data ?? [];
  const participantLabel = (userId: string | null) => {
    if (userId && userId === booking?.client?.id) return "Client";
    if (userId && userId === booking?.provider?.id) return "Provider";
    return "Participant";
  };
  const canReassignTelemedicine = Boolean(
    booking?.isTelemedicine &&
      booking.provider &&
      !booking.telemedicineSession?.providerJoinedAt &&
      !booking.telemedicineSession?.clientJoinedAt &&
      !["in_progress", "ended", "expired", "technical_review"].includes(booking.telemedicineSession?.status ?? "")
  );

  const canAssignTelemedicine = Boolean(
    booking?.isTelemedicine && !booking.provider && booking.status === "telemedicine_paid_pending_assignment"
  );

  const handleCancelConfirm = async (finalReason: string) => {
    if (!booking) {
      return;
    }
    try {
      await cancelMutation.mutateAsync({ bookingId: booking.id, reason: finalReason });
      toast.showToast({ title: "Booking cancelled", variant: "success" });
      setCancelDialogOpen(false);
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
          {!booking.isTelemedicine && !CLOSED_STATUSES.includes(booking.status) && (
            <Button variant="secondary" onClick={() => setReassignOpen(true)}>
              Reassign provider
            </Button>
          )}
          {canAssignTelemedicine && (
            <Button onClick={() => setReassignOpen(true)}>Assign provider</Button>
          )}
          {canReassignTelemedicine && (
            <Button variant="secondary" onClick={() => setReassignOpen(true)}>
              Reassign provider
            </Button>
          )}
          {STK_PUSH_ELIGIBLE_STATUSES.includes(booking.status) && (
            <Button variant="secondary" onClick={openStkPushModal}>
              Request payment (STK push)
            </Button>
          )}
          {!CLOSED_STATUSES.includes(booking.status) && (
            <Button
              variant="secondary"
              className="border-rose-200 text-rose-600 hover:bg-rose-50"
              onClick={() => setCancelDialogOpen(true)}
            >
              Cancel booking
            </Button>
          )}
        </div>
      </div>

      {booking.status === "telemedicine_cancelled_payment_review" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <p className="font-semibold">This booking was cancelled after payment.</p>
          <p className="mt-1">
            It cannot be reopened or given a provider. The payment is waiting for a refund decision. If the client still needs a
            consultation, they need to book a new one.
          </p>
        </div>
      )}

      {booking.isTelemedicine ? (
        <Card title="Telemedicine consultation" description="Remote appointment details and session state">
          <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Appointment</p>
              <p className="mt-1 font-medium">{formatTelemedicineDateTime(booking.scheduledAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Provider</p>
              <p className="mt-1 font-medium">{booking.provider?.fullName ?? "Unassigned"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Session</p>
              <p className="mt-1 font-medium">{booking.telemedicineSession?.status ?? "Not started"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duration</p>
              <p className="mt-1 font-medium">
                {booking.estimateDurationMinutes ? `${booking.estimateDurationMinutes} minutes` : "Not provided"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Assign or reassign the provider from this page. The telemedicine workspace lists every consultation awaiting a provider.
            <Link className="ml-1 font-semibold text-primary-700 hover:underline" to="/admin/telemedicine">
              Open workspace
            </Link>
          </p>
        </Card>
      ) : (
        <BookingLiveMapCard bookingId={booking.id} role="admin" onOpenChat={dispatchChat} />
      )}

      {booking.isTelemedicine && (reschedulesQuery.isLoading || reschedules.length > 0) && (
        <Card title="Reschedule history" description="Proposals and responses recorded for this consultation">
          {reschedulesQuery.isLoading ? (
            <Loading />
          ) : (
            <ol className="space-y-3">
              {reschedules.map((request) => (
                <li key={request.id} className="rounded-xl border border-slate-100 bg-white px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {participantLabel(request.requestedByUserId)} proposal
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                      {request.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-slate-700">
                    {request.proposedStartAt
                      ? formatTelemedicineDateTime(request.proposedStartAt)
                      : "No proposed appointment time"}
                  </p>
                  {request.reason && <p className="mt-1 text-slate-500">Reason: {request.reason}</p>}
                  {request.responseNote && <p className="mt-1 text-slate-500">Response: {request.responseNote}</p>}
                  {request.resolvedAt && (
                    <p className="mt-1 text-xs text-slate-400">
                      Resolved {new Date(request.resolvedAt).toLocaleString()}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

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
                  {Boolean(event.payload?.reason) && (
                    <p className="text-xs text-slate-500">Reason: {String(event.payload.reason)}</p>
                  )}
                  {Boolean(event.payload?.note) && (
                    <p className="text-xs text-slate-500">Note: {String(event.payload.note)}</p>
                  )}
                </li>
              ))}
          </ol>
        )}
      </Card>
      {booking.isTelemedicine ? (
        <TelemedicineReassignModal
          bookingId={reassignOpen ? booking.id : null}
          currentProviderName={booking.provider?.fullName}
          mode={canAssignTelemedicine ? "assign" : "reassign"}
          open={reassignOpen}
          onClose={() => setReassignOpen(false)}
          onSuccess={() => detailQuery.refetch()}
        />
      ) : (
        <ReassignBookingModal
          bookingId={reassignOpen ? booking.id : null}
          open={reassignOpen}
          onClose={() => setReassignOpen(false)}
          onSuccess={() => detailQuery.refetch()}
        />
      )}
      <CancelBookingDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelConfirm}
        loading={cancelMutation.isPending}
        paidTelemedicine={Boolean(booking.isTelemedicine && booking.paidAt)}
      />

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
