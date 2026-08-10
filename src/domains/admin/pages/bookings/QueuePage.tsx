import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

import { Card } from "../../../../shared/components/Card";
import { Button } from "../../../../shared/components/Button";
import { Loading } from "../../../../shared/components/Loading";
import { Input } from "../../../../shared/components/Input";
import { useBookingList, useCancelBookingMutation } from "../../../../shared/hooks/useBookings";
import { updateDispute } from "../../../../shared/libs/bookings";
import { useToast } from "../../../../shared/components/ToastProvider";
import { useMediaQuery } from "../../../../shared/hooks/useMediaQuery";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReassignBookingModal from "../../components/ReassignBookingModal";
import ConfirmDialog from "../../../../shared/components/ConfirmDialog";
import { AdminCreateBookingDialog } from "../../components/AdminCreateBookingDialog";
import { ADMIN_CANCELLATION_REASONS, formatCancellationReason } from "../../../../shared/constants/bookings";
import type { BookingDispute } from "../../../../shared/schemas/booking";

const ACTIVE_STATUSES = [
  "requested",
  "broadcasting",
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service"
] as const;

const TABS = [
  { key: "active", label: "Active", statuses: ACTIVE_STATUSES },
  { key: "confirm", label: "Awaiting confirmation", statuses: ["completed_by_provider"] },
  { key: "disputes", label: "Disputed", statuses: ["disputed"] },
  { key: "escalations", label: "Escalations", statuses: ACTIVE_STATUSES }
] as const;

export const formatFacilityResponseWindow = (dueAt: string | null, nowMs = Date.now()): string => {
  if (!dueAt) return "-";
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) return "-";
  const remainingSeconds = Math.max(0, Math.ceil((dueMs - nowMs) / 1000));
  if (remainingSeconds === 0) return "Expired";
  return `${Math.floor(remainingSeconds / 60)}m ${String(remainingSeconds % 60).padStart(2, "0")}s`;
};

