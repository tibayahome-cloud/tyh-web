import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import classNames from "classnames";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  ShieldCheck,
  Timer,
  Zap,
  Search,
  SlidersHorizontal,
  X,
  ChevronRight,
  Heart,
  ArrowRight,
  CalendarDays
} from "lucide-react";
import Drawer from "@mui/material/Drawer";

import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, serviceCategoryAdmin, svcCard } from "../../../shared/libs/fieldInclude";
import { BookingRequestDialog } from "../components/BookingRequestDialog";
import { AppLayout } from "../../../shared/components/AppLayout";

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
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { data: services, isLoading: loadingServices, isFetching } = useServices({
    category,
    emergency: emergencyOnly
  });

  const categoryOptions = useMemo(() => {
    const base = [{ id: "all", name: "All Services" }, ...(categories ?? [])];
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

  const resetFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setEmergencyOnly(false);
  };

  const openBookingDialog = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setBookingDialogOpen(true);
  };

  const handleBookingCreated = (bookingId: string) => {
    setBookingDialogOpen(false);
    navigate(`/app/bookings/${bookingId}`);
  };

  const activeFiltersCount = [emergencyOnly, minPrice !== "", maxPrice !== ""].filter(Boolean).length;

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="flex flex-col gap-4 sm:gap-8 pb-20">
        {/* IMMERSIVE HERO */}
        <section className="relative -mx-4 -mt-12 overflow-hidden px-4 pb-12 pt-16 sm:-mx-8 sm:px-8">
          <div className="absolute inset-0 bg-brand-linear opacity-90" />
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-2xl" />

          <div className="relative z-10">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Service Marketplace</p>
              <h1 className="text-4xl font-black text-white leading-tight">
                Professional Care <br />
                <span className="text-white/70">At Your Fingerprints</span>
              </h1>
              <p className="mt-2 max-w-sm text-sm font-medium text-white/60 leading-relaxed">
                Choose from verified medical professionals and book instantly.
              </p>
            </div>

            {/* SEARCH & QUICK FILTERS */}
            <div className="mt-10 flex flex-col gap-4">
              <div className="relative flex items-center">
                <Search className="absolute left-5 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search for services (e.g. Nursing)"
                  className="w-full h-16 rounded-3xl bg-white/10 pl-14 pr-16 text-white placeholder-white/40 backdrop-blur-2xl ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all shadow-2xl"
                />
                <button
                  onClick={() => setFilterDrawerOpen(true)}
                  className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-xl transition-all active:scale-90"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                  {activeFiltersCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>

              {/* QUICK CATEGORIES */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {categoryOptions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCategory(item.id)}
                    className={classNames(
                      "shrink-0 rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-widest transition-all backdrop-blur-md",
                      category === item.id
                        ? "bg-white text-brand-600 shadow-xl"
                        : "bg-white/10 text-white hover:bg-white/20 ring-1 ring-white/10"
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* SERVICE GRID */}
      <section className="px-4 sm:px-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-900">Available Services</h2>
          {isFetching && (
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-600">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-600" />
              Refreshing...
            </div>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServices.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
                <Search size={40} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No services found</h3>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting filters or searching for something else.
              </p>
              <Button variant="ghost" className="mt-4" onClick={resetFilters}>
                Clear all filters
              </Button>
            </div>
          ) : (
            filteredServices.map((service) => (
              <article
                key={service.id}
                className="group relative flex flex-col overflow-hidden rounded-[40px] border border-slate-100 bg-white p-2 shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="relative h-48 overflow-hidden rounded-[32px] bg-slate-50">
                  <div className="absolute inset-0 bg-brand-linear opacity-0 transition-opacity group-hover:opacity-10" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-2xl bg-white shadow-xl flex items-center justify-center text-brand-600">
                      {service.category?.name?.toLowerCase().includes("nurse") ? <ShieldCheck size={32} /> : <Heart size={32} />}
                    </div>
                  </div>

                  {service.is_emergency_capable && (
                    <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">
                      <Zap size={12} fill="currentColor" />
                      Emergency
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {service.category?.name ?? "General"}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      <Timer size={12} />
                      {service.default_estimate_minutes}m
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 group-hover:text-brand-600 transition-colors">
                    {service.name}
                  </h3>

                  {service.description && (
                    <p className="mt-2 text-sm font-medium text-slate-500 line-clamp-2">
                      {service.description}
                    </p>
                  )}

                  <div className="mt-auto pt-4">
                    <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fixed Rate</p>
                        <p className="text-lg font-black text-brand-600">{formatCurrency(service.base_price_cents)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/app/services/${service.id}`}>
                          <button className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center transition-all hover:bg-slate-100 hover:text-brand-600 active:scale-95">
                            <ChevronRight size={20} />
                          </button>
                        </Link>
                        <button
                          onClick={() => openBookingDialog(service.id)}
                          className="h-12 rounded-2xl bg-slate-900 px-6 text-[11px] font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-brand-600 active:scale-95"
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* FILTER DRAWER */}
      <Drawer
        anchor="right"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        PaperProps={{
          sx: { width: { xs: "100%", sm: 400 }, borderRadius: { xs: 0, sm: "40px 0 0 40px" } }
        }}
      >
        <div className="flex h-full flex-col p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">Filters</h2>
            <button
              onClick={() => setFilterDrawerOpen(false)}
              className="h-10 w-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-10 flex-1 space-y-8">
            {/* EMERGENCY TOGGLE */}
            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Urgency</p>
              <button
                onClick={() => setEmergencyOnly(!emergencyOnly)}
                className={classNames(
                  "flex w-full items-center justify-between rounded-3xl border p-5 transition-all",
                  emergencyOnly
                    ? "border-rose-500 bg-rose-50/50 shadow-lg ring-1 ring-rose-500"
                    : "border-slate-100 bg-slate-50/50 grayscale hover:grayscale-0"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={classNames(
                    "flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner",
                    emergencyOnly ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400"
                  )}>
                    <Zap size={24} fill={emergencyOnly ? "currentColor" : "none"} />
                  </div>
                  <div className="text-left">
                    <p className={classNames("font-black", emergencyOnly ? "text-rose-900" : "text-slate-900")}>Emergency Only</p>
                    <p className="text-[10px] font-bold text-slate-500">Show only instant response services</p>
                  </div>
                </div>
                <div className={classNames(
                  "h-6 w-10 rounded-full transition-all flex items-center px-1",
                  emergencyOnly ? "bg-rose-500" : "bg-slate-200"
                )}>
                  <div className={classNames(
                    "h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                    emergencyOnly ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
              </button>
            </div>

            {/* PRICE RANGE */}
            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Budget (KES)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Min Price</label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : "")}
                    placeholder="0"
                    className="w-full h-14 rounded-2xl bg-slate-50 border-slate-100 px-5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600/20 transition-all border shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Max Price</label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : "")}
                    placeholder="Any"
                    className="w-full h-14 rounded-2xl bg-slate-50 border-slate-100 px-5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600/20 transition-all border shadow-inner"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex gap-4 pt-8 border-t border-slate-100">
            <button
              onClick={resetFilters}
              className="h-14 flex-1 rounded-2xl bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-100 active:scale-95"
            >
              Reset
            </button>
            <button
              onClick={() => setFilterDrawerOpen(false)}
              className="h-14 flex-[2] rounded-2xl bg-slate-900 text-[11px] font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-brand-600 active:scale-95"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </Drawer>

      <BookingRequestDialog
        open={bookingDialogOpen}
        serviceId={selectedServiceId}
        onClose={() => setBookingDialogOpen(false)}
        onCreated={handleBookingCreated}
      />
    </AppLayout>
  );
};

export default ServicesPage;
