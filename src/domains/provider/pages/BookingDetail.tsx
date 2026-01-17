import { useCallback, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, Clock, MapPin, MessageCircle, Phone, Navigation, X, StarIcon, List } from "lucide-react";
import type { NavigationStep } from "../../../shared/components/BookingLiveMapCard";
import classNames from "classnames";

import { AppLayout } from "../../../shared/components/AppLayout";
import { BookingLiveMapCard } from "../../../shared/components/BookingLiveMapCard";
import { useBookingDetail, useMarkBookingMutation } from "../../../shared/hooks/useBookings";
import { Loading } from "../../../shared/components/Loading";
import { Card } from "../../../shared/components/Card";
import { Button } from "../../../shared/components/Button";
import { useToast } from "../../../shared/components/ToastProvider";
import { BookingNotesPanel } from "../components/BookingNotesPanel";
import type { Booking } from "../../../shared/schemas/booking";

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

const formatCurrency = (amountCents?: number | null, currency = "KES") => {
  if (amountCents == null) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
};

const ProviderBookingDetailPage = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const detailQuery = useBookingDetail(bookingId ?? null, "detail");
  const booking = detailQuery.data;

  const [navSteps, setNavSteps] = useState<NavigationStep[]>([]);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [isStepsPaneOpen, setIsStepsPaneOpen] = useState(false);

  const openChat = useCallback(() => {
    if (!booking?.id || typeof window === "undefined") {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("chat:open", {
        detail: { bookingId: booking.id, role: "provider" }
      })
    );
  }, [booking?.id]);

  const currentStep = navSteps[0];
  const nextStep = navSteps[1];

  if (detailQuery.isLoading || !bookingId) {
    return (
      <AppLayout fullWidth showHeader={false}>
        <Loading fullHeight />
      </AppLayout>
    );
  }

  if (!booking) {
    return (
      <AppLayout fullWidth showHeader={false}>
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Booking not found.{" "}
          <Link className="text-primary-600" to="/pro/home">
            Return home
          </Link>
          .
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout fullWidth showHeader={false}>
      <div className="relative min-h-[calc(100vh-4rem)] space-y-8 pb-32">
        {/* Immersive Map Section */}
        <div className="overflow-hidden rounded-[40px] border border-white/80 bg-white shadow-2xl ring-1 ring-black/5">
          <BookingLiveMapCard
            bookingId={booking.id}
            role="provider"
            onOpenChat={openChat}
            variant="immersive"
            mapOnly
            height={600}
            className="rounded-none border-none shadow-none"
            onNavigationSteps={setNavSteps}
            onProgressUpdate={(_, label) => setProgressLabel(label)}
          />
        </div>

        {/* Floating Navigation Terminal */}
        {navSteps.length > 0 && (
          <div className="fixed bottom-32 left-1/2 z-40 w-full max-w-xl -translate-x-1/2 px-4 drop-shadow-2xl md:bottom-12">
            <div className="overflow-hidden rounded-3xl border border-white/40 bg-slate-900/90 p-1 backdrop-blur-xl ring-1 ring-white/10">
              <div className="flex items-center justify-between p-4">
                <div className="flex flex-1 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500  shadow-lg shadow-brand-500/20">
                    <Navigation className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Current Manoeuver</p>
                    <p className="truncate text-sm font-bold text-white">{currentStep.instruction}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-brand-400">
                      {currentStep.distanceText} {currentStep.durationText ? `· ${currentStep.durationText}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsStepsPaneOpen(true)}
                  className="ml-4 flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/20"
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">Route</span>
                </button>
              </div>

              {nextStep && (
                <div className="mx-1 mb-1 rounded-[20px] bg-white/5 px-4 py-3 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 truncate max-w-[200px]">
                        Next: {nextStep.instruction}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                      {progressLabel}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details & Controls Grid */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr),minmax(320px,1fr)]">
          <ProviderControls booking={booking} onOpenChat={openChat} />

          <div className="space-y-6">
            <Card title="Booking briefing" className="border-white/80 bg-white/40 shadow-xl backdrop-blur-md ring-1 ring-black/5">
              <div className="space-y-4">
                <InfoRow
                  label="Service Vector"
                  value={booking.service?.name ?? "—"}
                  helper={booking.service?.category?.name ?? undefined}
                  icon={<div className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
                />
                <InfoRow
                  label="Target Location"
                  value={booking.addressText ?? "Shared when nearby"}
                  icon={<MapPin className="h-3.5 w-3.5 text-slate-400" />}
                />
                <InfoRow
                  label="Operational Yield"
                  value={formatCurrency(booking.priceCents, booking.currency ?? "KES")}
                  helper={booking.estimateDurationMinutes ? `Est. ${booking.estimateDurationMinutes} min` : undefined}
                  icon={<div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                />
                <InfoRow label="Protocol Status" value={booking.status.replace(/_/g, " ")} />
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400 mb-2">Primary Unit</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 font-bold">
                      {booking.client?.fullName?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{booking.client?.fullName}</p>
                      <p className="text-[10px] font-medium text-slate-500">{booking.client?.phone}</p>
                    </div>
                  </div>
                </div>
              </div>

            </Card>

            {/* Service Notes Panel - shown during active service */}
            {["accepted", "en_route", "nearby", "arrived", "in_service", "completed_by_provider"].includes(booking.status) && (
              <BookingNotesPanel
                bookingId={booking.id}
                serviceId={booking.service?.id}
                isProvider={true}
              />
            )}
          </div>
        </div>

        {/* Navigation Side Pane (Drawer) */}
        {isStepsPaneOpen && (
          <>
            <div
              className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsStepsPaneOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-sm bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] ring-1 ring-black/5 slide-in-right">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 p-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Intelligence Feed</h3>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">Route Log</p>
                  </div>
                  <button
                    onClick={() => setIsStepsPaneOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {navSteps.map((step: NavigationStep, idx: number) => (
                    <div key={idx} className={classNames(
                      "relative pl-8 pb-6 border-l-2",
                      idx === 0 ? "border-brand-500" : "border-slate-100 last:border-transparent"
                    )}>
                      <div className={classNames(
                        "absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 bg-white",
                        idx === 0 ? "border-brand-500 ring-4 ring-brand-500/10" : "border-slate-300"
                      )} />
                      <div className={classNames(
                        "rounded-2xl p-4 transition-all",
                        idx === 0 ? "bg-brand-50 ring-1 ring-brand-500/20 shadow-sm" : "bg-white"
                      )}>
                        <p className={classNames(
                          "text-sm leading-relaxed",
                          idx === 0 ? "font-bold text-slate-900" : "text-slate-600 font-medium"
                        )}>
                          {step.instruction}
                        </p>
                        <div className="mt-2 flex gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {step.distanceText}
                          </span>
                          {step.durationText && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              · {step.durationText}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {navSteps.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Navigation className="h-12 w-12 text-slate-200 mb-4" />
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Routing Link Inactive</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

type ProviderControlsProps = {
  booking: Booking;
  onOpenChat: () => void;
};

const ProviderControls = ({ booking, onOpenChat }: ProviderControlsProps) => {
  const toast = useToast();
  const { mutateAsync, isPending } = useMarkBookingMutation("detail");
  const actionCopy = ACTION_COPY[booking.status] ?? ACTION_COPY.default;
  const canAdvance = Boolean(actionCopy.action);

  const handlePrimaryAction = async () => {
    if (!actionCopy.action) {
      return;
    }
    try {
      await mutateAsync({ bookingId: booking.id, action: actionCopy.action });
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

  const handleCallClient = () => {
    if (!booking.client?.phone) {
      return;
    }
    if (typeof window !== "undefined") {
      window.location.href = `tel:${booking.client.phone}`;
    }
  };

  const handleNavigate = () => {
    if (!booking.lat || !booking.lng || typeof window === "undefined") {
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.lat},${booking.lng}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="space-y-6">
      <Card className="border-none bg-slate-900 p-8 shadow-2xl transition-all">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white shadow-xl ring-1 ring-white/10">
              <Navigation className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Protocol Sync</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tactical Control</p>
            </div>
          </div>
          <div className="h-2 w-2 rounded-full bg-brand-500 animate-pulse shadow-[0_0_10px_#22c55e]" />
        </div>

        <div className="space-y-8">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2">Next Authorization</p>
            <div className="flex items-center justify-between gap-4">
              <p className="text-lg font-bold text-white">{actionCopy.label}</p>
              <Button
                onClick={handlePrimaryAction}
                disabled={!canAdvance || isPending}
                variant="primary"
                className="h-10 rounded-xl px-6 bg-white text-slate-900 hover:bg-slate-100"
              >
                {isPending ? "Validating..." : "Execute"}
              </Button>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-400">{actionCopy.helper}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onOpenChat}
              className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/5 p-6 border border-white/5 transition-all hover:bg-white/10 group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 shadow-xl group-hover:scale-110 transition-transform">
                <MessageCircle className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Intelligence Link</span>
            </button>

            <button
              onClick={handleCallClient}
              disabled={!booking.client?.phone}
              className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/5 p-6 border border-white/5 transition-all hover:bg-white/10 group disabled:opacity-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 shadow-xl group-hover:scale-110 transition-transform">
                <Phone className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Voice Comm</span>
            </button>

            <button
              onClick={handleNavigate}
              disabled={!booking.lat || !booking.lng}
              className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/5 p-6 border border-white/5 transition-all hover:bg-white/10 group disabled:opacity-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 shadow-xl group-hover:scale-110 transition-transform">
                <MapPin className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Waypoint Sync</span>
            </button>

            <a
              href="#provider-booking-timeline"
              className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/5 p-6 border border-white/5 transition-all hover:bg-white/10 group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-500/10 text-slate-400 shadow-xl group-hover:scale-110 transition-transform">
                <List className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Booking Log</span>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
};

const InfoRow = ({
  label,
  value,
  helper,
  icon
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode
}) => (
  <div className="flex gap-4">
    {icon && <div className="mt-1 shrink-0">{icon}</div>}
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-900 leading-tight mt-0.5">{value}</p>
      {helper && <p className="text-[10px] font-medium text-slate-500 mt-0.5">{helper}</p>}
    </div>
  </div>
);

export default ProviderBookingDetailPage;
