import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, Search } from "lucide-react";

import { ApiErrorBanner } from "../../../../shared/components/ApiErrorBanner";
import { Input } from "../../../../shared/components/Input";
import { Skeleton } from "../../../../shared/components/Skeleton";
import { COMPANY_PHONE, COMPANY_PHONE_DISPLAY } from "../../../../shared/constants/contact";
import { useDeviceLocation } from "../../../../shared/hooks/useDeviceLocation";
import {
  fetchHomeCarePrices,
  fetchHomeCareServices,
  type CareKind,
  type CarePrice,
  type HomeCareService
} from "../../../../shared/libs/homeCarePublic";
import { careServiceImage } from "../../../../shared/utils/careServiceImage";
import { classifyApiError } from "../../../../shared/utils/errors";
import { formatKm, formatMoney } from "./format";

export const StepHeading = ({ children, hint }: { children: string; hint?: string }) => (
  <div>
    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{children}</h2>
    {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
  </div>
);

const ALL = "all";

/** The price line on a card: what this visitor will pay once we know where they are, otherwise the lowest price. */
export const priceLabel = (price: CarePrice | undefined): string | null => {
  if (!price) return null;
  if (price.nearest) {
    const { price_cents, currency, facility_name, distance_km } = price.nearest;
    return `${formatMoney(price_cents, currency)} · ${facility_name}, ${formatKm(distance_km)}`;
  }
  return price.from_cents ? `From ${formatMoney(price.from_cents, price.currency ?? "KES")}` : null;
};

/** Reads the device location only when the visitor has already allowed it for this site: no prompt on arrival. */
const useLocationIfAllowed = () => {
  const device = useDeviceLocation(false);
  const { ask } = device;
  useEffect(() => {
    let live = true;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (live && status.state === "granted") ask();
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [ask]);
  return device;
};

export const ServiceStep = ({ onChoose, kind = "home" }: { onChoose: (service: HomeCareService) => void; kind?: CareKind }) => {
  const query = useQuery({ queryKey: ["public", "home-care", "services", kind], queryFn: () => fetchHomeCareServices(kind), staleTime: 60_000 });
  const ambulance = kind === "ambulance";
  const device = useLocationIfAllowed();
  // Rounded so a device that moves a few metres does not ask again.
  const where = device.coords ? { lat: Math.round(device.coords.lat * 1000) / 1000, lng: Math.round(device.coords.lng * 1000) / 1000 } : null;
  const prices = useQuery({
    queryKey: ["public", "home-care", "prices", kind, where?.lat ?? null, where?.lng ?? null],
    queryFn: () => fetchHomeCarePrices(kind, where),
    staleTime: 60_000
  });
  const priceFor = useMemo(() => new Map((prices.data ?? []).map((price) => [price.service_id, price])), [prices.data]);
  const anyNearest = (prices.data ?? []).some((price) => price.nearest);
  // An ambulance request with one service on offer needs no choosing: go straight on, once. Back brings the list.
  const autoChosen = useRef(false);
  useEffect(() => {
    if (!ambulance || autoChosen.current || !query.data || query.data.length !== 1) return;
    autoChosen.current = true;
    onChoose(query.data[0]);
  }, [ambulance, query.data, onChoose]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState(ALL);

  const categories = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const service of query.data ?? []) {
      if (!service.category) continue;
      const entry = counts.get(service.category.id) ?? { name: service.category.name, count: 0 };
      counts.set(service.category.id, { ...entry, count: entry.count + 1 });
    }
    return [...counts.entries()].map(([id, entry]) => ({ id, ...entry })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [query.data]);

  const shown = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return (query.data ?? []).filter(
      (service) =>
        (category === ALL || service.category?.id === category) &&
        (!needle || `${service.name} ${service.description ?? ""}`.toLowerCase().includes(needle))
    );
  }, [query.data, text, category]);

  return (
    <div className="space-y-4">
      <StepHeading hint={ambulance ? "An ambulance comes to you. You pay before it is sent." : "A carer comes to you. You pay after the visit."}>
        {ambulance ? "Which ambulance service do you need?" : "What care do you need at home?"}
      </StepHeading>

      {query.isLoading && (
        <div className="space-y-3" role="status" aria-live="polite">
          <span className="sr-only">Loading services</span>
          <Skeleton height={48} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <Skeleton key={n} height={96} />
            ))}
          </div>
        </div>
      )}

      {query.isError && (
        <ApiErrorBanner {...classifyApiError(query.error, "We could not load the services.")} onRetry={() => void query.refetch()} />
      )}

      {query.data && query.data.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {ambulance ? "No ambulance service is open for online requests right now. Call us on" : "No home care services are open for booking online right now. Call us on"}{" "}
          <a className="font-semibold underline underline-offset-2" href={`tel:${COMPANY_PHONE}`}>
            {COMPANY_PHONE_DISPLAY}
          </a>
          {ambulance ? "." : " and we will arrange a visit."}
        </p>
      )}

      {query.data && query.data.length > 0 && (
        <>
          <Input
            name="search-care"
            type="search"
            aria-label="Search care"
            placeholder="Search care"
            icon={<Search className="h-4 w-4 text-slate-400" aria-hidden />}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600" role="status" aria-live="polite">
            {device.status === "found" && anyNearest && "Prices are for where you are now."}
            {device.status === "found" && prices.data && !anyNearest && "No facility reaches where you are yet. Prices shown are the lowest anywhere."}
            {device.status === "asking" && "Finding where you are…"}
            {(device.status === "idle" || device.status === "timeout" || device.status === "unavailable") && (
              <>
                <span>Prices depend on the facility nearest you.</span>
                <button
                  type="button"
                  onClick={device.ask}
                  className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-tiba-blue underline underline-offset-2"
                >
                  <LocateFixed className="h-4 w-4" aria-hidden />
                  Use my location for exact prices
                </button>
              </>
            )}
            {device.status === "denied" && "Prices shown are the lowest any facility charges. The exact price shows once you choose the place."}
          </p>

          {categories.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Kinds of care">
              {[{ id: ALL, name: "All care", count: query.data.length }, ...categories].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={category === item.id}
                  onClick={() => setCategory(item.id)}
                  className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40 ${
                    category === item.id ? "border-tiba-blue bg-tiba-blue text-white" : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}

          {shown.length === 0 ? (
            <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              Nothing matches. Try a shorter search or choose All care.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((service) => (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() => onChoose(service)}
                    className="flex h-full min-h-[96px] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
                  >
                    {/* The picture made for this service, or the closest stock photo. It is decoration: the name says it. */}
                    <img
                      src={careServiceImage(service)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="aspect-[16/9] w-full object-cover"
                    />
                    <span className="flex flex-1 flex-col gap-1 p-4">
                      <span className="text-base font-semibold text-slate-900">{service.name}</span>
                      {service.description && <span className="line-clamp-2 text-sm text-slate-600">{service.description}</span>}
                      {priceLabel(priceFor.get(service.id)) && (
                        <span className="mt-auto pt-1 text-sm font-semibold text-slate-900">{priceLabel(priceFor.get(service.id))}</span>
                      )}
                      <span className={`${priceLabel(priceFor.get(service.id)) ? "" : "mt-auto pt-1 "}text-xs text-slate-500`}>
                        About {service.default_estimate_minutes} minutes
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
