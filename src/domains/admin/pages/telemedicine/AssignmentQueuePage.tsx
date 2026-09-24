import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Flag, RefreshCw, Video } from "lucide-react";

import { Card } from "../../../../shared/components/Card";
import { Button } from "../../../../shared/components/Button";
import { Loading } from "../../../../shared/components/Loading";
import { ApiErrorBanner } from "../../../../shared/components/ApiErrorBanner";
import { StickyFilterBar } from "../../../../shared/components/StickyFilterBar";
import { TechnicalIssueReviewList } from "../../../../shared/components/TechnicalIssueReviewList";
import { useToast } from "../../../../shared/components/ToastProvider";
import {
  useAssignProviderMutation,
  useAssignmentQueue,
  useProposeRebookingMutation,
  useTechnicalIssues,
  useTelemedicinePolicy
} from "../../../../shared/hooks/useTelemedicine";
import { useBookingList } from "../../../../shared/hooks/useBookings";
import {
  facilityLocalToUtcIso,
  formatTelemedicineDateTime,
  splitTelemedicineBookings
} from "../../../../shared/utils/telemedicine";
import { getBookingStatusTheme, getSessionStatusTheme } from "../../../../shared/utils/bookingStatus";
import { PreferenceSummary } from "../../components/PreferenceSummary";
import { classifyApiError, type ClassifiedApiError } from "../../../../shared/utils/errors";
import type { Booking } from "../../../../shared/schemas/booking";
import type { TelemedicineAssignmentBooking } from "../../../../shared/schemas/telemedicine";

const AssignProviderAction = ({ booking }: { booking: TelemedicineAssignmentBooking }) => {
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

  if (booking.assignableProviders.length === 0) {
    return <span className="text-xs font-semibold text-danger-600">No eligible providers free</span>;
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
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
      {assignError && <ApiErrorBanner category={assignError.category} message={assignError.message} />}
    </div>
  );
};

