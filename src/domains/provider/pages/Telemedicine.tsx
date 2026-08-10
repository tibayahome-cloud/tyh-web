import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Video, Calendar as CalendarIcon } from "lucide-react";

import { AppLayout } from "../../../shared/components/AppLayout";
import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { TelemedicineCallPanel } from "../../../shared/components/TelemedicineCallPanel";
import { useToast } from "../../../shared/components/ToastProvider";
import { useAuth } from "../../../shared/hooks/useAuth";
import { bookingKeys, useBookingList } from "../../../shared/hooks/useBookings";
import { useReportNoShowMutation } from "../../../shared/hooks/useTelemedicine";
import { getBookingStatusTheme, getSessionStatusTheme } from "../../../shared/utils/bookingStatus";
import { isWithinJoinWindow } from "../../../shared/utils/telemedicine";
import type { Booking } from "../../../shared/schemas/booking";

const NOT_REPORTABLE_STATUSES = ["cancelled_by_client", "cancelled_by_admin", "fully_completed"];

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const ConsultationRow = ({
  booking,
  onJoin,
  onReport
}: {
  booking: Booking;
  onJoin: () => void;
  onReport: () => void;
}) => {
  const statusTheme = getBookingStatusTheme(booking.status);
  const sessionTheme = booking.telemedicineSession ? getSessionStatusTheme(booking.telemedicineSession.status) : null;
  const canJoin = booking.status === "scheduled" && isWithinJoinWindow(booking.scheduledAt, booking.estimateDurationMinutes);
  const existingNoShowDispute = booking.disputes.find((dispute) => dispute.disputeType === "telemedicine_no_show");
  const canReport = !existingNoShowDispute && !NOT_REPORTABLE_STATUSES.includes(booking.status);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{booking.service?.name ?? "Consultation"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <CalendarIcon size={12} />
            {formatDateTime(booking.scheduledAt)}
          </span>
          <span>{booking.client?.fullName ?? "Client"}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTheme.className}`}>{statusTheme.label}</span>
          {sessionTheme && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sessionTheme.className}`}>{sessionTheme.label}</span>
          )}
          {existingNoShowDispute && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Reported, pending review</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canReport && (
          <Button type="button" size="sm" variant="ghost" onClick={onReport}>
            Report a problem
          </Button>
        )}
        {canJoin && (
          <Button type="button" size="sm" onClick={onJoin}>
            <Video size={14} />
            Join call
          </Button>
        )}
      </div>
    </div>
  );
};

const ProviderTelemedicinePage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeCallBookingId, setActiveCallBookingId] = useState<string | null>(null);
  const [reportBookingId, setReportBookingId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const reportNoShowMutation = useReportNoShowMutation();

  const { data, isLoading } = useBookingList(
    { providerId: user?.id ?? undefined, pageSize: 50, preset: "card" },
    { enabled: Boolean(user?.id) }
  );

  const consultations = useMemo(() => (data?.bookings ?? []).filter((booking) => booking.isTelemedicine), [data]);

  const handleReportNoShow = async () => {
    if (!reportBookingId) return;
    setReportError(null);
    try {
      await reportNoShowMutation.mutateAsync(reportBookingId);
      setReportBookingId(null);
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
      toast.showToast({ title: "Reported", description: "Admin.ops will review this appointment.", variant: "info" });
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="flex flex-col gap-4 px-4 pb-20 pt-4 sm:px-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Telemedicine</h1>
          <p className="text-sm text-slate-500">Your upcoming and past remote consultations.</p>
        </div>

        {isLoading && <Loading />}
        {!isLoading && consultations.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-12 text-center">
            <Video size={24} className="mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-900">No consultations assigned yet</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Assigned remote consultations will show up here once admin.ops assigns them to you.
            </p>
          </div>
        )}
        <div className="grid gap-3">
          {consultations.map((booking) => (
            <ConsultationRow
              key={booking.id}
              booking={booking}
              onJoin={() => setActiveCallBookingId(booking.id)}
              onReport={() => {
                setReportError(null);
                setReportBookingId(booking.id);
              }}
            />
          ))}
        </div>
      </div>

      {activeCallBookingId && (
        <TelemedicineCallPanel
          bookingId={activeCallBookingId}
          onLeave={() => setActiveCallBookingId(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(reportBookingId)}
        onClose={() => {
          if (!reportNoShowMutation.isPending) {
            setReportBookingId(null);
            setReportError(null);
          }
        }}
        onConfirm={handleReportNoShow}
        loading={reportNoShowMutation.isPending}
        title="Report a problem"
        description="Let admin.ops know if the client didn't join, or there was a technical issue. This flags the appointment for review."
        confirmLabel="Report"
        confirmVariant="secondary"
        error={reportError ?? undefined}
      />
    </AppLayout>
  );
};

export default ProviderTelemedicinePage;
