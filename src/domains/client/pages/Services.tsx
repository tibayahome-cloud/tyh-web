import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import classNames from "classnames";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, ShieldCheck, Timer, Zap } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { Loading } from "../../../shared/components/Loading";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, serviceCategoryAdmin, svcCard } from "../../../shared/libs/fieldInclude";
import { BookingRequestDialog } from "../components/BookingRequestDialog";

type ServiceCategory = {
  id: string;
  name: string;
};

type Service = {
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
};

type Envelope<T> = {
  data: T;
};

const useCategories = () =>
  useQuery({
    queryKey: ["client", "service-categories"],
    queryFn: async () => {
      const response = await api.get<Envelope<ServiceCategory[]>>("/service-categories", {
        params: buildFieldParams(serviceCategoryAdmin)
      });
      return response.data.data;
    }
  });

const useServices = (filters: { category?: string; emergency?: boolean }) =>
  useQuery({
    queryKey: ["client", "services", filters],
    queryFn: async () => {
      const params: Record<string, string> = {
        ...buildFieldParams(svcCard)
      };
      if (filters.category && filters.category !== "all") {
        params["filter[category_id]"] = filters.category;
      }
      if (filters.emergency) {
        params["filter[emergency]"] = "true";
      }
      const response = await api.get<Envelope<Service[]>>("/services", { params });
      return response.data.data.filter((service) => service.active);
    }
  });

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "KES" }).format(value / 100);

const ServicesPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { data: services, isLoading: loadingServices, isFetching } = useServices({
    category,
    emergency: emergencyOnly
  });

  const categoryOptions = useMemo(() => {
    const base = [{ id: "all", name: "All" }, ...(categories ?? [])];
    return base;
  }, [categories]);

  const filteredServices = useMemo(() => {
    const items = services ?? [];
    return items.filter((service) => {
      if (search && !service.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      const price = service.base_price_cents;
      if (minPrice !== "" && price < Number(minPrice) * 100) {
        return false;
      }
      if (maxPrice !== "" && price > Number(maxPrice) * 100) {
        return false;
      }
      return true;
    });
  }, [services, search, minPrice, maxPrice]);

  if (loadingCategories || loadingServices) {
    return <Loading fullHeight />;
  }

  const resetPriceFilters = () => {
    setMinPrice("");
    setMaxPrice("");
  };

  const openBookingDialog = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setBookingDialogOpen(true);
  };

  const handleBookingCreated = (bookingId: string) => {
    setBookingDialogOpen(false);
    navigate(`/app/bookings/${bookingId}`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/70 bg-gradient-to-br from-emerald-50 via-white to-white p-4 shadow-sm ring-1 ring-black/5 sm:rounded-[32px] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">Services</p>
            <h1 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl lg:text-2xl">
              Professional Care at your Doorstep
            </h1>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Browse and book specialized services instantly without the back-and-forth.
            </p>
          </div>
          <div className="hidden gap-3 rounded-2xl border border-white/80 bg-white/50 p-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 shadow-inner sm:flex lg:w-auto">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <span>Smart Match</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <Timer className="h-3.5 w-3.5 text-indigo-500" />
              <span>Live ETA</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
              <span>Verified</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-card sm:rounded-[32px] sm:p-4 lg:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="service-search">
              Search services
            </label>
            <input
              id="service-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Try nursing, physiotherapy..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={classNames(
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                    category === item.id
                      ? "bg-primary-600 text-white shadow-lg"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 lg:w-80">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</p>
            <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                checked={emergencyOnly}
                onChange={(event) => setEmergencyOnly(event.target.checked)}
              />
              Emergency capable only
            </label>
            <div className="mt-4 grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price (KES)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value ? Number(event.target.value) : "")}
                />
                <span>—</span>
                <input
                  type="number"
                  placeholder="Max"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value ? Number(event.target.value) : "")}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={resetPriceFilters} className="justify-start text-slate-600">
                Reset price range
              </Button>
            </div>
          </div>
        </div>
        {isFetching && <p className="mt-4 text-xs text-slate-500">Refreshing services…</p>}
      </section>

      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServices.length === 0 ? (
            <Card title="No services found">
              <p className="text-sm text-slate-600">
                Try adjusting filters or clearing the search to see more options.
              </p>
            </Card>
          ) : (
            filteredServices.map((service) => (
              <article
                key={service.id}
                className="flex flex-col gap-4 rounded-[28px] border border-slate-100 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-elevated"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {service.category?.name ?? "General care"}
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900">{service.name}</h2>
                  </div>
                  {service.is_emergency_capable && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                      <Zap className="h-3.5 w-3.5" />
                      Emergency
                    </span>
                  )}
                </div>
                {service.description && (
                  <p className="text-sm text-slate-600 line-clamp-3">{service.description}</p>
                )}
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Starting at</p>
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(service.base_price_cents)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Session length</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {service.default_estimate_minutes} mins
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link to={`/app/services/${service.id}`} className="inline-flex">
                    <Button variant="ghost" className="w-full justify-center">
                      View details
                    </Button>
                  </Link>
                  <Button className="w-full justify-center" onClick={() => openBookingDialog(service.id)}>
                    Book now
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
      <BookingRequestDialog
        open={bookingDialogOpen}
        serviceId={selectedServiceId}
        onClose={() => setBookingDialogOpen(false)}
        onCreated={handleBookingCreated}
      />
    </div>
  );
};

export default ServicesPage;
