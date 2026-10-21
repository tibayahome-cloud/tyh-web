export type CatalogService = {
  id: string;
  name: string;
  description?: string | null;
  base_price_cents: number;
  default_estimate_minutes: number;
  is_emergency_capable: boolean;
  active: boolean;
  remote_capable?: boolean;
  category?: { id: string; name: string } | null;
};

export type CategoryTile = { id: string; name: string; count: number };

/**
 * This page is for care that comes to you (nursing, elderly care, ambulance and the like). Video consultations have
 * their own Telemedicine screen, so a service that exists only as a remote consultation is not listed here.
 */
export const isHomeService = (service: CatalogService): boolean => service.active && !service.remote_capable;

/** One tile per kind of care that has something to book, biggest first, so an empty category never shows. */
export const categoryTiles = (services: CatalogService[]): CategoryTile[] => {
  const byId = new Map<string, CategoryTile>();
  services.forEach((service) => {
    const category = service.category;
    if (!category) return;
    const tile = byId.get(category.id) ?? { id: category.id, name: category.name, count: 0 };
    tile.count += 1;
    byId.set(category.id, tile);
  });
  return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

export type CatalogFilters = {
  search: string;
  categoryId: string;
  emergencyOnly: boolean;
  minPrice: number | "";
  maxPrice: number | "";
};

export const filterServices = (services: CatalogService[], filters: CatalogFilters): CatalogService[] => {
  const needle = filters.search.trim().toLowerCase();
  return services.filter((service) => {
    if (filters.categoryId !== "all" && service.category?.id !== filters.categoryId) return false;
    if (filters.emergencyOnly && !service.is_emergency_capable) return false;
    if (needle && !`${service.name} ${service.description ?? ""} ${service.category?.name ?? ""}`.toLowerCase().includes(needle)) return false;
    if (filters.minPrice !== "" && service.base_price_cents < Number(filters.minPrice) * 100) return false;
    if (filters.maxPrice !== "" && service.base_price_cents > Number(filters.maxPrice) * 100) return false;
    return true;
  });
};

/** "KES 1,500": the unit spelled out and no empty cents, the same on every device. */
export const formatPrice = (cents: number): string =>
  cents > 0 ? `KES ${Math.round(cents / 100).toLocaleString("en-US")}` : "Quote on request";

export type CareImageKey = "nurse" | "elderly" | "therapy" | "lab" | "doctor" | "ambulance" | "home";

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
