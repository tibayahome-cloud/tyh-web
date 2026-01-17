import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";

import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import type { MonitoringBooking } from "../../../../shared/hooks/useAdminMonitoring";
import { useAdminMonitoringFeed } from "../../../../shared/hooks/useAdminMonitoring";
import { MapView } from "../../../../shared/components/MapView";
import type { MapMarker, MapPolyline } from "../../../../shared/components/MapView";
import { Button } from "../../../../shared/components/Button";
import { useSocket } from "../../../../shared/hooks/useSocket";
import { useCancelBookingMutation } from "../../../../shared/hooks/useBookings";
import { useToast } from "../../../../shared/components/ToastProvider";
import { Link } from "react-router-dom";
import ReassignBookingModal from "../../components/ReassignBookingModal";
import ConfirmDialog from "../../../../shared/components/ConfirmDialog";
import { ADMIN_CANCELLATION_REASONS, formatCancellationReason } from "../../../../shared/constants/bookings";

const STATUS_FILTERS = [
  { label: "Active (default)", value: "active" },
  { label: "Recently completed", value: "completed" }
] as const;

const COMPLETED_STATUSES = ["completed_by_provider", "client_completed", "fully_completed", "client_confirmed", "paid"];
const ACTIVE_STATUSES = [
  "broadcasting",
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service",
  "completed_by_provider"
];

const statusToFilter = (key: string) => {
  if (key === "completed") {
    return COMPLETED_STATUSES;
  }
  return ACTIVE_STATUSES;
};

const statusClassMap: Record<string, string> = {
  broadcasting: "bg-sky-100 text-sky-700",
  accepted: "bg-indigo-100 text-indigo-700",
  en_route: "bg-amber-100 text-amber-700",
  nearby: "bg-emerald-100 text-emerald-700",
  arrived: "bg-emerald-100 text-emerald-700",
  in_service: "bg-purple-100 text-purple-700",
  completed_by_provider: "bg-slate-100 text-slate-700",
  client_completed: "bg-slate-200 text-slate-700",
  fully_completed: "bg-slate-200 text-slate-700",
  client_confirmed: "bg-slate-200 text-slate-700",
  paid: "bg-slate-200 text-slate-700",
  cancelled_by_client: "bg-rose-100 text-rose-700",
  cancelled_by_admin: "bg-rose-100 text-rose-700",
  disputed: "bg-amber-100 text-amber-700"
};

const formatLabel = (status: string) => status.replace(/_/g, " ");

const buildMarkers = (booking: MonitoringBooking): MapMarker[] => {
  const markers: MapMarker[] = [];
  if (booking.destination?.lat != null && booking.destination.lng != null) {
    markers.push({
      id: `${booking.id}-destination`,
      position: { lat: booking.destination.lat, lng: booking.destination.lng },
      label: "Destination",
      color: "#0f172a",
      zIndex: 1,
      variant: "destination"
    });
  }
  if (booking.clientLocation) {
    markers.push({
      id: `${booking.id}-client`,
      position: { lat: booking.clientLocation.lat!, lng: booking.clientLocation.lng! },
      label: "Client",
      color: "#2563eb",
      zIndex: 2,
      variant: "client"
    });
  }
  if (booking.providerLocation) {
    markers.push({
      id: `${booking.id}-provider`,
      position: { lat: booking.providerLocation.lat!, lng: booking.providerLocation.lng! },
      label: "Provider",
      color: "#f97316",
      zIndex: 3,
      variant: "provider",
      isFocused: true
    });
  }
  return markers;
};

const buildPolyline = (booking: MonitoringBooking): MapPolyline | null => {
  const provider = booking.providerLocation;
  const destination = booking.destination;
  if (!provider || !destination?.lat || !destination.lng) {
    return null;
  }
  return {
    id: `${booking.id}-route`,
    path: [
      { lat: provider.lat!, lng: provider.lng! },
      { lat: destination.lat, lng: destination.lng }
    ],
    color: "#f97316",
    weight: 4,
    variant: "direct"
  };
};

