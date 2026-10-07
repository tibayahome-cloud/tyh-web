import { getApiError } from "./errors";

export type StaleSubcategory = { id: string; name: string };

type AssignmentLike = { subcategoryId: string; subcategory?: { name?: string | null } | null };

// Selections the provider form still holds that can no longer be assigned: the specialty was
// archived or its category was. They come from the provider's existing assignments, which the
// API keeps as history, so they are named here rather than silently dropped or re-sent.
export const findStaleSubcategories = (
  selectedIds: string[],
  selectable: Array<{ id: string }>,
  assignments: AssignmentLike[]
): StaleSubcategory[] => {
  const selectableIds = new Set(selectable.map((item) => item.id));
  return selectedIds
    .filter((id) => !selectableIds.has(id))
    .map((id) => ({
      id,
      name: assignments.find((assignment) => assignment.subcategoryId === id)?.subcategory?.name || "A specialty that is no longer available"
    }));
};

// The API answers a payload with an archived or deleted subcategory with a 400 whose message
// says every subcategory must be active; it does not say which one.
export const isInactiveSubcategoryError = (error: unknown): boolean =>
  /subcategor/i.test(getApiError(error, "")) && /must be active|not active|inactive|archived/i.test(getApiError(error, ""));

export const describeProviderSaveError = (error: unknown, fallback = "Unable to save provider"): string =>
  isInactiveSubcategoryError(error)
    ? "One of the selected telemedicine specialties was archived since this form was opened. Reload the list, remove any archived specialty, and save again."
    : getApiError(error, fallback);
