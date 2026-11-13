import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { ApiErrorBanner } from "../../../../shared/components/ApiErrorBanner";
import { Input } from "../../../../shared/components/Input";
import { Skeleton } from "../../../../shared/components/Skeleton";
import { COMPANY_PHONE, COMPANY_PHONE_DISPLAY } from "../../../../shared/constants/contact";
import { fetchHomeCareServices, type HomeCareService } from "../../../../shared/libs/homeCarePublic";
import { careServiceImage } from "../../../../shared/utils/careServiceImage";
import { classifyApiError } from "../../../../shared/utils/errors";

export const StepHeading = ({ children, hint }: { children: string; hint?: string }) => (
  <div>
    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{children}</h2>
    {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
  </div>
);

const ALL = "all";

export const ServiceStep = ({ onChoose }: { onChoose: (service: HomeCareService) => void }) => {
  const query = useQuery({ queryKey: ["public", "home-care", "services"], queryFn: fetchHomeCareServices, staleTime: 60_000 });
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
      <StepHeading hint="A carer comes to you. You pay after the visit.">What care do you need at home?</StepHeading>

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
          No home care services are open for booking online right now. Call us on{" "}
          <a className="font-semibold underline underline-offset-2" href={`tel:${COMPANY_PHONE}`}>
            {COMPANY_PHONE_DISPLAY}
          </a>{" "}
          and we will arrange a visit.
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
                      <span className="mt-auto pt-1 text-xs text-slate-500">About {service.default_estimate_minutes} minutes</span>
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