const MonitoringPage = () => {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["value"]>("active");
  const { data, isFetching, refetch } = useAdminMonitoringFeed({
    statuses: statusToFilter(statusFilter),
    limit: 100
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const socket = useSocket();
  const toast = useToast();
  const cancelMutation = useCancelBookingMutation("detail");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState(ADMIN_CANCELLATION_REASONS[0].value);
  const [cancelNote, setCancelNote] = useState("");

  useEffect(() => {
    if (data?.bookings?.length) {
      if (!selectedId) {
        setSelectedId(data.bookings[0].id);
      } else {
        const stillExists = data.bookings.some((booking) => booking.id === selectedId);
        if (!stillExists) {
          setSelectedId(data.bookings[0].id);
        }
      }
    } else {
      setSelectedId(null);
    }
  }, [data, selectedId]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    const handler = () => {
      void refetch();
    };
    socket.on("model.booking.escalation", handler);
    return () => {
      socket.off("model.booking.escalation", handler);
    };
  }, [socket, refetch]);

  const selectedBooking = useMemo(() => data?.bookings.find((booking) => booking.id === selectedId), [data, selectedId]);
  const markers = selectedBooking ? buildMarkers(selectedBooking) : [];
  const polyline = selectedBooking ? buildPolyline(selectedBooking) : null;

  const openReassignModal = () => {
    if (!selectedBooking) {
      return;
    }
    setReassignOpen(true);
  };

  const openCancelDialog = () => {
    if (!selectedBooking) {
      return;
    }
    setCancelReasonCode(ADMIN_CANCELLATION_REASONS[0].value);
    setCancelNote("");
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedBooking) {
      return;
    }
    try {
      const finalReason = formatCancellationReason(cancelReasonCode, cancelNote);
      await cancelMutation.mutateAsync({ bookingId: selectedBooking.id, reason: finalReason });
      toast.showToast({ title: "Booking cancelled", variant: "success" });
      setCancelDialogOpen(false);
      setCancelNote("");
    } catch (error) {
      toast.showToast({
        title: "Cancellation failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "error"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Live Booking Monitor</h1>
          <p className="text-sm text-slate-500">Track active assignments, escalations, and recent completions.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number]["value"])}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[330px,1fr]">
        <Card
          title="Bookings in focus"
          description="Select a booking to inspect provider/client telemetry and ETA."
          className="h-full max-h-[70vh] overflow-hidden"
        >
          {isFetching && !data?.bookings?.length ? (
            <div className="py-10 text-center text-sm text-slate-500">
              <Loading label="Loading map data…" />
            </div>
          ) : data?.bookings?.length ? (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-2">
              {data.bookings.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  className={classNames(
                    "w-full rounded-2xl border px-3 py-3 text-left transition",
                    booking.id === selectedId
                      ? "border-primary-500 bg-primary-50 shadow"
                      : "border-slate-200 bg-white hover:border-primary-200 hover:bg-primary-50/50"
                  )}
                  onClick={() => setSelectedId(booking.id)}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-900">{booking.service?.name ?? "Service"}</span>
                    <span
                      className={classNames(
                        "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                        statusClassMap[booking.status] ?? "bg-slate-100 text-slate-600"
                      )}
                    >
                      {formatLabel(booking.status)}
                    </span>
                    {booking.priorityScore != null && (
                      <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                        AI: {booking.priorityScore.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Client: {booking.client?.name ?? "—"} · Provider: {booking.provider?.name ?? "unassigned"}
                  </p>
                  {booking.distanceToDestinationM != null && (
                    <p className="mt-1 text-xs text-slate-500">
                      Distance to destination: {(booking.distanceToDestinationM / 1000).toFixed(2)} km
                    </p>
                  )}
                  {booking.meta?.escalation_at && (
                    <p className="mt-1 text-xs font-semibold text-rose-600">Escalation pending</p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">
              No bookings match this filter. Choose another status or refresh later.
            </div>
          )}
        </Card>

        <Card
          title="Live map"
          description={
            selectedBooking
              ? `Monitoring ${selectedBooking.service?.name ?? "service"} for ${selectedBooking.client?.name ?? "client"}.`
              : "Select a booking to render its live telemetry."
          }
          badge={selectedBooking ? formatLabel(selectedBooking.status) : undefined}
        >
          {selectedBooking ? (
            <>
              <MapView
                center={
                  selectedBooking.providerLocation?.lat && selectedBooking.providerLocation?.lng
                    ? {
                      lat: selectedBooking.providerLocation.lat,
                      lng: selectedBooking.providerLocation.lng
                    }
                    : selectedBooking.clientLocation?.lat && selectedBooking.clientLocation?.lng
                      ? { lat: selectedBooking.clientLocation.lat, lng: selectedBooking.clientLocation.lng }
                      : selectedBooking.destination?.lat && selectedBooking.destination?.lng
                        ? {
                          lat: selectedBooking.destination.lat,
                          lng: selectedBooking.destination.lng
                        }
                        : data?.map.center ?? undefined
                }
                zoom={data?.map.zoom ?? 12}
                markers={markers}
                polylines={polyline ? [polyline] : []}
                height={420}
                intent="admin"
              />
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <InfoTile
                  label="Client"
                  value={selectedBooking.client?.name ?? "—"}
                  helper={selectedBooking.destination?.address_text ?? undefined}
                />
                <InfoTile label="Provider" value={selectedBooking.provider?.name ?? "Unassigned"} />
                <InfoTile
                  label="ETA stats"
                  value={
                    selectedBooking.estimateDurationMinutes
                      ? `${selectedBooking.estimateDurationMinutes} min estimate`
                      : "—"
                  }
                  helper={
                    selectedBooking.distanceToDestinationM != null
                      ? `${(selectedBooking.distanceToDestinationM / 1000).toFixed(2)} km away`
                      : undefined
                  }
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={openReassignModal}>
                  Reassign provider
                </Button>
                <Button
                  variant="secondary"
                  className="border-rose-200 text-rose-600 hover:bg-rose-50"
                  onClick={openCancelDialog}
                >
                  Cancel booking
                </Button>
                <Link
                  to={`/admin/bookings/${selectedBooking.id}`}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Open detail
                </Link>
              </div>
            </>
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-slate-500">
              Select a booking to visualize its live telemetry.
            </div>
          )}
        </Card>
      </div>

      <ReassignBookingModal
        bookingId={reassignOpen ? selectedBooking?.id ?? null : null}
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        onSuccess={() => refetch()}
      />
      <ConfirmDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelConfirm}
        loading={cancelMutation.isPending}
        title="Cancel booking"
        description="Provide a short reason so the client and assigned provider know why this booking was cancelled."
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

const InfoTile = ({ label, value, helper }: { label: string; value: string; helper?: string }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    {helper && <p className="text-xs text-slate-500">{helper}</p>}
  </div>
);

export default MonitoringPage;
