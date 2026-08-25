import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("../api", () => ({
  __esModule: true,
  default: { get: mockGet }
}));

import {
  fetchTelemedicineCatalogServices,
  fetchTelemedicineCategories,
  fetchTelemedicineSubcategories
} from "../telemedicineCatalog";

describe("telemedicine catalog client", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads active categories and ignores archived categories", async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [{ id: "c1", key: "medical", name: "Medical", status: "active", display_order: 1 }, { id: "c2", status: "archived" }] }
    });

    await expect(fetchTelemedicineCategories()).resolves.toEqual([
      expect.objectContaining({ id: "c1", name: "Medical", displayOrder: 1 })
    ]);
    expect(mockGet).toHaveBeenCalledWith("/telemedicine/catalog/categories");
  });

  it("scopes subcategories and services to the selected parent", async () => {
    mockGet
      .mockResolvedValueOnce({ data: { data: [{ id: "sc1", category_id: "c1", key: "oncology", name: "Oncology", status: "active" }] } })
      .mockResolvedValueOnce({ data: { data: [{ id: "s1", subcategory_id: "sc1", key: "consult", name: "Consultation", status: "active", tags: ["remote"] }] } });

    await fetchTelemedicineSubcategories("c1");
    await fetchTelemedicineCatalogServices("sc1");

    expect(mockGet).toHaveBeenNthCalledWith(1, "/telemedicine/catalog/subcategories", { params: { category_id: "c1" } });
    expect(mockGet).toHaveBeenNthCalledWith(2, "/telemedicine/catalog/services", { params: { subcategory_id: "sc1" } });
  });

  it("does not request services without a selected subcategory", async () => {
    await expect(fetchTelemedicineCatalogServices()).resolves.toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
