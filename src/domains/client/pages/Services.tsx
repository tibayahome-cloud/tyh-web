import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Search, SlidersHorizontal, Zap, X } from "lucide-react";

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
import { ServiceFilterSheet } from "../components/ServiceFilterSheet";
import {
  CARE_GROUPS,
  NO_FILTERS,
  PRICE_BANDS,
  activeFilterCount,
  filterServices,
  formatPrice,
  groupTiles,
  isHomeService,
  photoForService,
  serviceImageKey,
  type CareGroupId,
  type CatalogFilters,
  type CatalogService
} from "../utils/serviceCatalog";

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

const GROUP_IMAGES: Record<CareGroupId, string> = {
  nursing: nurseImg,
  elderly: elderlyImg,
  therapy: therapyImg,
  checkups: labImg,
  plans: homeImg,
  other: home2Img
};

const FilterChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <span className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-sky-50 pl-3 pr-1 text-sm font-medium text-slate-900 ring-1 ring-sky-200">
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter ${label}`}
      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
    >
      <X aria-hidden="true" size={14} />
    </button>
  </span>
);

const ServicesPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<CatalogFilters>(NO_FILTERS);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const servicesQuery = useServices();
  const services = servicesQuery.data;

  const groups = useMemo(() => groupTiles(services ?? []), [services]);
  const filteredServices = useMemo(() => filterServices(services ?? [], filters), [services, filters]);
  const filterCount = activeFilterCount(filters);

  if (servicesQuery.isLoading) {
    return <Loading fullHeight />;
  }

  const resetFilters = () => setFilters(NO_FILTERS);

  const openBookingDialog = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setBookingDialogOpen(true);
  };

  const handleBookingCreated = (bookingId: string) => {
    setBookingDialogOpen(false);
    navigate(`/app/bookings/${bookingId}`);
  };

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="flex flex-col gap-4 pb-20">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 pt-4">
          <div>
            <h1 className="type-h2 text-slate-900">Care Marketplace</h1>
          </div>
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

          <section className="space-y-3">
            <div className="flex gap-2">
              <label className="relative block flex-1">
                <span className="sr-only">Search services</span>
                <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Search for services (e.g. Nursing, Physiotherapy)"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
                />
              </label>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(true)}
                aria-haspopup="dialog"
                className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
              >
                <SlidersHorizontal aria-hidden="true" size={18} />
                Filters
                {filterCount > 0 && (
                  <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-tiba-blue px-1.5 text-xs font-semibold text-white">
                    {filterCount}
                  </span>
                )}
              </button>
            </div>

            {filterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
                {filters.groupId !== "all" && (
                  <FilterChip label={CARE_GROUPS.find((g) => g.id === filters.groupId)?.name ?? ""} onRemove={() => setFilters((f) => ({ ...f, groupId: "all" }))} />
                )}
                {filters.urgentOnly && <FilterChip label="Urgent care" onRemove={() => setFilters((f) => ({ ...f, urgentOnly: false }))} />}
                {filters.priceBand !== "any" && (
                  <FilterChip label={PRICE_BANDS.find((b) => b.id === filters.priceBand)?.label ?? ""} onRemove={() => setFilters((f) => ({ ...f, priceBand: "any" }))} />
                )}
                <button type="button" onClick={() => setFilters((f) => ({ ...NO_FILTERS, search: f.search }))} className="min-h-[44px] px-2 text-sm font-semibold text-tiba-blue underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue">
                  Clear all
                </button>
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

      <ServiceFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onApply={setFilters}
        groups={groups}
        services={services ?? []}
        imageForGroup={(id) => GROUP_IMAGES[id]}
        allImage={homeImg}
      />

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
