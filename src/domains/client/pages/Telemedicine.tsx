import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, ChevronRight, Calendar as CalendarIcon, Clock as ClockIcon } from "lucide-react";

import { AppLayout } from "../../../shared/components/AppLayout";
import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { CountryRequiredBanner } from "../../../shared/components/CountryRequiredBanner";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useBookingList } from "../../../shared/hooks/useBookings";
import { useTelemedicinePolicy } from "../../../shared/hooks/useTelemedicine";
import { getBookingStatusTheme, getSessionStatusTheme } from "../../../shared/utils/bookingStatus";
import { formatTelemedicineDateTime } from "../../../shared/utils/telemedicine";
import type { Booking } from "../../../shared/schemas/booking";
import { TelemedicineRequestDialog } from "../components/TelemedicineRequestDialog";

const ConsultationCard = ({
  booking,
  timezone,
  onClick
}: {
  booking: Booking;
  timezone: string | undefined;
  onClick: () => void;
}) => {
  const statusTheme = getBookingStatusTheme(booking.status);
  const sessionTheme = booking.telemedicineSession ? getSessionStatusTheme(booking.telemedicineSession.status) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-tiba-blue hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{booking.service?.name ?? "Consultation"}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <CalendarIcon size={12} />
            {formatTelemedicineDateTime(booking.scheduledAt, timezone)}
          </span>
          {booking.provider && (
            <span className="flex items-center gap-1">
              <ClockIcon size={12} />
              {booking.provider.fullName}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTheme.className}`}>{statusTheme.label}</span>
          {sessionTheme && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sessionTheme.className}`}>{sessionTheme.label}</span>
          )}
        </div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-slate-300" />
    </button>
  );
};

const ClientTelemedicinePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const policyQuery = useTelemedicinePolicy();

  const { data, isLoading } = useBookingList(
    { clientId: user?.id ?? undefined, pageSize: 50, preset: "card" },
    { enabled: Boolean(user?.id) }
  );

  const consultations = useMemo(() => (data?.bookings ?? []).filter((booking) => booking.isTelemedicine), [data]);

  const handleCreated = (bookingId: string) => {
    setDialogOpen(false);
    navigate(`/app/bookings/${bookingId}`);
  };

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="flex flex-col gap-4 px-4 pb-20 pt-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Telemedicine</h1>
            <p className="text-sm text-slate-500">See a provider by video call, no need to visit in person.</p>
          </div>
          <Button type="button" onClick={() => setDialogOpen(true)}>
            <Video size={16} />
            Book a consultation
          </Button>
        </div>

        {!user?.countryCode && <CountryRequiredBanner onComplete={() => navigate("/app/profile")} />}

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-700">Upcoming consultations</h2>
          {isLoading && <Loading />}
          {!isLoading && consultations.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-12 text-center">
              <Video size={24} className="mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-900">No consultations yet</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">
                Book a remote consultation and it will show up here.
              </p>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {consultations.map((booking) => (
              <ConsultationCard
                key={booking.id}
                booking={booking}
                timezone={policyQuery.data?.defaultTimezone}
                onClick={() => navigate(`/app/bookings/${booking.id}`)}
              />
            ))}
          </div>
        </div>
      </div>

      <TelemedicineRequestDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={handleCreated} />
    </AppLayout>
  );
};

export default ClientTelemedicinePage;
