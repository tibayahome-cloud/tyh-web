import classNames from "classnames";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ambulance, House, MonitorSmartphone } from "lucide-react";

import { api } from "../../../../shared/libs/api";
import { KIND_LABEL, type ManagedKind } from "../../utils/serviceCategories";
import { ServiceCatalogPanel } from "./CatalogPage";
import { ServiceListPanel } from "./ServiceListPage";
import { ServiceRequestsPanel } from "./RequestsPage";
import TelemedicineCatalogPage from "./TelemedicineCatalogPage";

type Kind = ManagedKind | "telemedicine";

const KINDS: Array<{ key: Kind; description: string; Icon: typeof House }> = [
  { key: "home_based", description: "Care that comes to the client's home", Icon: House },
  { key: "ambulance", description: "Ambulance transport and emergency services", Icon: Ambulance },
  { key: "telemedicine", description: "Video consultations", Icon: MonitorSmartphone }
];

const TABS: Record<Kind, Array<{ key: "categories" | "services" | "requests"; label: string }>> = {
  home_based: [
    { key: "categories", label: "Categories" },
    { key: "services", label: "Services" },
    { key: "requests", label: "Requests" }
  ],
  ambulance: [
    { key: "categories", label: "Category" },
    { key: "services", label: "Services" }
  ],
  telemedicine: []
};

/** How many active services of a kind there are, from the API's own care_type, shown on the kind's button. */
const useServiceCount = (kind: ManagedKind) =>
  useQuery({
    queryKey: ["admin", "services", "count", kind],
    queryFn: async () => {
      const response = await api.get<{ data: unknown[] }>("/services", { params: { "filter[care_type]": kind, "filter[active]": "true", fields: "id" } });
      return response.data.data.length;
    },
    staleTime: 60_000
  }).data;

const ServiceManagementPage = () => {
  const [kind, setKind] = useState<Kind>("home_based");
  const [tab, setTab] = useState<"categories" | "services" | "requests">("categories");
  const homeCount = useServiceCount("home_based");
  const ambulanceCount = useServiceCount("ambulance");
  const counts: Partial<Record<Kind, number | undefined>> = { home_based: homeCount, ambulance: ambulanceCount };
  const tabs = TABS[kind];

  const chooseKind = (next: Kind) => {
    setKind(next);
    setTab("categories");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Service workspace</h1>
        <p className="text-sm text-slate-700">Home-based care, ambulance and telemedicine are managed separately, so they never get mixed up.</p>
      </div>

      <div role="radiogroup" aria-label="Kind of care" className="grid gap-3 sm:grid-cols-3">
        {KINDS.map(({ key, description, Icon }) => {
          const selected = kind === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => chooseKind(key)}
              className={classNames(
                "flex min-h-[72px] items-center gap-3 rounded-2xl border p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                selected ? "border-primary-600 bg-primary-50" : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <span className={classNames("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", selected ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700")}>
                <Icon aria-hidden="true" size={22} />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="text-base font-semibold text-slate-900">{KIND_LABEL[key]}</span>
                  {counts[key] !== undefined && <span className="text-sm text-slate-600">{counts[key]} active</span>}
                </span>
                <span className="block text-sm text-slate-700">{description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {tabs.length > 0 && (
        <div role="tablist" aria-label={`${KIND_LABEL[kind]} sections`} className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm">
          {tabs.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              onClick={() => setTab(entry.key)}
              className={classNames(
                "min-h-[40px] rounded-full border px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                tab === entry.key ? "border-primary-200 bg-primary-50 text-primary-800" : "border-transparent text-slate-700 hover:text-primary-700"
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {kind === "telemedicine" ? (
        <TelemedicineCatalogPage />
      ) : (
        <>
          {tab === "categories" && <ServiceCatalogPanel key={kind} kind={kind} />}
          {tab === "services" && <ServiceListPanel key={kind} kind={kind} />}
          {tab === "requests" && kind === "home_based" && <ServiceRequestsPanel />}
        </>
      )}
    </div>
  );
};

export default ServiceManagementPage;
