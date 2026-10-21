export type AdminServiceCategory = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  /** From the API: true for the category that holds video consultations (managed in the Telemedicine catalog). */
  is_system?: boolean;
  /** From the API: which kind of care the category belongs to. */
  care_type?: "telemedicine" | "home_based" | "ambulance";
};

export const TELEMEDICINE_CATEGORY_NOTE = "Used by video consultations. Manage them in Telemedicine.";

/** The categories a home-care service may be put in: never the Telemedicine one, unless the service is already in it. */
export const selectableCategories = (categories: AdminServiceCategory[] | undefined, currentId?: string): AdminServiceCategory[] =>
  (categories ?? []).filter((category) => !category.is_system || category.id === currentId);

/** What the Description column shows: the note for the Telemedicine category, a dash when there is none. */
export const categoryDescription = (category: AdminServiceCategory): string =>
  category.is_system ? TELEMEDICINE_CATEGORY_NOTE : category.description || "—";

/** The kinds of care the catalogue is managed by. Telemedicine has its own tab. */
export type ManagedKind = "home_based" | "ambulance";

export const KIND_LABEL: Record<ManagedKind | "telemedicine", string> = {
  home_based: "Home-based care",
  ambulance: "Ambulance",
  telemedicine: "Telemedicine"
};

/** Categories of one kind. A category the API has not typed yet counts as home based, as the services do. */
export const categoriesOfKind = (categories: AdminServiceCategory[] | undefined, kind: ManagedKind): AdminServiceCategory[] =>
  (categories ?? []).filter((category) => !category.is_system && (category.care_type ?? "home_based") === kind);

export const AMBULANCE_CATEGORY = { key: "ambulance", name: "Ambulance" } as const;
