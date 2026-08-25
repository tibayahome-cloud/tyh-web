import api from "./api";

export type TelemedicineCategory = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  displayOrder: number;
};

export type TelemedicineSubcategory = {
  id: string;
  categoryId: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  displayOrder: number;
  category?: TelemedicineCategory | null;
};

export type TelemedicineCatalogService = {
  id: string;
  subcategoryId: string;
  key: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  currency: string;
  defaultEstimateMinutes: number;
  isEmergencyCapable: boolean;
  status: string;
  tags: string[];
  subcategory?: TelemedicineSubcategory | null;
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === "object" ? (value as Record<string, any>) : {};

const dataRows = (value: unknown): Record<string, any>[] => {
  const payload = asRecord(value);
  return Array.isArray(payload.data) ? payload.data.map(asRecord) : [];
};

const mapCategory = (value: unknown): TelemedicineCategory => {
  const raw = asRecord(value);
  return {
    id: String(raw.id ?? ""),
    key: String(raw.key ?? ""),
    name: String(raw.name ?? ""),
    description: raw.description == null ? null : String(raw.description),
    status: String(raw.status ?? "active"),
    displayOrder: Number(raw.display_order ?? 0)
  };
};

const mapSubcategory = (value: unknown): TelemedicineSubcategory => {
  const raw = asRecord(value);
  return {
    id: String(raw.id ?? ""),
    categoryId: String(raw.category_id ?? ""),
    key: String(raw.key ?? ""),
    name: String(raw.name ?? ""),
    description: raw.description == null ? null : String(raw.description),
    status: String(raw.status ?? "active"),
    displayOrder: Number(raw.display_order ?? 0),
    category: raw.category ? mapCategory(raw.category) : null
  };
};

const mapService = (value: unknown): TelemedicineCatalogService => {
  const raw = asRecord(value);
  return {
    id: String(raw.id ?? ""),
    subcategoryId: String(raw.subcategory_id ?? ""),
    key: String(raw.key ?? ""),
    name: String(raw.name ?? ""),
    description: raw.description == null ? null : String(raw.description),
    basePriceCents: Number(raw.base_price_cents ?? 0),
    currency: String(raw.currency ?? "KES"),
    defaultEstimateMinutes: Number(raw.default_estimate_minutes ?? 0),
    isEmergencyCapable: Boolean(raw.is_emergency_capable),
    status: String(raw.status ?? "active"),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    subcategory: raw.subcategory ? mapSubcategory(raw.subcategory) : null
  };
};

export const fetchTelemedicineCategories = async (): Promise<TelemedicineCategory[]> => {
  const response = await api.get("/telemedicine/catalog/categories");
  return dataRows(response.data).map(mapCategory).filter((item) => item.id && item.status === "active");
};

export const fetchTelemedicineSubcategories = async (
  categoryId?: string
): Promise<TelemedicineSubcategory[]> => {
  const response = await api.get("/telemedicine/catalog/subcategories", {
    params: categoryId ? { category_id: categoryId } : undefined
  });
  return dataRows(response.data).map(mapSubcategory).filter((item) => item.id && item.status === "active");
};

export const fetchTelemedicineCatalogServices = async (
  subcategoryId?: string
): Promise<TelemedicineCatalogService[]> => {
  if (!subcategoryId) return [];
  const response = await api.get("/telemedicine/catalog/services", {
    params: { subcategory_id: subcategoryId }
  });
  return dataRows(response.data).map(mapService).filter((item) => item.id && item.status === "active");
};
