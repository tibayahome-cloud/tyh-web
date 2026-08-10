import { useMemo, useState } from "react";
import { Video, Calendar as CalendarIcon } from "lucide-react";

import { AppLayout } from "../../../shared/components/AppLayout";
import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { TelemedicineCallPanel } from "../../../shared/components/TelemedicineCallPanel";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useBookingList } from "../../../shared/hooks/useBookings";
import { getBookingStatusTheme, getSessionStatusTheme } from "../../../shared/utils/bookingStatus";
import { isWithinJoinWindow } from "../../../shared/utils/telemedicine";
import type { Booking } from "../../../shared/schemas/booking";

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const ConsultationRow = ({ booking, onJoin }: { booking: Booking; onJoin: () => void }) => {
  const statusTheme = getBookingStatusTheme(booking.status);
  const sessionTheme = booking.telemedicineSession ? getSessionStatusTheme(booking.telemedicineSession.status) : null;
  const canJoin = booking.status === "scheduled" && isWithinJoinWindow(booking.scheduledAt, booking.estimateDurationMinutes);

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
        </div>
      </div>
      {canJoin && (
        <Button type="button" size="sm" onClick={onJoin}>
          <Video size={14} />
          Join call
        </Button>
      )}
    </div>
  );
};

const ProviderTelemedicinePage = () => {
  const { user } = useAuth();
  const [activeCallBookingId, setActiveCallBookingId] = useState<string | null>(null);

  const { data, isLoading } = useBookingList(
    { providerId: user?.id ?? undefined, pageSize: 50, preset: "card" },
    { enabled: Boolean(user?.id) }
  );

  const consultations = useMemo(() => (data?.bookings ?? []).filter((booking) => booking.isTelemedicine), [data]);

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
    </AppLayout>
  );
};

export default ProviderTelemedicinePage;
