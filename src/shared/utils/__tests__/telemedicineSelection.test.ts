import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { describeProviderSaveError, findStaleSubcategories, isInactiveSubcategoryError } from "../telemedicineSelection";

const httpError = (message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { error: { code: 400, name: "BadRequest", message } }
  });

describe("findStaleSubcategories", () => {
  const selectable = [{ id: "live" }];
  const assignments = [
    { subcategoryId: "old", subcategory: { name: "Legacy dermatology" } },
    { subcategoryId: "live", subcategory: { name: "Dermatology" } }
  ];

  it("names selections that are no longer selectable, from the provider's own assignments", () => {
    expect(findStaleSubcategories(["live", "old"], selectable, assignments)).toEqual([{ id: "old", name: "Legacy dermatology" }]);
  });

  it("falls back to a generic name when the assignment carries none", () => {
    expect(findStaleSubcategories(["gone"], selectable, [])).toEqual([
      { id: "gone", name: "A specialty that is no longer available" }
    ]);
  });

  it("finds nothing when every selection is selectable", () => {
    expect(findStaleSubcategories(["live"], selectable, assignments)).toEqual([]);
  });
});

describe("describeProviderSaveError", () => {
  it("recognises the API's archived-subcategory rejection and explains it specifically", () => {
    const error = httpError("Every telemedicine subcategory must be active");
    expect(isInactiveSubcategoryError(error)).toBe(true);
    expect(describeProviderSaveError(error)).toMatch(/archived since this form was opened/i);
  });

  it("shows the specialties the API names when it says which are inactive", () => {
    const error = httpError("These telemedicine specialties are inactive or unavailable: Cardiology / Legacy heart care");
    expect(isInactiveSubcategoryError(error)).toBe(true);
    expect(describeProviderSaveError(error)).toBe(
      "These telemedicine specialties are inactive or unavailable: Cardiology / Legacy heart care. Remove them and save again."
    );
  });

  it("leaves unrelated server messages unchanged", () => {
    const error = httpError("email already in use");
    expect(isInactiveSubcategoryError(error)).toBe(false);
    expect(describeProviderSaveError(error)).toBe("email already in use");
  });
});