const OfferNewTimeAction = ({ booking, timezone }: { booking: TelemedicineAssignmentBooking; timezone: string | undefined }) => {
  const toast = useToast();
  const [proposedStartAt, setProposedStartAt] = useState("");
  const [offerError, setOfferError] = useState<ClassifiedApiError | null>(null);
  const proposeMutation = useProposeRebookingMutation();

  const handleOffer = async () => {
    if (!proposedStartAt || !timezone) return;
    setOfferError(null);
    // datetime-local carries no zone. Resolving it against the browser's would be right only
    // for an operator who happens to be in the facility's timezone, and silently wrong -- with
    // no error to notice -- for one who is not. The zone comes from the telemedicine policy.
    const isoWithZone = facilityLocalToUtcIso(proposedStartAt, timezone);
    if (!isoWithZone) {
      setOfferError({ category: "bad_request", message: "That is not a valid date and time." });
      return;
    }
    try {
      await proposeMutation.mutateAsync({ bookingId: booking.id, proposedStartAt: isoWithZone });
      toast.showToast({ title: "New time offered to the client", variant: "success" });
    } catch (error) {
      setOfferError(classifyApiError(error, "Unable to offer that time."));
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={proposedStartAt}
          onChange={(event) => setProposedStartAt(event.target.value)}
          aria-label={`Choose a replacement time for ${booking.serviceName ?? "consultation"} with ${booking.clientFullName ?? "client"}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <Button
          size="sm"
          // Held back until the policy resolves rather than falling back to the browser's zone:
          // a guessed timezone books a real appointment at the wrong hour.
          disabled={!proposedStartAt || !timezone}
          loading={proposeMutation.isPending}
          onClick={handleOffer}
        >
          Offer new time
        </Button>
      </div>
      <p className="text-[11px] text-slate-500 sm:text-right">
        {timezone
          ? `Times are in the facility's timezone (${timezone}). The client is asked to accept, and is not charged again.`
          : "Loading the facility's timezone…"}
      </p>
      {offerError && <ApiErrorBanner category={offerError.category} message={offerError.message} />}
    </div>
  );
};

// The descriptive half of an assignment-queue row, shared by the desktop grid layout and the
// mobile stack so each booking (and its PreferenceSummary fetch) mounts exactly once -- CSS
// reflows this between a table-like two-column row and a stacked card, no duplicate DOM tree.
const AssignmentRowDetails = ({ booking, timezone }: { booking: TelemedicineAssignmentBooking; timezone: string | undefined }) => (
  <div className="min-w-0">
    <p className="font-semibold text-slate-900">{booking.serviceName ?? "Consultation"}</p>
    <p className="text-xs text-slate-400">{booking.id}</p>
    <p className="text-sm text-slate-700">{booking.clientFullName ?? booking.clientUserId}</p>
    <p className="text-xs text-slate-500">{formatTelemedicineDateTime(booking.scheduledAt, timezone)}</p>
    {booking.recoveryState !== "assignable" && (
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {booking.recoveryState === "awaiting_client"
          ? "A replacement time has been offered. Waiting for the client to accept."
          : "This appointment's slot was released before a provider was assigned. Offer the client another time, or refund the payment from the review queue."}
      </p>
    )}
    <PreferenceSummary bookingId={booking.id} />
    <Link
      to={`/admin/bookings/${booking.id}`}
      className="mt-2 inline-flex text-xs font-semibold text-primary-700 hover:underline"
    >
      View consultation details
    </Link>
  </div>
);

// One action per row, chosen by the backend rather than guessed here. A booking whose slot
// lapsed used to render an Assign button the API would always reject -- the operator saw a
// provider they could pick and an error every time they picked one.
const AssignmentRowAction = ({ booking, timezone }: { booking: TelemedicineAssignmentBooking; timezone: string | undefined }) => {
  if (booking.recoveryState === "assignable") return <AssignProviderAction booking={booking} />;
  if (booking.recoveryState === "needs_rebooking") return <OfferNewTimeAction booking={booking} timezone={timezone} />;
  if (booking.recoveryState === "awaiting_client") {
    return <span className="text-xs font-semibold text-slate-500">Awaiting client</span>;
  }
  return null;
};

const AssignmentQueueRow = ({ booking, timezone }: { booking: TelemedicineAssignmentBooking; timezone: string | undefined }) => (
  <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_280px] md:items-start md:gap-x-6">
    <AssignmentRowDetails booking={booking} timezone={timezone} />
    <div className="flex md:justify-end">
      <AssignmentRowAction booking={booking} timezone={timezone} />
    </div>
  </div>
);

