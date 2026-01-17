import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";

import { Card } from "../../../shared/components/Card";
import { Loading } from "../../../shared/components/Loading";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, serviceWithLocales } from "../../../shared/libs/fieldInclude";
import { BookingRequestDialog } from "../components/BookingRequestDialog";

type ServiceLocale = {
  id: string;
  locale: string;
  name: string;
  description?: string | null;
};

type ServiceDetail = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  base_price_cents: number;
  default_estimate_minutes: number;
  is_emergency_capable: boolean;
  active: boolean;
  category?: {
    id: string;
    name: string;
  };
  locales?: ServiceLocale[];
};

type Envelope<T> = {
  data: T;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "KES" }).format(value / 100);

const useServiceDetail = (serviceId: string | undefined) =>
  useQuery({
    queryKey: ["client", "service", serviceId],
    enabled: Boolean(serviceId),
    queryFn: async () => {
      if (!serviceId) {
        return null;
      }
      try {
        const response = await api.get<Envelope<ServiceDetail>>(`/services/${serviceId}`, {
          params: buildFieldParams(serviceWithLocales)
        });
        return response.data.data;
      } catch {
        return null;
      }
    }
  });

const ServiceDetailPage = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const { data: service, isLoading } = useServiceDetail(serviceId);
  const navigate = useNavigate();
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);

  if (isLoading) {
    return <Loading fullHeight />;
  }

  if (!service) {
    return (
      <Card title="Service not found">
        <p className="text-sm text-slate-600">
          We could not locate this service. It may have been renamed or removed.
        </p>
        <Link
          to="/app/services"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          Back to services
        </Link>
      </Card>
    );
  }

  const localeDescriptions = service.locales ?? [];
  const handleBookingCreated = (bookingId: string) => {
    setBookingDialogOpen(false);
    navigate(`/app/bookings/${bookingId}`);
  };

  return (
    <div className="space-y-6">
      <Card
        title={service.name}
        description={service.category ? `Category · ${service.category.name}` : undefined}
        badge={service.is_emergency_capable ? "Emergency capable" : undefined}
      >
        <div className="space-y-3 text-sm text-slate-600">
          {service.description && <p>{service.description}</p>}
          <p>
            <strong className="font-semibold text-slate-900">Price:</strong> {formatCurrency(service.base_price_cents)}
          </p>
          <p>
            <strong className="font-semibold text-slate-900">Typical duration:</strong> {service.default_estimate_minutes} minutes
          </p>
          {localeDescriptions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Localized descriptions</p>
              <ul className="mt-2 space-y-2">
                {localeDescriptions.map((locale) => (
                  <li key={locale.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">{locale.name}</p>
                    <p className="uppercase tracking-wide text-slate-400">{locale.locale}</p>
                    {locale.description && <p className="mt-1 text-slate-600">{locale.description}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Ready to proceed? Set your preferred time and location—our matching engine will handle the rest.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/app/services"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              Back to services
            </Link>
            <button
              type="button"
              onClick={() => setBookingDialogOpen(true)}
              className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              Book this service
            </button>
          </div>
        </div>
      </Card>
      <BookingRequestDialog
        open={bookingDialogOpen}
        serviceId={service.id}
        onClose={() => setBookingDialogOpen(false)}
        onCreated={handleBookingCreated}
      />
    </div>
  );
};

export default ServiceDetailPage;
