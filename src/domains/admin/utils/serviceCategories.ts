export type AdminServiceCategory = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  /** From the API: true for the category that holds video consultations (managed in the Telemedicine catalog). */
  is_system?: boolean;
};

export const TELEMEDICINE_CATEGORY_NOTE = "Used by video consultations. Manage them in Telemedicine.";

/** The categories a home-care service may be put in: never the Telemedicine one, unless the service is already in it. */
export const selectableCategories = (categories: AdminServiceCategory[] | undefined, currentId?: string): AdminServiceCategory[] =>
  (categories ?? []).filter((category) => !category.is_system || category.id === currentId);

/** What the Description column shows: the note for the Telemedicine category, a dash when there is none. */
export const categoryDescription = (category: AdminServiceCategory): string =>
  category.is_system ? TELEMEDICINE_CATEGORY_NOTE : category.description || "—";