const ConsultationRow = ({ booking, timezone }: { booking: Booking; timezone: string | undefined }) => {
  const bookingTheme = getBookingStatusTheme(booking.status);
  const sessionTheme = booking.telemedicineSession?.status
    ? getSessionStatusTheme(booking.telemedicineSession.status)
    : null;

  return (
    <Link
      to={`/admin/bookings/${booking.id}`}
      className="block rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-primary-300 hover:shadow-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{booking.service?.name ?? "Consultation"}</p>
          <p className="mt-0.5 text-sm text-slate-700">Client: {booking.client?.fullName || "Unknown client"}</p>
          <p className="text-sm text-slate-700">Provider: {booking.provider?.fullName || "Unassigned"}</p>
          <p className="mt-0.5 text-xs text-slate-500">
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

// A live video session, not just "not historical yet" -- refines splitTelemedicineBookings'
// upcoming set using the same telemedicineSession.status field ConsultationRow already reads
// (no new field, no new request). There is no backend "active" booking status of its own.
const isConsultationInSession = (booking: Booking): boolean => {
  const sessionStatus = booking.telemedicineSession?.status;
  return sessionStatus === "joined" || sessionStatus === "in_progress";
};

type WorkspaceTabKey = "queue" | "consultations" | "review";

const WORKSPACE_TABS: { key: WorkspaceTabKey; label: string; icon: typeof ClipboardList }[] = [
  { key: "queue", label: "Action queue", icon: ClipboardList },
  { key: "consultations", label: "Consultations", icon: Video },
  { key: "review", label: "Review flags", icon: Flag }
];

type ConsultationFilterKey = "upcoming" | "active" | "history";

const CONSULTATION_FILTERS: { key: ConsultationFilterKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "active", label: "Active" },
  { key: "history", label: "History" }
];

const SummaryStat = ({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "blue" | "amber" | "slate" | "rose";
}) => {
  const toneClass =
    tone === "blue"
      ? "border-blue-100 bg-blue-50 text-blue-900"
      : tone === "amber"
        ? "border-amber-100 bg-amber-50 text-amber-900"
        : tone === "rose"
          ? "border-rose-100 bg-rose-50 text-rose-900"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    // role="group" (not a bare div) with one combined phrase for assistive tech
    // ("5 Awaiting assignment") instead of a lone number; the visual label/number pair
    // underneath is hidden from the accessibility tree so it is not announced a second time.
    // Not a live region: these update on a background poll, not a user action, and announcing
    // every poll tick would be noise, not information.
    <div
      role="group"
      className={`rounded-xl border px-3 py-2 ${toneClass}`}
      aria-label={`${value} ${label}`}
    >
      <p aria-hidden="true" className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p aria-hidden="true" className="text-xl font-bold tabular-nums">
        {value}
      </p>
    </div>
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
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>("queue");
  const [consultationFilter, setConsultationFilter] = useState<ConsultationFilterKey>("upcoming");

  const bookings = queueQuery.data ?? [];
  const consultations = (consultationsQuery.data?.bookings ?? []).filter((booking) => booking.isTelemedicine);
  const { upcoming: notYetHistoricalConsultations, history: consultationHistory } = splitTelemedicineBookings(consultations);
  const activeConsultations = notYetHistoricalConsultations.filter(isConsultationInSession);
  const upcomingConsultations = notYetHistoricalConsultations.filter((booking) => !isConsultationInSession(booking));

  const openIssues = (issuesQuery.data ?? []).filter((issue) => issue.status !== "resolved");

  // Every count here comes from data the page already fetched for its own views -- no request
  // exists solely to power the summary strip or tab badges. The queue is small enough that
  // recomputing these filters each render is cheaper than the bookkeeping a memo would need.
  const summary = {
    awaitingAssignment: bookings.filter((booking) => booking.recoveryState === "assignable").length,
    needsRebooking: bookings.filter((booking) => booking.recoveryState === "needs_rebooking").length,
    awaitingClient: bookings.filter((booking) => booking.recoveryState === "awaiting_client").length,
    reviewFlags: openIssues.length
  };

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

  // Roving-tabindex tab list: arrow keys must both select the new tab and move DOM focus onto
  // it (not just update aria-selected/tabIndex and leave focus behind on the old button) --
  // every tab button is already mounted (only its styling/tabIndex is conditional), so its ref
  // exists before the key ever needs to move.
  const tabButtonRefs = useRef<Partial<Record<WorkspaceTabKey, HTMLButtonElement | null>>>({});

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = WORKSPACE_TABS.findIndex((tab) => tab.key === activeTab);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + direction + WORKSPACE_TABS.length) % WORKSPACE_TABS.length;
      const nextKey = WORKSPACE_TABS[nextIndex].key;
      setActiveTab(nextKey);
      tabButtonRefs.current[nextKey]?.focus();
    }
  };

  const visibleConsultations =
    consultationFilter === "upcoming" ? upcomingConsultations : consultationFilter === "active" ? activeConsultations : consultationHistory;

  const consultationEmptyLabel =
    consultationFilter === "upcoming"
      ? "No upcoming consultations."
      : consultationFilter === "active"
        ? "No consultations in an active session right now."
        : "No consultation history.";

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryStat label="Awaiting assignment" value={summary.awaitingAssignment} tone="blue" />
        <SummaryStat label="Needs rebooking" value={summary.needsRebooking} tone="amber" />
        <SummaryStat label="Awaiting client" value={summary.awaitingClient} tone="slate" />
        <SummaryStat label="Review flags" value={summary.reviewFlags} tone="rose" />
      </div>

      <StickyFilterBar>
        <div
          role="tablist"
          aria-label="Telemedicine workspace sections"
          className="flex w-full gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto"
        >
          {WORKSPACE_TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            // "Consultations" must count everything that tab can show (Upcoming + Active +
            // History), not just the default Upcoming filter -- otherwise the badge silently
            // undercounts the moment there's an active or historical consultation.
            const count = key === "queue" ? bookings.length : key === "consultations" ? consultations.length : summary.reviewFlags;
            return (
              <button
                key={key}
                ref={(element) => {
                  tabButtonRefs.current[key] = element;
                }}
                type="button"
                role="tab"
                id={`workspace-tab-${key}`}
                aria-selected={isActive}
                aria-controls={`workspace-panel-${key}`}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={handleTabKeyDown}
                onClick={() => setActiveTab(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition sm:flex-none ${
                  isActive ? "bg-white text-tiba-blue shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive ? "bg-tiba-blue/10 text-tiba-blue" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </StickyFilterBar>

      {activeTab === "queue" && (
        <div id="workspace-panel-queue" role="tabpanel" aria-labelledby="workspace-tab-queue">
          <Card padding="none">
            {queueQuery.isLoading ? (
              <div className="py-12 text-center">
                <Loading label="Loading assignment queue…" />
              </div>
            ) : queueQuery.isError ? (
              <div className="p-4 sm:p-6">
                <ApiErrorBanner
                  {...classifyApiError(queueQuery.error, "We couldn't load the assignment queue right now.")}
                  onRetry={() => queueQuery.refetch()}
                />
              </div>
            ) : bookings.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No consultations waiting for assignment.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* Column header only where there's room for the action column to read as a
                    column; the mobile stack below md doesn't need one repeated per row. */}
                <div className="hidden bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 md:grid md:grid-cols-[minmax(0,1fr)_280px] md:gap-x-6">
                  <span>Consultation</span>
                  <span className="text-right">Action</span>
                </div>
                {bookings.map((booking) => (
                  <AssignmentQueueRow key={booking.id} booking={booking} timezone={policyQuery.data?.defaultTimezone} />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "consultations" && (
        <div id="workspace-panel-consultations" role="tabpanel" aria-labelledby="workspace-tab-consultations" className="space-y-3">
          <div
            role="tablist"
            aria-label="Consultation filter"
            className="inline-flex gap-1 rounded-lg bg-slate-100 p-1"
          >
            {CONSULTATION_FILTERS.map(({ key, label }) => {
              const isActive = consultationFilter === key;
              const count = key === "upcoming" ? upcomingConsultations.length : key === "active" ? activeConsultations.length : consultationHistory.length;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setConsultationFilter(key)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    isActive ? "bg-white text-tiba-blue shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-tiba-blue/10 text-tiba-blue" : "bg-slate-200 text-slate-700"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {consultationsQuery.isLoading ? (
            <Card>
              <Loading label="Loading consultations…" />
            </Card>
          ) : consultationsQuery.isError ? (
            <Card>
              <ApiErrorBanner category="unknown" message="Unable to load telemedicine consultations." />
            </Card>
          ) : visibleConsultations.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">{consultationEmptyLabel}</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {visibleConsultations.map((booking) => (
                <ConsultationRow key={booking.id} booking={booking} timezone={policyQuery.data?.defaultTimezone} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "review" && (
        <div id="workspace-panel-review" role="tabpanel" aria-labelledby="workspace-tab-review">
          <Card padding="none" className="p-4 sm:p-6">
            <TechnicalIssueReviewList
              issues={issuesQuery.data ?? []}
              isLoading={issuesQuery.isLoading}
              isError={issuesQuery.isError}
              error={issuesQuery.error}
              onRetry={() => issuesQuery.refetch()}
            />
          </Card>
        </div>
      )}
    </div>
  );
};

export default AssignmentQueuePage;
