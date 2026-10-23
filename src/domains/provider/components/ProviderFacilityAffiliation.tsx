import { Building2 } from "lucide-react";

type FacilityAffiliation = {
  id?: string | null;
  name?: string | null;
  facility_type?: string | null;
  county?: string | null;
} | null;

const humanize = (value: string) => {
  const text = value.trim().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// What the card shows, or null when the provider has no facility to show. A facility with no name is
// reported as unavailable rather than invented, and type and county appear only when they are known.
export const facilityAffiliationSummary = (
  facility: FacilityAffiliation | undefined
): { name: string; known: boolean; detail: string | null } | null => {
  if (!facility || !facility.id) return null;
  const name = facility.name?.trim();
  const detail = [facility.facility_type?.trim() ? humanize(facility.facility_type) : null, facility.county?.trim() || null]
    .filter(Boolean)
    .join(" · ");
  return { name: name || "Facility details unavailable", known: Boolean(name), detail: detail || null };
};

// A small, read-only line of context for the provider dashboard: which facility they work under.
// Deliberately quiet so active bookings and availability stay the focus, and it carries no action
// and nothing about the facility's administration or finances.
export const ProviderFacilityAffiliation = ({ facility }: { facility: FacilityAffiliation | undefined }) => {
  const summary = facilityAffiliationSummary(facility);
  if (!summary) return null;
  return (
    <section aria-labelledby="provider-facility-heading" className="self-start rounded-xl bg-white p-3 ring-1 ring-slate-100">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden="true">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 id="provider-facility-heading" className="text-[11px] font-semibold text-slate-500">
            Your facility
          </h3>
          <p className={`break-words text-sm font-semibold ${summary.known ? "text-slate-900" : "text-slate-600"}`}>{summary.name}</p>
          {summary.detail && <p className="break-words text-[11px] text-slate-600">{summary.detail}</p>}
        </div>
      </div>
    </section>
  );
};
