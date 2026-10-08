import { describe, expect, it } from "vitest";

import {
  mapTelemedicineCategory,
  mapTelemedicineSubcategory,
  selectableTelemedicineSubcategories
} from "../telemedicineCatalog";

const category = (id: string, status = "active") =>
  mapTelemedicineCategory({ id, key: id, name: `Category ${id}`, status, display_order: 1 });
const subcategory = (id: string, categoryId: string, status = "active") =>
  mapTelemedicineSubcategory({ id, category_id: categoryId, key: id, name: `Specialty ${id}`, status, display_order: 1 });

describe("selectableTelemedicineSubcategories", () => {
  it("keeps active specialties under active categories and attaches their category", () => {
    const result = selectableTelemedicineSubcategories([subcategory("s1", "c1")], [category("c1")]);
    expect(result).toHaveLength(1);
    expect(result[0].category?.name).toBe("Category c1");
  });

  it.each(["archived", "suspended"])("never offers a %s specialty", (status) => {
    expect(selectableTelemedicineSubcategories([subcategory("s1", "c1", status)], [category("c1")])).toEqual([]);
  });

  it("never offers an active specialty whose category is archived or unknown", () => {
    const subs = [subcategory("s1", "c-archived"), subcategory("s2", "c-missing")];
    expect(selectableTelemedicineSubcategories(subs, [category("c-archived", "archived")])).toEqual([]);
  });

  it("filters seven archived legacy specialties out of a mixed list without changing the rest", () => {
    const archived = Array.from({ length: 7 }, (_, index) => subcategory(`old-${index}`, "c1", "archived"));
    const live = [subcategory("a", "c1"), subcategory("b", "c2")];
    const result = selectableTelemedicineSubcategories([...archived, ...live], [category("c1"), category("c2")]);
    expect(result.map((item) => item.id)).toEqual(["a", "b"]);
    // The input is untouched: nothing is reactivated or removed from the catalogue.
    expect(archived.every((item) => item.status === "archived")).toBe(true);
  });
});