const AdminBookingQueuePage = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState(ADMIN_CANCELLATION_REASONS[0].value);
  const [cancelNote, setCancelNote] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [reviewDispute, setReviewDispute] = useState<BookingDispute | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"under_review" | "resolved" | "rejected">("under_review");
  const [reviewNote, setReviewNote] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobileFilters = useMediaQuery("(max-width: 640px)");
  const [appliedFilters, setAppliedFilters] = useState({
    clientId: "",
    providerId: "",
    serviceId: "",
    from: "",
    to: ""
  });
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const toast = useToast();
  const queryClient = useQueryClient();
  const cancelMutation = useCancelBookingMutation("detail");
  const resolveDisputeMutation = useMutation({
    mutationFn: ({ disputeId, status, resolution }: { disputeId: string; status: typeof reviewStatus; resolution?: string }) =>
      updateDispute(disputeId, { status, resolution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings", "list"], exact: false }).catch(() => undefined);
    }
  });

  const bookingQuery = useBookingList(
    {
      statuses: tab.statuses as string[],
      pageSize: 50,
      preset: "card",
      clientId: appliedFilters.clientId || undefined,
      providerId: appliedFilters.providerId || undefined,
      serviceId: appliedFilters.serviceId || undefined,
      from: appliedFilters.from || undefined,
      to: appliedFilters.to || undefined
    },
    { enabled: true, refetchInterval: 30_000 }
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const bookings = useMemo(() => {
    const rows = bookingQuery.data?.bookings ?? [];
    if (tab.key === "escalations") {
      return rows.filter((booking) => booking.meta?.escalation_at);
    }
    return rows;
  }, [bookingQuery.data?.bookings, tab.key]);

  const openReassignModal = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setReassignOpen(true);
  };

  const openCancelDialog = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setCancelReasonCode(ADMIN_CANCELLATION_REASONS[0].value);
    setCancelNote("");
    setCancelDialogOpen(true);
  };

  const openReviewDialog = (dispute: BookingDispute) => {
    setReviewDispute(dispute);
    setReviewStatus("under_review");
    setReviewNote(dispute.resolution ?? "");
  };

  const handleResolveDispute = async () => {
    if (!reviewDispute) {
      return;
    }
    try {
      await resolveDisputeMutation.mutateAsync({
        disputeId: reviewDispute.id,
        status: reviewStatus,
        resolution: reviewNote.trim() || undefined
      });
      toast.showToast({ title: "Dispute updated", variant: "success" });
      setReviewDispute(null);
      bookingQuery.refetch();
    } catch (error) {
      toast.showToast({
        title: "Unable to update dispute",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "error"
      });
    }
  };

  const handleCancelConfirm = async () => {
    if (!selectedBookingId) {
      return;
    }
    try {
      const finalReason = formatCancellationReason(cancelReasonCode, cancelNote);
      await cancelMutation.mutateAsync({ bookingId: selectedBookingId, reason: finalReason });
      toast.showToast({ title: "Booking cancelled", variant: "success" });
      setCancelDialogOpen(false);
      setCancelNote("");
      bookingQuery.refetch();
    } catch (error) {
      toast.showToast({
        title: "Cancellation failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "error"
      });
    }
  };

  useEffect(() => {
    if (!filtersOpen || isMobileFilters) {
      return;
    }
    const handleClickAway = (event: MouseEvent) => {
      if (!filterMenuRef.current) {
        return;
      }
      if (!filterMenuRef.current.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("keydown", handleKey);
    };
  }, [filtersOpen, isMobileFilters]);

  const openFilters = () => {
    setDraftFilters(appliedFilters);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    const cleared = { clientId: "", providerId: "", serviceId: "", from: "", to: "" };
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setFiltersOpen(false);
  };

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (appliedFilters.clientId) {
      chips.push(`Client: ${appliedFilters.clientId}`);
    }
    if (appliedFilters.providerId) {
      chips.push(`Provider: ${appliedFilters.providerId}`);
    }
    if (appliedFilters.serviceId) {
      chips.push(`Service: ${appliedFilters.serviceId}`);
    }
    if (appliedFilters.from) {
      chips.push(`From ${appliedFilters.from}`);
    }
    if (appliedFilters.to) {
      chips.push(`To ${appliedFilters.to}`);
    }
    return chips;
  }, [appliedFilters]);

  const filterPanel = (
    <div className="space-y-4 text-left">
      <Input
        label="Client ID"
        placeholder="client_user_id"
        value={draftFilters.clientId}
        onChange={(event) => setDraftFilters((prev) => ({ ...prev, clientId: event.target.value }))}
      />
      <Input
        label="Provider ID"
        placeholder="provider_user_id"
        value={draftFilters.providerId}
        onChange={(event) => setDraftFilters((prev) => ({ ...prev, providerId: event.target.value }))}
      />
      <Input
        label="Service ID"
        placeholder="service_id"
        value={draftFilters.serviceId}
        onChange={(event) => setDraftFilters((prev) => ({ ...prev, serviceId: event.target.value }))}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span>From</span>
          <input
            type="date"
            value={draftFilters.from}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, from: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span>To</span>
          <input
            type="date"
            value={draftFilters.to}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, to: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={clearFilters}>
          Clear
        </Button>
        <Button type="button" onClick={applyFilters}>
          Apply
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Booking queue</h1>
          <p className="text-sm text-slate-500">Triage client requests, escalations, and pending confirmations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Create Booking
          </Button>
          {TABS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`rounded-full border px-4 py-1 text-sm font-semibold transition ${
                tab.key === option.key
                  ? "border-primary-200 bg-primary-50 text-primary-800 shadow-inner"
                  : "border-transparent bg-slate-200 text-slate-600 hover:bg-slate-300"
              }`}
              onClick={() => setTab(option)}
            >
              {option.label}
            </button>
          ))}
          <div ref={filterMenuRef} className="relative">
            <Button variant={activeFilterChips.length ? "primary" : "secondary"} onClick={openFilters}>
              Filters
            </Button>
            {filtersOpen &&
              (isMobileFilters ? (
                <>
                  <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => setFiltersOpen(false)} />
                  <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-5 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-base font-semibold text-slate-900">Filters</p>
                      <button
                        type="button"
                        className="text-sm font-medium text-slate-500"
                        onClick={() => setFiltersOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    {filterPanel}
                  </div>
                </>
              ) : (
                <div className="absolute left-0 z-[60] mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:left-auto md:right-0">
                  {filterPanel}
                </div>
              ))}
          </div>
        </div>
      </div>
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          {activeFilterChips.map((chip) => (
            <span key={chip} className="rounded-full bg-slate-200 px-3 py-1">
              {chip}
            </span>
          ))}
        </div>
      )}

      <Card>
        {bookingQuery.isLoading ? (
          <div className="py-12 text-center">
            <Loading label="Loading bookings…" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No bookings in this queue.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Booking</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Provider</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Facility response</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Last update</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{booking.service?.name ?? "Service"}</div>
                      <div className="text-xs text-slate-500">{booking.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">{booking.client?.fullName ?? "—"}</div>
                      <div className="text-xs text-slate-500">{booking.client?.email ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {booking.provider?.fullName ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {booking.status.replace(/_/g, " ")}
                      </span>
                      {booking.meta?.escalation_at && (
                        <p className="text-xs font-semibold text-rose-600">Escalation pending</p>
                      )}
                      {tab.key === "disputes" &&
                        booking.disputes
                          .filter((dispute) => dispute.status === "open" || dispute.status === "under_review")
                          .map((dispute) => (
                            <div key={dispute.id} className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                              <p className="font-semibold uppercase tracking-wide">
                                {(dispute.disputeType ?? "dispute").replace(/_/g, " ")}
                              </p>
                              {dispute.reason && <p className="mt-1">{dispute.reason}</p>}
                              <Button
                                size="sm"
                                variant="secondary"
                                className="mt-2 px-2 py-1 text-[11px]"
                                onClick={() => openReviewDialog(dispute)}
                              >
                                Review
                              </Button>
                            </div>
                          ))}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={booking.facilityStatus === "expired" ? "font-semibold text-rose-600" : "text-slate-600"}>
                        {booking.facilityStatus === "expired"
                          ? booking.requestMode === "selected_facility" ? "Reroute confirmation required" : "Rerouted or awaiting next facility"
                          : formatFacilityResponseWindow(booking.facilityResponseDueAt, nowMs)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {booking.updatedAt ? new Date(booking.updatedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/admin/bookings/${booking.id}`}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          View
                        </Link>
                        <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => openReassignModal(booking.id)}>
                          Reassign
                        </Button>
                        <Button
                          variant="secondary"
                          className="border-rose-200 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50"
                          onClick={() => openCancelDialog(booking.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReassignBookingModal
        bookingId={reassignOpen ? selectedBookingId : null}
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        onSuccess={() => bookingQuery.refetch()}
      />
      <ConfirmDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelConfirm}
        loading={cancelMutation.isPending}
        title="Cancel booking"
        description="Provide a reason so the client and provider are notified."
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

      <AdminCreateBookingDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => bookingQuery.refetch()}
      />

      <ConfirmDialog
        open={Boolean(reviewDispute)}
        onClose={() => {
          if (!resolveDisputeMutation.isPending) {
            setReviewDispute(null);
          }
        }}
        onConfirm={handleResolveDispute}
        loading={resolveDisputeMutation.isPending}
        title="Review dispute"
        description={reviewDispute?.reason ?? undefined}
        confirmLabel="Save"
      >
        <label className="mt-3 flex flex-col gap-1 text-sm text-slate-700">
          <span>Outcome</span>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value as typeof reviewStatus)}
          >
            <option value="under_review">Under review</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <textarea
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          rows={3}
          value={reviewNote}
          onChange={(event) => setReviewNote(event.target.value)}
          placeholder="Resolution notes (visible in the audit trail)"
        />
        <p className="mt-2 text-xs text-slate-500">
          This records a decision only -- refunds and payouts still happen through Payments.
        </p>
      </ConfirmDialog>
    </div>
  );
};

export default AdminBookingQueuePage;
