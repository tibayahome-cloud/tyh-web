export type CatalogService = {
  id: string;
  /** Stable name of the service, also the name of its photo file. */
  key: string;
  name: string;
  description?: string | null;
  base_price_cents: number;
  default_estimate_minutes: number;
  is_emergency_capable: boolean;
  active: boolean;
  remote_capable?: boolean;
  /** From the API: telemedicine, home_based or ambulance. */
  care_type?: "telemedicine" | "home_based" | "ambulance";
  category?: { id: string; name: string } | null;
};

/**
 * This page is for care that comes to you (nursing, elderly care, ambulance and the like). Video consultations have
 * their own Telemedicine screen, so a service that exists only as a remote consultation is not listed here.
 */
export const isHomeService = (service: CatalogService): boolean => service.active && !service.remote_capable && service.care_type !== "telemedicine";

export type CareGroupId = "ambulance" | "nursing" | "elderly" | "therapy" | "checkups" | "plans" | "other";

export const CARE_GROUPS: Array<{ id: CareGroupId; name: string }> = [
  { id: "ambulance", name: "Ambulance" },
  { id: "nursing", name: "Nursing & doctor visits" },
  { id: "elderly", name: "Elderly & palliative care" },
  { id: "therapy", name: "Therapy & rehabilitation" },
  { id: "checkups", name: "Check-ups & diagnostics" },
  { id: "plans", name: "Care plans & memberships" },
  { id: "other", name: "Other care" }
];

/**
 * The ten or so catalogue categories are too many to choose from, so clients see five plain groups. The catalogue keeps
 * its own categories; this only decides which group a category is shown under, by the words in its name.
 */
export const careGroupOf = (categoryName: string | null | undefined): CareGroupId => {
  const name = (categoryName ?? "").toLowerCase();
  if (/plan|membership|subscription|tibacare/.test(name)) return "plans";
  if (/elder|assisted|palliative|oncolog/.test(name)) return "elderly";
  if (/therapy|rehab/.test(name)) return "therapy";
  if (/diagnos|corporate|executive|monitor|lab/.test(name)) return "checkups";
  if (/nurs|caregiver|doctor|consult|post-hospital|recovery/.test(name)) return "nursing";
  return "other";
};

/** The group a service is shown under: an ambulance is its own group whatever its category, otherwise by category. */
export const careGroupOfService = (service: CatalogService): CareGroupId =>
  service.care_type === "ambulance" ? "ambulance" : careGroupOf(service.category?.name);

export type GroupTile = { id: CareGroupId; name: string; count: number };

