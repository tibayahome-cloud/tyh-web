import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import classNames from "classnames";

import { BookingLiveMapCard } from "../../../shared/components/BookingLiveMapCard";
import {
  useBookingDetail,
  useBookingEvents,
  useMarkBookingMutation,
  usePayBookingMutation
} from "../../../shared/hooks/useBookings";
import { Card } from "../../../shared/components/Card";
import { Loading } from "../../../shared/components/Loading";
import { Button } from "../../../shared/components/Button";
import { useToast } from "../../../shared/components/ToastProvider";
import { BookingNotesPanel } from "../components/BookingNotesPanel";

const STK_PUSH_ELIGIBLE_STATUSES = ["client_completed", "completed_by_provider"];

const ACTION_COPY: Record<
  string,
  { label: string; helper: string; action?: "en_route" | "nearby" | "arrived" | "start_service" | "complete" }
> = {
  accepted: {
    label: "Begin trip",
    helper: "Signal that you are on the way to the client.",
    action: "en_route"
  },
  en_route: {
    label: "Mark as nearby",
    helper: "Let the client know you are minutes away.",
    action: "nearby"
  },
  nearby: {
    label: "Confirm arrival",
    helper: "Updates the booking to show that you are on site.",
    action: "arrived"
  },
  arrived: {
    label: "Start service",
    helper: "Kick off the service timer and begin work.",
    action: "start_service"
  },
  in_service: {
    label: "Complete service",
    helper: "Finish the session. The client will confirm delivery.",
    action: "complete"
  },
  completed_by_provider: {
    label: "Awaiting client confirmation",
    helper: "We have notified the client to confirm and pay."
  },
  client_completed: {
    label: "Job finished",
    helper: "Thanks! Keep an eye on new requests."
  },
  client_confirmed: {
    label: "Job finished",
    helper: "Thanks! Keep an eye on new requests."
  },
  default: {
    label: "Tracking in progress",
    helper: "No manual action is required at this stage."
  }
};

const ProviderBookingDetailPage = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const detailQuery = useBookingDetail(bookingId ?? null, "detail");
  const eventsQuery = useBookingEvents(bookingId ?? null);
  const markMutation = useMarkBookingMutation("detail");
  const stkPushMutation = usePayBookingMutation("detail");
  const toast = useToast();

  const [stkModalOpen, setStkModalOpen] = useState(false);
  const [stkPhone, setStkPhone] = useState("");
  const [stkPhoneError, setStkPhoneError] = useState("");

  const dispatchChat = (id: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chat:open", { detail: { bookingId: id, role: "provider" } }));
    }
  };

  const booking = detailQuery.data;
  const events = eventsQuery.data ?? [];
  const actionCopy = booking ? ACTION_COPY[booking.status] ?? ACTION_COPY.default : ACTION_COPY.default;
  const canAdvance = Boolean(actionCopy.action);

  const handlePrimaryAction = async () => {
    if (!booking || !actionCopy.action) {
      return;
    }
    try {
      await markMutation.mutateAsync({ bookingId: booking.id, action: actionCopy.action });
      toast.showToast({
        title: "Status updated",
        description: `${actionCopy.label} recorded successfully.`,
        variant: "success"
      });
    } catch (error) {
      toast.showToast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again.",
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

  const handleCallClient = () => {
    if (!booking?.client?.phone || typeof window === "undefined") {
      return;
    }
    window.location.href = `tel:${booking.client.phone}`;
  };

  if (detailQuery.isLoading) {
    return <Loading fullHeight />;
  }

  if (!booking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        Booking not found.{" "}
        <Link className="text-primary-600" to="/pro/home">
          Return home
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
          <Button variant="secondary" onClick={handleCallClient} disabled={!booking.client?.phone}>
            Call client
          </Button>
          <Button variant="secondary" onClick={dispatchChat.bind(null, booking.id)}>
            Message client
          </Button>
          {STK_PUSH_ELIGIBLE_STATUSES.includes(booking.status) && (
            <Button variant="secondary" onClick={openStkPushModal}>
              Request payment (STK push)
            </Button>
          )}
          {canAdvance && (
            <Button onClick={handlePrimaryAction} loading={markMutation.isPending}>
              {actionCopy.label}
            </Button>
          )}
        </div>
      </div>

      <BookingLiveMapCard bookingId={booking.id} role="provider" onOpenChat={dispatchChat} />

      {["accepted", "en_route", "nearby", "arrived", "in_service", "completed_by_provider"].includes(
        booking.status
      ) && <BookingNotesPanel bookingId={booking.id} serviceId={booking.service?.id} isProvider />}

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
          <Button
            variant="ghost"
            className="flex-1 rounded-xl h-12"
            onClick={closeStkPushModal}
            disabled={stkPushMutation.isPending}
          >
            Cancel
          </Button>
          <Button className="flex-1 rounded-xl h-12" onClick={handleSendStkPush} loading={stkPushMutation.isPending}>
            Send STK push
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ProviderBookingDetailPage;