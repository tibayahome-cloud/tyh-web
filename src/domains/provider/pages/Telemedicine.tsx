import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Video, Calendar as CalendarIcon, Clock } from "lucide-react";

import { AppLayout } from "../../../shared/components/AppLayout";
import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { TechnicalIssueDialog } from "../../../shared/components/TechnicalIssueDialog";
import { TelemedicineCallPanel } from "../../../shared/components/TelemedicineCallPanel";
import { useToast } from "../../../shared/components/ToastProvider";
import { useAuth } from "../../../shared/hooks/useAuth";
import { bookingKeys, useBookingList } from "../../../shared/hooks/useBookings";
import { useReportNoShowMutation, useTelemedicinePolicy } from "../../../shared/hooks/useTelemedicine";
import { getBookingStatusTheme, getSessionStatusTheme } from "../../../shared/utils/bookingStatus";
import { formatTelemedicineDateTime, isWithinJoinWindow, isWithinTechnicalIssueReportWindow } from "../../../shared/utils/telemedicine";
import type { Booking } from "../../../shared/schemas/booking";
import { TELEMEDICINE_DISPUTE_TYPE_NO_SHOW } from "../../../shared/schemas/telemedicine";

const NOT_REPORTABLE_STATUSES = ["cancelled_by_client", "cancelled_by_admin", "fully_completed"];

const ConsultationRow = ({
  booking,
  timezone,
  joinWindowBeforeMinutes,
  onJoin,
  onReportNoShow,
  onReportTechnicalIssue
}: {
  booking: Booking;
  timezone: string | undefined;
  joinWindowBeforeMinutes: number | undefined;
  onJoin: () => void;
  onReportNoShow: () => void;
  onReportTechnicalIssue: () => void;
}) => {
  const statusTheme = getBookingStatusTheme(booking.status);
  const sessionTheme = booking.telemedicineSession ? getSessionStatusTheme(booking.telemedicineSession.status) : null;
  const withinWindow = isWithinJoinWindow(booking.scheduledAt, booking.estimateDurationMinutes, Date.now(), joinWindowBeforeMinutes);
  const canJoin = booking.status === "scheduled" && withinWindow;
  const existingNoShowDispute = booking.disputes.find((dispute) => dispute.disputeType === TELEMEDICINE_DISPUTE_TYPE_NO_SHOW);
  const canReportNoShow = !existingNoShowDispute && !NOT_REPORTABLE_STATUSES.includes(booking.status);
  // Reporting stays open for 24h after the call ends -- a longer, separate window from joining.
  const canReportTechnicalIssue = isWithinTechnicalIssueReportWindow(
    booking.scheduledAt,
    booking.estimateDurationMinutes,
    Date.now(),
    joinWindowBeforeMinutes
  );

  const minutesUntilJoinable =
    !canJoin && booking.status === "scheduled" && booking.scheduledAt && joinWindowBeforeMinutes !== undefined
      ? Math.ceil((new Date(booking.scheduledAt).getTime() - joinWindowBeforeMinutes * 60_000 - Date.now()) / 60_000)
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{booking.service?.name ?? "Consultation"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <CalendarIcon size={12} />
            {formatTelemedicineDateTime(booking.scheduledAt, timezone)}
          </span>
          <span>{booking.client?.fullName ?? "Client"}</span>
          {booking.estimateDurationMinutes && <span>{booking.estimateDurationMinutes} min</span>}
        </div>
        {minutesUntilJoinable !== null && minutesUntilJoinable > 0 && (
          <p className="mt-1 text-[11px] text-slate-400">Joinable in {minutesUntilJoinable} min</p>
        )}
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
        {canReportTechnicalIssue && (
          <Button type="button" size="sm" variant="ghost" onClick={onReportTechnicalIssue}>
            Technical issue
          </Button>
        )}
        {canReportNoShow && (
          <Button type="button" size="sm" variant="ghost" onClick={onReportNoShow}>
            Client didn't join
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCallBookingId, setActiveCallBookingId] = useState<string | null>(null);
  const [reportBookingId, setReportBookingId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [technicalIssueBookingId, setTechnicalIssueBookingId] = useState<string | null>(null);
  const reportNoShowMutation = useReportNoShowMutation();
  const policyQuery = useTelemedicinePolicy();

  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useBookingList(
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Telemedicine</h1>
            <p className="text-sm text-slate-500">Your upcoming and past remote consultations.</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {/* Clients can only book a remote consultation inside these hours, so keep the
                  schedule reachable from here rather than only from Settings. */}
              <Button type="button" size="sm" variant="outline" onClick={() => navigate("/pro/availability")}>
                <Clock size={14} />
                Set your hours
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw size={14} className={isFetching ? "animate-spin motion-reduce:animate-none" : undefined} />
                Refresh
              </Button>
            </div>
            {dataUpdatedAt > 0 && (
              <span className="text-[10px] text-slate-400">
                Updated {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {isLoading && <Loading />}
        {!isLoading && consultations.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-12 text-center">
            <Video size={24} className="mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-900">No consultations assigned yet</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Assigned remote consultations will show up here once admin.ops assigns them to you.
              Clients can only book you during the hours you set.
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => navigate("/pro/availability")}>
              <Clock size={14} />
              Set your hours
            </Button>
          </div>
        )}
        <div className="grid gap-3">
          {consultations.map((booking) => (
            <ConsultationRow
              key={booking.id}
              booking={booking}
              timezone={policyQuery.data?.defaultTimezone}
              joinWindowBeforeMinutes={policyQuery.data?.joinWindowBeforeMinutes}
              onJoin={() => setActiveCallBookingId(booking.id)}
              onReportNoShow={() => {
                setReportError(null);
                setReportBookingId(booking.id);
              }}
              onReportTechnicalIssue={() => setTechnicalIssueBookingId(booking.id)}
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
        description="Let admin.ops know if the client didn't join for this appointment. This flags the appointment for review."
        confirmLabel="Report"
        confirmVariant="secondary"
        error={reportError ?? undefined}
      />

      <TechnicalIssueDialog
        open={Boolean(technicalIssueBookingId)}
        bookingId={technicalIssueBookingId ?? ""}
        onClose={() => setTechnicalIssueBookingId(null)}
        onReported={() =>
          toast.showToast({ title: "Reported", description: "Admin.ops will review this technical issue.", variant: "info" })
        }
      />
    </AppLayout>
  );
};

export default ProviderTelemedicinePage;
