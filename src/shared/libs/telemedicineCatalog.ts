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

export type TelemedicineCategoryInput = {
  key: string;
  name: string;
  description?: string | null;
  displayOrder?: number;
  status?: string;
};

export type TelemedicineSubcategoryInput = TelemedicineCategoryInput & {
  categoryId: string;
};

export type TelemedicineCatalogServiceInput = {
  key: string;
  name: string;
  description?: string | null;
  basePriceCents: number;
  currency?: string;
  defaultEstimateMinutes: number;
  isEmergencyCapable?: boolean;
  status?: string;
  tags?: string[];
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === "object" ? (value as Record<string, any>) : {};

const dataRows = (value: unknown): Record<string, any>[] => {
  const payload = asRecord(value);
  return Array.isArray(payload.data) ? payload.data.map(asRecord) : [];
};

export const mapTelemedicineCategory = (value: unknown): TelemedicineCategory => {
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

export const mapTelemedicineSubcategory = (value: unknown): TelemedicineSubcategory => {
  const raw = asRecord(value);
  return {
    id: String(raw.id ?? ""),
    categoryId: String(raw.category_id ?? ""),
    key: String(raw.key ?? ""),
    name: String(raw.name ?? ""),
    description: raw.description == null ? null : String(raw.description),
    status: String(raw.status ?? "active"),
    displayOrder: Number(raw.display_order ?? 0),
    category: raw.category ? mapTelemedicineCategory(raw.category) : null
  };
};

export const mapTelemedicineCatalogService = (value: unknown): TelemedicineCatalogService => {
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
  return dataRows(response.data).map(mapTelemedicineCategory).filter((item) => item.id && item.status === "active");
};

export const fetchTelemedicineSubcategories = async (
  categoryId?: string
): Promise<TelemedicineSubcategory[]> => {
  const response = await api.get("/telemedicine/catalog/subcategories", {
    params: categoryId ? { category_id: categoryId } : undefined
  });
  return dataRows(response.data).map(mapTelemedicineSubcategory).filter((item) => item.id && item.status === "active");
};

export const fetchTelemedicineCatalogServices = async (
  subcategoryId?: string
): Promise<TelemedicineCatalogService[]> => {
  if (!subcategoryId) return [];
  const response = await api.get("/telemedicine/catalog/services", {
    params: { subcategory_id: subcategoryId }
  });
  return dataRows(response.data).map(mapTelemedicineCatalogService).filter((item) => item.id && item.status === "active");
};

const mapAll = <T>(value: unknown, mapper: (row: unknown) => T): T[] =>
  dataRows(value).map(mapper);

export const fetchTelemedicineAdminCategories = async (): Promise<TelemedicineCategory[]> => {
  const response = await api.get("/telemedicine/catalog/categories");
  return mapAll(response.data, mapTelemedicineCategory).filter((item) => item.id);
};

export const fetchTelemedicineAdminSubcategories = async (
  categoryId?: string
): Promise<TelemedicineSubcategory[]> => {
  const response = await api.get("/telemedicine/catalog/subcategories", {
    params: categoryId ? { category_id: categoryId } : undefined
  });
  return mapAll(response.data, mapTelemedicineSubcategory).filter((item) => item.id);
};

export const fetchTelemedicineAdminServices = async (
  subcategoryId?: string
): Promise<TelemedicineCatalogService[]> => {
  if (!subcategoryId) return [];
  const response = await api.get("/telemedicine/catalog/services", {
    params: { subcategory_id: subcategoryId }
  });
  return mapAll(response.data, mapTelemedicineCatalogService).filter((item) => item.id);
};

export const createTelemedicineCategory = async (input: TelemedicineCategoryInput) => {
  const response = await api.post("/telemedicine/catalog/categories", {
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    display_order: input.displayOrder ?? 0,
    status: input.status ?? "active"
  });
  return mapTelemedicineCategory(asRecord(response.data).data);
};

export const updateTelemedicineCategory = async (id: string, input: Partial<TelemedicineCategoryInput>) => {
  const response = await api.patch(`/telemedicine/catalog/categories/${id}`, {
    ...(input.key === undefined ? {} : { key: input.key }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.displayOrder === undefined ? {} : { display_order: input.displayOrder }),
    ...(input.status === undefined ? {} : { status: input.status })
  });
  return mapTelemedicineCategory(asRecord(response.data).data);
};

export const createTelemedicineSubcategory = async (input: TelemedicineSubcategoryInput) => {
  const response = await api.post(`/telemedicine/catalog/categories/${input.categoryId}/subcategories`, {
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    display_order: input.displayOrder ?? 0,
    status: input.status ?? "active"
  });
  return mapTelemedicineSubcategory(asRecord(response.data).data);
};

export const updateTelemedicineSubcategory = async (id: string, input: Partial<Omit<TelemedicineSubcategoryInput, "categoryId">>) => {
  const response = await api.patch(`/telemedicine/catalog/subcategories/${id}`, {
    ...(input.key === undefined ? {} : { key: input.key }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.displayOrder === undefined ? {} : { display_order: input.displayOrder }),
    ...(input.status === undefined ? {} : { status: input.status })
  });
  return mapTelemedicineSubcategory(asRecord(response.data).data);
};

export const createTelemedicineCatalogService = async (
  subcategoryId: string,
  input: TelemedicineCatalogServiceInput
) => {
  const response = await api.post(`/telemedicine/catalog/subcategories/${subcategoryId}/services`, {
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    base_price_cents: input.basePriceCents,
    currency: input.currency ?? "KES",
    default_estimate_minutes: input.defaultEstimateMinutes,
    is_emergency_capable: input.isEmergencyCapable ?? false,
    status: input.status ?? "active",
    tags: input.tags ?? []
  });
  return mapTelemedicineCatalogService(asRecord(response.data).data);
};

export const updateTelemedicineCatalogService = async (
  id: string,
  input: Partial<TelemedicineCatalogServiceInput>
) => {
  const response = await api.patch(`/telemedicine/catalog/services/${id}`, {
    ...(input.key === undefined ? {} : { key: input.key }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.basePriceCents === undefined ? {} : { base_price_cents: input.basePriceCents }),
    ...(input.currency === undefined ? {} : { currency: input.currency }),
    ...(input.defaultEstimateMinutes === undefined ? {} : { default_estimate_minutes: input.defaultEstimateMinutes }),
    ...(input.isEmergencyCapable === undefined ? {} : { is_emergency_capable: input.isEmergencyCapable }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.tags === undefined ? {} : { tags: input.tags })
  });
  return mapTelemedicineCatalogService(asRecord(response.data).data);
};