/** One entry per group that has something to book, in a fixed, familiar order. */
export const groupTiles = (services: CatalogService[]): GroupTile[] => {
  const counts = new Map<CareGroupId, number>();
  services.forEach((service) => {
    const id = careGroupOfService(service);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  return CARE_GROUPS.filter((group) => counts.has(group.id)).map((group) => ({ ...group, count: counts.get(group.id) ?? 0 }));
};

export type PriceBand = "any" | "low" | "mid" | "high";

export const PRICE_BANDS: Array<{ id: PriceBand; label: string; min: number; max: number }> = [
  { id: "any", label: "Any price", min: 0, max: Infinity },
  { id: "low", label: "Under KES 2,000", min: 0, max: 199_999 },
  { id: "mid", label: "KES 2,000 to 5,000", min: 200_000, max: 500_000 },
  { id: "high", label: "Over KES 5,000", min: 500_001, max: Infinity }
];

export type CatalogFilters = {
  search: string;
  groupId: CareGroupId | "all";
  urgentOnly: boolean;
  priceBand: PriceBand;
};

export const NO_FILTERS: CatalogFilters = { search: "", groupId: "all", urgentOnly: false, priceBand: "any" };

/** How many sheet filters are on (the search box is separate), for the badge on the Filters button. */
export const activeFilterCount = (filters: CatalogFilters): number =>
  [filters.groupId !== "all", filters.urgentOnly, filters.priceBand !== "any"].filter(Boolean).length;

export const filterServices = (services: CatalogService[], filters: CatalogFilters): CatalogService[] => {
  const needle = filters.search.trim().toLowerCase();
  const band = PRICE_BANDS.find((entry) => entry.id === filters.priceBand) ?? PRICE_BANDS[0];
  return services.filter((service) => {
    if (filters.groupId !== "all" && careGroupOfService(service) !== filters.groupId) return false;
    if (filters.urgentOnly && !service.is_emergency_capable) return false;
    if (needle && !`${service.name} ${service.description ?? ""} ${service.category?.name ?? ""}`.toLowerCase().includes(needle)) return false;
    // A service priced on request (zero) is never hidden by a price band.
    if (service.base_price_cents > 0 && (service.base_price_cents < band.min || service.base_price_cents > band.max)) return false;
    return true;
  });
};

/** "KES 1,500": the unit spelled out and no empty cents, the same on every device. */
export const formatPrice = (cents: number): string =>
  cents > 0 ? `KES ${Math.round(cents / 100).toLocaleString("en-US")}` : "Quote on request";

/** The photo file for a service: a file named after the service key wins; otherwise the best-matching stock photo. */
export const photoForService = (
  serviceKey: string,
  photosByKey: Record<string, string>,
  fallback: string
): string => photosByKey[serviceKey] ?? fallback;

export type CareImageKey =
  | "nurse" | "nurse-2" | "nurse-3" | "elderly" | "therapy" | "physio" | "occupational" | "speech" | "lab" | "scan"
  | "ecg" | "doctor" | "ambulance" | "home" | "home-2" | "cancer" | "maternity" | "chronic" | "checkup" | "equipment";

const RULES: Array<[RegExp, CareImageKey | CareImageKey[]]> = [
  [/ambulance/, "ambulance"],
  [/ultrasound|\bscan\b|imaging/, "scan"],
  [/ecg|vital sign|monitor/, "ecg"],
  [/laborator|sample|blood test/, "lab"],
  [/cancer|oncolog|palliative/, "cancer"],
  [/antenatal|maternity|prenatal|postnatal/, "maternity"],
  [/chronic/, "chronic"],
  [/occupational/, "occupational"],
  [/speech|child development/, "speech"],
  [/physio|stroke|rehab/, ["physio", "therapy"]],
  [/executive|annual|check-?up|health package/, "checkup"],
  [/equipment/, "equipment"],
  [/companion|elderly|assisted|day care/, "elderly"],
  [/iv therapy|catheter|tube|wound|injection|nurse|nursing|24-hour/, ["nurse", "nurse-2", "nurse-3"]],
  [/membership|plan|tibacare/, ["home", "home-2"]]
];

const spread = (name: string, count: number) => [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % count;

/**
 * The photo for one service, chosen by what the service is (a wound dressing gets a nurse, an ultrasound gets a scan),
 * falling back to its kind of care. Where several photos fit, the service name picks one so neighbours do not repeat.
 */
export const serviceImageKey = (serviceName: string, categoryName?: string | null): CareImageKey => {
  const name = serviceName.toLowerCase();
  for (const [pattern, key] of RULES) {
    if (pattern.test(name)) return Array.isArray(key) ? key[spread(name, key.length)] : key;
  }
  return careImageKey(categoryName);
};

/** Which photo stands for a kind of care. Matching is by words in the category name, so a new category still gets one. */
export const careImageKey = (categoryName: string | null | undefined): CareImageKey => {
  const name = (categoryName ?? "").toLowerCase();
  if (name.includes("ambulance") || name.includes("emergency")) return "ambulance";
  if (name.includes("elder") || name.includes("assisted") || name.includes("palliative")) return "elderly";
  if (name.includes("therapy") || name.includes("rehab")) return "therapy";
  if (name.includes("diagnos") || name.includes("lab")) return "lab";
  if (name.includes("doctor") || name.includes("consult") || name.includes("corporate")) return "doctor";
  if (name.includes("nurs") || name.includes("caregiver") || name.includes("post-hospital")) return "nurse";
  return "home";
};
