import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import classNames from "classnames";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Search, SlidersHorizontal, Zap, X } from "lucide-react";
import Drawer from "@mui/material/Drawer";

import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, svcCard } from "../../../shared/libs/fieldInclude";
import { BookingRequestDialog } from "../components/BookingRequestDialog";
import { AppLayout } from "../../../shared/components/AppLayout";
import nurseImg from "../../../assets/images/service-nurse.png";
import nurse2Img from "../../../assets/images/service-nurse_.png";
import nurse3Img from "../../../assets/images/nursing.png";
import elderlyImg from "../../../assets/images/service-elderly.png";
import therapyImg from "../../../assets/images/service-therapy.png";
import labImg from "../../../assets/images/lab-sample-collection.png";
import doctorImg from "../../../assets/images/service-doctor.png";
import ambulanceImg from "../../../assets/images/service-ambulance.png";
import homeImg from "../../../assets/images/hero-home.png";
import home2Img from "../../../assets/images/hero.png";
import physioImg from "../../../assets/images/telemedicine/physiotherapy.webp";
import occupationalImg from "../../../assets/images/telemedicine/generated/occupational-therapy-consultation.webp";
import speechImg from "../../../assets/images/telemedicine/child-growth-review.webp";
import scanImg from "../../../assets/images/telemedicine/imaging-review.webp";
import ecgImg from "../../../assets/images/telemedicine/lab-results-review.webp";
import cancerImg from "../../../assets/images/telemedicine/cancer-care.webp";
import maternityImg from "../../../assets/images/telemedicine/maternity-care.webp";
import chronicImg from "../../../assets/images/telemedicine/chronic-disease-care.webp";
import checkupImg from "../../../assets/images/telemedicine/general-consultation.webp";
import equipmentImg from "../../../assets/images/telemedicine/medication-review.webp";
import { photoForService, serviceImageKey, categoryTiles, filterServices, formatPrice, isHomeService, type CatalogService } from "../utils/serviceCatalog";

type Envelope<T> = {
  data: T;
};

const useServices = () =>
  useQuery({
    queryKey: ["client", "services", "home-care"],
    queryFn: async () => {
      const params: Record<string, string> = {
        ...buildFieldParams(svcCard),
        // Only services a facility can actually deliver right now, not every active catalogue definition.
        "filter[active]": "true",
        "filter[has_active_offering]": "true"
      };
      const response = await api.get<Envelope<CatalogService[]>>("/services", { params });
      return response.data.data.filter(isHomeService);
    }
  });

const CARE_IMAGES = {
  nurse: nurseImg,
  "nurse-2": nurse2Img,
  "nurse-3": nurse3Img,
  elderly: elderlyImg,
  therapy: therapyImg,
  physio: physioImg,
  occupational: occupationalImg,
  speech: speechImg,
  lab: labImg,
  scan: scanImg,
  ecg: ecgImg,
  doctor: doctorImg,
  ambulance: ambulanceImg,
  home: homeImg,
  "home-2": home2Img,
  cancer: cancerImg,
  maternity: maternityImg,
  chronic: chronicImg,
  checkup: checkupImg,
  equipment: equipmentImg
} as const;

// Photos made for one service are dropped in src/assets/images/services/<service key>.webp (see the README there) and
// are used automatically; a service without one gets the closest stock photo.
const SERVICE_PHOTOS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob("../../../assets/images/services/*.{webp,jpg,jpeg,png}", { eager: true, import: "default" })).map(
    ([path, url]) => [path.split("/").pop()!.replace(/\.[^.]+$/, ""), url as string]
  )
);

const serviceImage = (service: { key: string; name: string; category?: { name: string } | null }) =>
  photoForService(service.key, SERVICE_PHOTOS, CARE_IMAGES[serviceImageKey(service.name, service.category?.name)]);

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

  const servicesQuery = useServices();
  const services = servicesQuery.data;

  const tiles = useMemo(() => categoryTiles(services ?? []), [services]);
  const filteredServices = useMemo(
    () => filterServices(services ?? [], { search, categoryId: category, emergencyOnly, minPrice, maxPrice }),
    [services, search, category, emergencyOnly, minPrice, maxPrice]
  );

  if (servicesQuery.isLoading) {
    return <Loading fullHeight />;
  }

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
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
            type="button"
            aria-label="Filters"
            onClick={() => setFilterDrawerOpen(true)}
            className="relative flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-all active:scale-95"
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
          {servicesQuery.isError && (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <p className="font-semibold">We could not load the services.</p>
              <Button type="button" size="sm" variant="secondary" className="mt-2 min-h-[44px]" onClick={() => servicesQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}

          <section className="space-y-4">
            <label className="relative block">
              <span className="sr-only">Search services</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for services (e.g. Nursing, Physiotherapy)"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
              />
            </label>

            {tiles.length > 0 && (
              <div role="group" aria-label="Kind of care" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {[{ id: "all", name: "All", count: services?.length ?? 0 }, ...tiles].map((tile) => {
                  const selected = category === tile.id;
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCategory(tile.id)}
                      className={classNames(
                        "inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue",
                        selected ? "border-tiba-blue bg-tiba-blue text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                      )}
                    >
                      {tile.name}
                      <span className={classNames("text-xs", selected ? "text-white/90" : "text-slate-600")}>{tile.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-label="Services" className="space-y-4">
            {filteredServices.length === 0 && !servicesQuery.isError ? (
              <div className="py-16 text-center">
                <Search aria-hidden="true" size={36} className="mx-auto text-slate-400" />
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {services && services.length === 0 ? "No care services are available yet" : "Nothing matches"}
                </h3>
                <p className="mt-1 text-sm text-slate-700">
                  {services && services.length === 0 ? "Check back soon, or talk to a doctor online from the Telemedicine tab." : "Try a different word or clear the filters."}
                </p>
                {services && services.length > 0 && (
                  <Button variant="secondary" className="mt-5 min-h-[44px]" onClick={resetFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((service) => (
                  <li key={service.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                    <Link to={`/app/services/${service.id}`} aria-label={`${service.name}, details`} className="relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tiba-blue">
                      <img src={serviceImage(service)} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                      {service.is_emergency_capable && (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white">
                          <Zap aria-hidden="true" size={12} /> Urgent
                        </span>
                      )}
                    </Link>
                    <div className="p-4">
                      <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{service.name}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                        <Clock aria-hidden="true" size={14} /> {service.default_estimate_minutes} min
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-lg font-bold text-slate-900">{formatPrice(service.base_price_cents)}</p>
                        <Button type="button" className="min-h-[44px] px-6" onClick={() => openBookingDialog(service.id)}>
                          Book
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
