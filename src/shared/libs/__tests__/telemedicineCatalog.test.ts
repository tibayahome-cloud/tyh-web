import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn()
}));

vi.mock("../api", () => ({
  __esModule: true,
  default: { get: mockGet, post: mockPost, patch: mockPatch }
}));

import {
  createTelemedicineCategory,
  createTelemedicineCatalogService,
  createTelemedicineSubcategory,
  fetchTelemedicineCatalogServices,
  fetchTelemedicineAdminCategories,
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

  it("loads all active services when no subcategory is selected", async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [{ id: "s1", subcategory_id: "sc1", key: "consult", name: "Consultation", status: "active" }] }
    });

    await expect(fetchTelemedicineCatalogServices()).resolves.toEqual([
      expect.objectContaining({ id: "s1", subcategoryId: "sc1" })
    ]);
    expect(mockGet).toHaveBeenCalledWith("/telemedicine/catalog/services", { params: undefined });
  });

  it("preserves inactive entries for admin catalog management", async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [{ id: "c1", key: "medical", name: "Medical", status: "suspended" }] }
    });

    await expect(fetchTelemedicineAdminCategories()).resolves.toEqual([
      expect.objectContaining({ id: "c1", status: "suspended" })
    ]);
  });

  it("uses nested taxonomy endpoints for admin writes", async () => {
    mockGet.mockResolvedValue({ data: { data: {} } });
    mockGet.mockResolvedValueOnce({ data: { data: {} } });
    mockPost
      .mockResolvedValueOnce({ data: { data: { id: "c1", key: "medical", name: "Medical", status: "active" } } })
      .mockResolvedValueOnce({ data: { data: { id: "sc1", category_id: "c1", key: "oncology", name: "Oncology", status: "active" } } })
      .mockResolvedValueOnce({ data: { data: { id: "s1", subcategory_id: "sc1", key: "consult", name: "Consultation", status: "active" } } });

    await createTelemedicineCategory({ key: "medical", name: "Medical" });
    await createTelemedicineSubcategory({ categoryId: "c1", key: "oncology", name: "Oncology" });
    await createTelemedicineCatalogService("sc1", {
      key: "consult",
      name: "Consultation",
      basePriceCents: 250000,
      defaultEstimateMinutes: 30
    });

    expect(mockPost).toHaveBeenNthCalledWith(1, "/telemedicine/catalog/categories", expect.objectContaining({ key: "medical" }));
    expect(mockPost).toHaveBeenNthCalledWith(2, "/telemedicine/catalog/categories/c1/subcategories", expect.objectContaining({ key: "oncology" }));
    expect(mockPost).toHaveBeenNthCalledWith(3, "/telemedicine/catalog/subcategories/sc1/services", expect.objectContaining({ base_price_cents: 250000 }));
  });
});
