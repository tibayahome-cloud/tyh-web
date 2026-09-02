import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import { Card } from "../../../../shared/components/Card";
import { Button } from "../../../../shared/components/Button";
import { Loading } from "../../../../shared/components/Loading";
import { ApiErrorBanner } from "../../../../shared/components/ApiErrorBanner";
import { TechnicalIssueReviewList } from "../../../../shared/components/TechnicalIssueReviewList";
import { useToast } from "../../../../shared/components/ToastProvider";
import { useAssignProviderMutation, useAssignmentQueue, useTechnicalIssues, useTelemedicinePolicy } from "../../../../shared/hooks/useTelemedicine";
import { useBookingList } from "../../../../shared/hooks/useBookings";
import { formatTelemedicineDateTime, splitTelemedicineBookings } from "../../../../shared/utils/telemedicine";
import { getBookingStatusTheme, getSessionStatusTheme } from "../../../../shared/utils/bookingStatus";
import { PreferenceSummary } from "../../components/PreferenceSummary";
import { classifyApiError, type ClassifiedApiError } from "../../../../shared/utils/errors";
import type { TelemedicineAssignmentBooking } from "../../../../shared/schemas/telemedicine";

const AssignmentCard = ({ booking, timezone }: { booking: TelemedicineAssignmentBooking; timezone: string | undefined }) => {
  const toast = useToast();
  const [providerUserId, setProviderUserId] = useState("");
  const [assignError, setAssignError] = useState<ClassifiedApiError | null>(null);
  const assignMutation = useAssignProviderMutation();

  const handleAssign = async () => {
    if (!providerUserId) return;
    setAssignError(null);
    try {
      await assignMutation.mutateAsync({ bookingId: booking.id, providerUserId });
      toast.showToast({ title: "Provider assigned", variant: "success" });
    } catch (error) {
      // A race against another admin.ops session, or a provider going unavailable between page
      // load and click, surfaces here as a real backend rejection -- show it, don't guess.
      setAssignError(classifyApiError(error, "Unable to assign this provider."));
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{booking.serviceName ?? "Consultation"}</p>
          <p className="text-xs text-slate-500">{booking.id}</p>
          <p className="mt-1 text-sm text-slate-700">{booking.clientFullName ?? booking.clientUserId}</p>
          <p className="text-xs text-slate-500">{formatTelemedicineDateTime(booking.scheduledAt, timezone)}</p>
          <PreferenceSummary bookingId={booking.id} />
          <Link
            to={`/admin/bookings/${booking.id}`}
            className="mt-2 inline-flex text-xs font-semibold text-primary-700 hover:underline"
          >
            View consultation details
          </Link>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {booking.assignableProviders.length === 0 ? (
            <span className="text-xs font-semibold text-danger-600">No eligible providers free</span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={providerUserId}
                onChange={(event) => setProviderUserId(event.target.value)}
                aria-label={`Select provider for ${booking.serviceName ?? "consultation"} with ${booking.clientFullName ?? "client"}`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                <option value="">Select provider</option>
                {booking.assignableProviders.map((provider) => (
                  <option key={provider.providerUserId} value={provider.providerUserId}>
                    {provider.fullName ?? provider.providerUserId}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={!providerUserId} loading={assignMutation.isPending} onClick={handleAssign}>
                Assign
              </Button>
            </div>
          )}
        </div>
      </div>
      {assignError && (
        <div className="mt-3">
          <ApiErrorBanner category={assignError.category} message={assignError.message} />
        </div>
      )}
    </div>
  );
};

const ConsultationRow = ({ booking, timezone }: { booking: import("../../../../shared/schemas/booking").Booking; timezone: string | undefined }) => {
  const bookingTheme = getBookingStatusTheme(booking.status);
  const sessionTheme = booking.telemedicineSession?.status
    ? getSessionStatusTheme(booking.telemedicineSession.status)
    : null;

  return (
    <Link
      to={`/admin/bookings/${booking.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary-300 hover:shadow-md"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{booking.service?.name ?? "Consultation"}</p>
          <p className="mt-1 text-sm text-slate-700">Client: {booking.client?.fullName || "Unknown client"}</p>
          <p className="text-sm text-slate-700">Provider: {booking.provider?.fullName || "Unassigned"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatTelemedicineDateTime(booking.scheduledAt, timezone)}
            {booking.estimateDurationMinutes ? ` · ${booking.estimateDurationMinutes} min` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${bookingTheme.className}`}>
            {bookingTheme.label}
          </span>
          {sessionTheme && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sessionTheme.className}`}>
              {sessionTheme.label}
            </span>
          )}
          {booking.paymentReviewPending && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Payment review
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

const AssignmentQueuePage = () => {
  const toast = useToast();
  const queueQuery = useAssignmentQueue({ refetchInterval: 30_000 });
  const policyQuery = useTelemedicinePolicy();
  const issuesQuery = useTechnicalIssues({ refetchInterval: 60_000 });
  const consultationsQuery = useBookingList(
    { isTelemedicine: true, pageSize: 50, preset: "card" },
    { refetchInterval: 60_000 }
  );
  const bookings = queueQuery.data ?? [];
  const consultations = (consultationsQuery.data?.bookings ?? []).filter((booking) => booking.isTelemedicine);
  const { upcoming: upcomingConsultations, history: consultationHistory } = splitTelemedicineBookings(consultations);

  // Client-side alert for a fast-moving queue: no backend notification producer exists yet
  // (see Backend V1.2 Phase 6), so this catches "a new paid booking is waiting" as soon as the
  // 30s poll reveals a booking ID we haven't already shown, rather than depending on someone
  // noticing a new row on their own.
  const seenBookingIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!queueQuery.data) return;
    const currentIds = new Set(queueQuery.data.map((booking) => booking.id));
    if (seenBookingIds.current) {
      const newIds = [...currentIds].filter((id) => !seenBookingIds.current!.has(id));
      if (newIds.length > 0) {
        toast.showToast({
          title: newIds.length === 1 ? "New consultation awaiting assignment" : `${newIds.length} new consultations awaiting assignment`,
          variant: "info"
        });
      }
    }
    seenBookingIds.current = currentIds;
    // toast identity is stable from ToastProvider; including it would refire this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Telemedicine assignment</h1>
          <p className="text-sm text-slate-500">Paid remote-consultation appointments awaiting an eligible provider.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => queueQuery.refetch()} disabled={queueQuery.isFetching}>
            <RefreshCw size={14} className={queueQuery.isFetching ? "animate-spin motion-reduce:animate-none" : undefined} />
            Refresh
          </Button>
          {queueQuery.dataUpdatedAt > 0 && (
            <span className="text-[10px] text-slate-400">
              Updated {new Date(queueQuery.dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      <Card padding="none" className="p-4 sm:p-6">
        {queueQuery.isLoading ? (
          <div className="py-12 text-center">
            <Loading label="Loading assignment queue…" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No consultations waiting for assignment.</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <AssignmentCard key={booking.id} booking={booking} timezone={policyQuery.data?.defaultTimezone} />
            ))}
          </div>
        )}
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Consultations</h2>
          <p className="text-sm text-slate-500">Review scheduled, active, completed, and closed remote appointments.</p>
        </div>
        {consultationsQuery.isLoading ? (
          <Card><Loading label="Loading consultations…" /></Card>
        ) : consultationsQuery.isError ? (
          <Card><ApiErrorBanner category="unknown" message="Unable to load telemedicine consultations." /></Card>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming and active</h3>
              {upcomingConsultations.length === 0 ? (
                <Card><p className="text-sm text-slate-500">No upcoming or active consultations.</p></Card>
              ) : (
                <div className="space-y-3">
                  {upcomingConsultations.map((booking) => (
                    <ConsultationRow key={booking.id} booking={booking} timezone={policyQuery.data?.defaultTimezone} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">History</h3>
              {consultationHistory.length === 0 ? (
                <Card><p className="text-sm text-slate-500">No consultation history.</p></Card>
              ) : (
                <div className="space-y-3">
                  {consultationHistory.map((booking) => (
                    <ConsultationRow key={booking.id} booking={booking} timezone={policyQuery.data?.defaultTimezone} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Review flags</h2>
        <p className="text-sm text-slate-500">No-show and technical-issue reports for this facility.</p>
      </div>
      <Card padding="none" className="p-4 sm:p-6">
        <TechnicalIssueReviewList issues={issuesQuery.data ?? []} isLoading={issuesQuery.isLoading} />
      </Card>
    </div>
  );
};

export default AssignmentQueuePage;
