import ApiErrorBanner from "../../../shared/components/ApiErrorBanner";
import { classifyApiError } from "../../../shared/utils/errors";
import { NeedsYourResponse } from "../../../shared/components/NeedsYourResponse";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import {
  formatTelemedicineDateTime,
  isWithinJoinWindow,
  isWithinTechnicalIssueReportWindow
} from "../../../shared/utils/telemedicine";
import type { Booking } from "../../../shared/schemas/booking";
import { describeWait } from "../../../shared/utils/joinCountdown";
import { NextConsultationCard } from "../../../shared/components/NextConsultationCard";
import { useNow } from "../../../shared/hooks/useNow";
import {
  isEarlierConsultation,
  needsYouForConsultation,
  pickNowConsultation,
  sortEarlier,
  sortOpen,
  type ProviderNeedsItem
} from "../utils/consultationGroups";
import { noShowReportState } from "../../../shared/utils/noShowReport";

const ConsultationRow = ({
  booking,
  timezone,
  joinWindowBeforeMinutes,
  onJoin,
  onReportNoShow,
  onReportTechnicalIssue,
  onOpenDetails,
  interactive = true
}: {
  booking: Booking;
  timezone: string | undefined;
  joinWindowBeforeMinutes: number | undefined;
  onJoin: () => void;
  onReportNoShow: () => void;
  onReportTechnicalIssue: () => void;
  /** Opens the booking: who it is with, when, notes, rescheduling. Offered on every row, past or upcoming. */
  onOpenDetails: () => void;
  interactive?: boolean;
}) => {
  const statusTheme = getBookingStatusTheme(booking.status);
  const sessionTheme = booking.telemedicineSession ? getSessionStatusTheme(booking.telemedicineSession.status) : null;
  const withinWindow = interactive && isWithinJoinWindow(booking.scheduledAt, booking.estimateDurationMinutes, Date.now(), joinWindowBeforeMinutes);
  const canJoin = booking.status === "scheduled" && withinWindow;
  // "Client didn't join" is offered only once the call time has passed, the provider was in the call and the
  // client was not. Before that there is nothing to report (and the server would refuse).
  const noShow = interactive ? noShowReportState(booking, "provider", Date.now()) : ({ state: "unavailable" } as const);
  // Reporting stays open for 24h after the call ends -- a longer, separate window from joining.
  const canReportTechnicalIssue = interactive && isWithinTechnicalIssueReportWindow(
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
        <p className="truncate text-base font-semibold text-slate-900">
          <button type="button" onClick={onOpenDetails} className="max-w-full truncate text-left hover:text-tiba-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue">
            {booking.service?.name ?? "Consultation"}
          </button>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="flex items-center gap-1">
            <CalendarIcon size={12} />
            {formatTelemedicineDateTime(booking.scheduledAt, timezone)}
          </span>
          <span>{booking.client?.fullName ?? "Client"}</span>
          {booking.estimateDurationMinutes && <span>{booking.estimateDurationMinutes} min</span>}
        </div>
        {minutesUntilJoinable !== null && minutesUntilJoinable > 0 && (
          <p className="mt-1 text-sm text-slate-600">The call opens in {describeWait(minutesUntilJoinable)}</p>
        )}
        {noShow.state === "waiting" && (
          <p className="mt-1 text-sm text-slate-600">
            If your client has not joined by{" "}
            {formatTelemedicineDateTime(new Date(noShow.at).toISOString(), timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}, you can report it here.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTheme.className}`}>{statusTheme.label}</span>
          {sessionTheme && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sessionTheme.className}`}>{sessionTheme.label}</span>
          )}
          {noShow.state === "reported" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Reported, pending review</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onOpenDetails}>
          View details
        </Button>
        {canReportTechnicalIssue && (
          <Button type="button" size="sm" variant="ghost" onClick={onReportTechnicalIssue}>
            Technical issue
          </Button>
        )}
        {noShow.state === "available" && (
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
  // The Join button on Home sends the provider here with ?join=<booking> so the call opens without another tap. The
  // call screen asks the server for its own token, which refuses a call that is not open, so no window check here.
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCallBookingId, setActiveCallBookingId] = useState<string | null>(() => searchParams.get("join"));
  useEffect(() => {
    if (searchParams.get("join")) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [reportBookingId, setReportBookingId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [technicalIssueBookingId, setTechnicalIssueBookingId] = useState<string | null>(null);
  const reportNoShowMutation = useReportNoShowMutation();
  const policyQuery = useTelemedicinePolicy();

  const { data, isLoading, isError, error: listError, dataUpdatedAt, refetch, isFetching } = useBookingList(
    // Asked of the server rather than filtered here: a provider with many home-care bookings would
    // otherwise fill this page with them and push their consultations off it.
    { providerId: user?.id ?? undefined, isTelemedicine: true, pageSize: 100, preset: "card" },
    { enabled: Boolean(user?.id) }
  );

  const now = useNow(30_000);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [earlierShown, setEarlierShown] = useState(10);
  const all = useMemo(() => (data?.bookings ?? []).filter((booking) => booking.isTelemedicine), [data]);
  const open = useMemo(() => sortOpen(all.filter((booking) => !isEarlierConsultation(booking))), [all]);
  const earlier = useMemo(() => sortEarlier(all.filter(isEarlierConsultation)), [all]);
  const nowBooking = useMemo(() => pickNowConsultation(open, now), [open, now]);
  const needsYou = useMemo<ProviderNeedsItem[]>(
    () => open.map((booking) => needsYouForConsultation(booking, now)).filter((item): item is ProviderNeedsItem => item !== null),
    [open, now]
  );
  // What is featured or listed under "Needs you" is not repeated under "Coming up".
  const comingUp = useMemo(() => {
    const shown = new Set<string>([...needsYou.map((item) => item.booking.id), ...(nowBooking ? [nowBooking.id] : [])]);
    return open.filter((booking) => !shown.has(booking.id));
  }, [open, needsYou, nowBooking]);

  const handleReportNoShow = async () => {
    if (!reportBookingId) return;
    setReportError(null);
    try {
      await reportNoShowMutation.mutateAsync(reportBookingId);
      setReportBookingId(null);
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
      toast.showToast({ title: "Reported", description: "Our team will review this appointment.", variant: "info" });
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
            <p className="text-sm text-slate-600">The call to join first, then what is coming up.</p>
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
              <span className="text-xs text-slate-600">
                Updated {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {/* A failed request is not an empty list. Say so, instead of "No consultations assigned yet". */}
        {isError && !data && (
          <ApiErrorBanner {...classifyApiError(listError, "We could not load your consultations.")} onRetry={() => void refetch()} />
        )}

        {isLoading && <Loading />}
        {!isLoading && !isError && open.length === 0 && earlier.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-12 text-center">
            <Video size={24} className="mb-2 text-slate-400" aria-hidden="true" />
            <p className="text-base font-semibold text-slate-900">No consultations assigned yet</p>
            <p className="mt-1 max-w-xs text-sm text-slate-600">
              Consultations appear here once your facility assigns them to you. Clients can only book you during the hours you set.
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => navigate("/pro/availability")}>
              <Clock size={14} />
              Set your hours
            </Button>
          </div>
        )}

        {!isLoading && (data || !isError) && (
          <>
            {nowBooking && (
              <NextConsultationCard
                booking={nowBooking}
                withName={nowBooking.client?.fullName}
                onJoin={() => setActiveCallBookingId(nowBooking.id)}
                detailsTo={`/pro/bookings/${nowBooking.id}`}
                joinWindowBeforeMinutes={policyQuery.data?.joinWindowBeforeMinutes}
              />
            )}

            <NeedsYourResponse bookingPath={(id) => `/pro/bookings/${id}`} />

            {needsYou.length > 0 && (
              <section aria-label="Needs you" className="space-y-3">
                <h2 className="text-base font-semibold text-slate-900">Needs you</h2>
                <ul className="space-y-2">
                  {needsYou.map((item) => (
                    <li
                      key={`${item.kind}-${item.booking.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-amber-950">{item.message}</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (item.kind === "report") {
                            setReportError(null);
                            setReportBookingId(item.booking.id);
                          } else {
                            navigate(`/pro/bookings/${item.booking.id}`);
                          }
                        }}
                        className="min-h-[44px] shrink-0 rounded-lg bg-white px-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                      >
                        {item.action}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(open.length > 0 || earlier.length > 0) && (
              <section aria-label="Coming up" className="space-y-3">
                <h2 className="text-base font-semibold text-slate-900">
                  Coming up{comingUp.length > 0 && <span className="ml-1.5 font-normal text-slate-600">({comingUp.length})</span>}
                </h2>
                {comingUp.length === 0 ? (
                  <p className="text-sm text-slate-600">{nowBooking || needsYou.length > 0 ? "Nothing else is coming up." : "Nothing is coming up."}</p>
                ) : (
                  <div className="grid gap-3">
                    {comingUp.map((booking) => (
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
                        onOpenDetails={() => navigate(`/pro/bookings/${booking.id}`)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {earlier.length > 0 && (
              <section aria-label="Earlier" className="space-y-3">
                <h2 className="text-base font-semibold text-slate-900">
                  <button
                    type="button"
                    aria-expanded={earlierOpen}
                    aria-controls="earlier-consultations"
                    onClick={() => setEarlierOpen((value) => !value)}
                    className="-mx-2 flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-left hover:text-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                  >
                    Earlier
                    <span className="font-normal text-slate-600">({earlier.length})</span>
                    <span className="text-sm font-semibold text-tiba-blue">{earlierOpen ? "Hide" : "Show"}</span>
                  </button>
                </h2>
                {earlierOpen && (
                  <div id="earlier-consultations" className="grid gap-3">
                    {earlier.slice(0, earlierShown).map((booking) => (
                      <ConsultationRow
                        key={booking.id}
                        booking={booking}
                        timezone={policyQuery.data?.defaultTimezone}
                        joinWindowBeforeMinutes={policyQuery.data?.joinWindowBeforeMinutes}
                        interactive={false}
                        onJoin={() => undefined}
                        onReportNoShow={() => undefined}
                        onReportTechnicalIssue={() => undefined}
                        onOpenDetails={() => navigate(`/pro/bookings/${booking.id}`)}
                      />
                    ))}
                    {earlierShown < earlier.length && (
                      <button
                        type="button"
                        onClick={() => setEarlierShown((count) => count + 10)}
                        className="min-h-[44px] justify-self-start rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-tiba-blue hover:text-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                      >
                        Show more
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}
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
        description="Tell our team your client did not join this appointment. This flags it for review. It does not change any payment by itself."
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
