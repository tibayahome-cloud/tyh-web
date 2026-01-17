import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  MapPin,
  Calendar,
  ShieldCheck,
  MessageCircle,
  Phone,
  ArrowRight,
  Info as InfoIcon,
  Star as StarIcon
} from "lucide-react";
import classNames from "classnames";
import Drawer from "@mui/material/Drawer";

import { AppLayout } from "../../../shared/components/AppLayout";
import { BookingLiveMapCard } from "../../../shared/components/BookingLiveMapCard";
import { useBookingDetail, useCancelBookingMutation } from "../../../shared/hooks/useBookings";
import { Loading } from "../../../shared/components/Loading";
import { Button } from "../../../shared/components/Button";
import { formatBookingStatus, getBookingStatusTheme } from "../../../shared/utils/bookingStatus";
import { useToast } from "../../../shared/components/ToastProvider";

const TRACKING_STATUSES = ["accepted", "en_route", "nearby", "arrived", "in_service"];

const BookingDetailPage = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const detailQuery = useBookingDetail(bookingId ?? null, "detail");
  const cancelMutation = useCancelBookingMutation("detail");

  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const booking = detailQuery.data;

  // Auto-open sheet if map is not the primary focus (e.g. not tracking yet)
  const showMap = booking && TRACKING_STATUSES.includes(booking.status) && Boolean(booking.provider);

  useEffect(() => {
    if (booking && !showMap) {
      setSheetExpanded(true);
    }
  }, [booking, showMap]);

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
        <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 px-6 text-center">
          <div className="rounded-full bg-slate-50 p-4">
            <InfoIcon className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Booking not found</h2>
          <p className="max-w-xs text-sm text-slate-500">
            We couldn't find the booking you're looking for. It might have been deleted or moved.
          </p>
          <Link to="/app/home">
            <Button variant="secondary" className="mt-2">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const theme = getBookingStatusTheme(booking.status);
  const mapHeight = Math.round(viewportHeight * 0.66); // 2/3 of screen

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      await cancelMutation.mutateAsync({ bookingId: booking.id, reason: "Cancelled from detail page" });
      toast.showToast({ title: "Booking cancelled", variant: "info" });
      setSheetExpanded(true); // Ensure details are visible after cancel
    } catch (e: any) {
      toast.showToast({ title: "Error cancelling booking", description: e.message, variant: "error" });
    }
  };

  const BookingDetailsContent = () => (
    <div className="space-y-6 p-6 pb-12">
      {/* Header Info */}
      <div className="space-y-3 border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Reference</p>
            <p className="font-mono text-sm font-bold text-slate-700">#{booking.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <span className={classNames(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            theme.className
          )}>
            {formatBookingStatus(booking.status)}
          </span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{booking.service?.name ?? "Service Booking"}</h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : '—'}
            </span>
            {booking.scheduledAt && (
              <span className="flex items-center gap-1">
                • {new Date(booking.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Order Summary</h4>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Price</span>
            <span className="text-xs font-bold text-slate-900">
              {booking.currency} {(booking.priceCents / 100).toLocaleString()}
            </span>
          </div>
          <div className="border-t border-slate-200/50 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Total</span>
              <span className="text-sm font-bold text-brand-600">
                {booking.currency} {(booking.priceCents / 100).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Provider */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Provider</h4>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          {booking.provider ? (
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-slate-100 ring-2 ring-slate-50 flex-shrink-0">
                {booking.provider.avatarUrl ? (
                  <img src={booking.provider.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-50 text-lg font-bold text-brand-600">
                    {booking.provider.fullName?.[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-sm font-bold text-slate-900 truncate">{booking.provider.fullName}</h5>
                <div className="mt-2 flex gap-2">
                  <button className="flex-1 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors" onClick={() => navigate("/app/inbox")}>
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
                  </button>
                  {booking.provider.phone && (
                    <a href={`tel:${booking.provider.phone}`} className="flex-1 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                      <Phone className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Call</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-300">
                <ArrowRight className="h-4 w-4 animate-pulse" />
              </div>
              <p className="text-xs font-medium text-slate-400 italic">Matching provider...</p>
            </div>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Location</h4>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-500 flex-shrink-0">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 leading-snug">{booking.addressText || "No address provided"}</p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {booking.feedback && booking.feedback.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Reviews & Rating</h4>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
            {booking.feedback.map((f) => (
              <div key={f.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <StarIcon
                          key={s}
                          className={`h-3 w-3 ${s <= f.score ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-bold text-slate-900">{f.rater?.fullName}</span>
                  </div>
                  <span className="text-[9px] text-slate-400">
                    {f.ratedAt ? new Date(f.ratedAt).toLocaleDateString() : ""}
                  </span>
                </div>
                {f.comment && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    "{f.comment}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-4 space-y-3">
        {!booking.provider && !['cancelled_by_client', 'cancelled_by_admin', 'completed_by_provider', 'client_confirmed', 'fully_completed'].includes(booking.status) && (
          <Button
            variant="secondary"
            className="w-full h-12 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
            onClick={handleCancel}
            loading={cancelMutation.isPending}
          >
            Cancel Booking Request
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full h-12 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600"
          onClick={() => navigate('/app/bookings')}
        >
          Back to My Bookings
        </Button>
      </div>
    </div>
  );

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="relative w-full bg-slate-50" style={{ minHeight: '100vh' }}>

        {/* Map Section */}
        {showMap ? (
          <div
            className="relative w-full overflow-hidden shadow-xl z-0"
            style={{ height: mapHeight }}
          >
            <BookingLiveMapCard
              bookingId={booking.id}
              role="client"
              variant="immersive"
              mapOnly
              hideOverlays
              height={mapHeight}
              className="h-full w-full"
              onOpenChat={() => navigate("/app/inbox")}
            />

            {/* Overlay Gradient for smooth blending if needed, or keeping it clean */}

            {/* Top Left Back Button */}
            <div className="absolute top-4 left-4 z-10">
              <button
                onClick={() => navigate(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg ring-1 ring-black/5 hover:bg-slate-50 active:scale-95 transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>

            {/* Top Right Info Button */}
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setSheetExpanded(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg ring-1 ring-black/5 hover:bg-slate-50 active:scale-95 transition-all"
              >
                <InfoIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : (
          // Placeholder if no map available (e.g. cancelled/history view) - Should ideally not happen often with logic above, 
          // but ensures layout consistency. 
          // If no map, we just show the content in the main view or still in drawer? 
          // Let's just render the content directly if no map.
          <div className="pt-20 px-4 max-w-2xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => navigate(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold">Booking Details</h1>
              <div className="w-10" />
            </div>
            <div className="bg-white rounded-[32px] shadow-sm ring-1 ring-slate-100 overflow-hidden">
              <BookingDetailsContent />
            </div>
          </div>
        )}

        {/* Side Drawer */}
        <Drawer
          anchor="right"
          open={sheetExpanded}
          onClose={() => setSheetExpanded(false)}
          PaperProps={{
            sx: { width: "100%", maxWidth: "400px", background: "#f8fafc" }
          }}
        >
          {/* Drawer Header with Close */}
          <div className="sticky top-0 z-20 flex items-center justify-between bg-[#f8fafc]/95 backdrop-blur-sm px-4 py-4 border-b border-slate-100/50">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">Details</h3>
            <button
              onClick={() => setSheetExpanded(false)}
              className="p-2 -mr-2 text-slate-400 hover:text-slate-600"
            >
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <BookingDetailsContent />
        </Drawer>
      </div>
    </AppLayout>
  );
};

export default BookingDetailPage;
