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
import { ClientPageHeader } from "../components/ClientPageHeader";

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
      <div className="flex flex-col gap-4 pb-20">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 pt-4">
          <div>
            <h1 className="type-h2 text-slate-900">Care Marketplace</h1>
          </div>
          <button
            onClick={() => setFilterDrawerOpen(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-all active:scale-95"
          >
            <SlidersHorizontal size={18} />
            {activeFiltersCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white shadow-lg">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-col gap-6 px-4 sm:px-6 lg:px-8">
          {/* SEARCH & QUICK FILTERS */}
          <section className="space-y-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-brand-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for services (e.g. Nursing, Physiotherapy)"
                className="w-full h-12 rounded-lg bg-white border border-slate-100 pl-12 pr-4 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600/10 focus:border-brand-600/20 transition-all shadow-sm"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {categoryOptions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCategory(item.id)}
                  className={classNames(
                    "shrink-0 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all",
                    category === item.id
                      ? "bg-slate-900 text-white shadow-md"
                      : "bg-white text-slate-500 border border-slate-100 hover:border-slate-200"
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </section>

          {/* SERVICE GRID */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                {isFetching && (
                  <p className="text-xs font-bold text-brand-600 animate-pulse">Refreshing...</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredServices.length === 0 ? (
                <div className="col-span-full py-20 text-center">
                  <div className="mb-6 flex h-24 w-24 mx-auto items-center justify-center rounded-[2.5rem] bg-slate-50 text-slate-300">
                    <Search size={40} />
                  </div>
                  <h3 className="type-h3 text-slate-900">No results found</h3>
                  <p className="mt-2 type-body text-slate-500">
                    Try adjusting your search or filters.
                  </p>
                  <Button variant="ghost" className="mt-8" onClick={resetFilters}>
                    Clear all filters
                  </Button>
                </div>
              ) : (
                filteredServices.map((service) => (
                  <article
                    key={service.id}
                    className="group flex flex-col overflow-hidden rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="relative h-28 overflow-hidden rounded-lg bg-slate-50">
                      <div className="absolute inset-0 bg-brand-linear opacity-0 transition-opacity group-hover:opacity-10" />
                      <div className="absolute inset-0 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
                        <div className="h-12 w-12 rounded-lg bg-white shadow-lg flex items-center justify-center text-brand-600">
                          {service.category?.name?.toLowerCase().includes("nurse") ? <ShieldCheck size={24} /> : <Heart size={24} />}
                        </div>
                      </div>

                      {service.is_emergency_capable && (
                        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-white shadow-lg">
                          <Zap size={10} fill="currentColor" />
                          Emergency
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {service.category?.name ?? "General"}
                        </span>
                        <div className="flex items-center gap-0.5 text-slate-500">
                          <Timer size={10} className="text-slate-400" />
                          <span className="text-[10px] font-bold">{service.default_estimate_minutes}m</span>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1">
                        {service.name}
                      </h3>

                      {service.description && (
                        <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                          {service.description}
                        </p>
                      )}

                      <div className="mt-auto pt-3 border-t border-slate-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[8px] font-bold text-slate-300 uppercase">Rate</p>
                            <p className="text-sm font-bold text-brand-600">{formatCurrency(service.base_price_cents)}</p>
                          </div>
                          <div className="flex gap-2">
                            <Link to={`/app/services/${service.id}`}>
                              <button className="h-8 w-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center transition-all hover:bg-slate-100 hover:text-brand-600 active:scale-95 ring-1 ring-slate-100">
                                <ChevronRight size={14} />
                              </button>
                            </Link>
                            <button
                              onClick={() => openBookingDialog(service.id)}
                              className="h-8 rounded-lg bg-slate-900 px-3 text-[10px] font-bold uppercase text-white shadow-sm transition-all hover:bg-brand-600 active:scale-95"
                            >
                              Book
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
        </div>
      </div>

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
