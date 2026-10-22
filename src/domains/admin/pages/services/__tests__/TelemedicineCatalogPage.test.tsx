/** The telemedicine catalogue: areas on the left, specialties and services on the right, plain prices, flagged duplicates. */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const row = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, key: id, name, description: null, status: "active", displayOrder: 0, ...extra });

vi.mock("../../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../../../../shared/libs/telemedicineCatalog", () => ({
  fetchTelemedicineAdminCategories: async () => [row("a1", "General Medicine"), row("a2", "Mental Health", { status: "suspended" })],
  fetchTelemedicineAdminSubcategories: async () => [row("s1", "General Practitioner", { categoryId: "a1" }), row("s2", "General practitioner", { categoryId: "a1" })],
  fetchTelemedicineAdminServices: async () => [
    row("v1", "GP video visit", { basePriceCents: 150000, defaultEstimateMinutes: 30, isEmergencyCapable: false, currency: "KES", tags: [] }),
    row("v2", "Urgent review", { basePriceCents: 100, defaultEstimateMinutes: 15, isEmergencyCapable: true, currency: "KES", tags: [] })
  ],
  createTelemedicineCatalogService: vi.fn(), createTelemedicineCategory: vi.fn(), createTelemedicineSubcategory: vi.fn(),
  updateTelemedicineCatalogService: vi.fn(), updateTelemedicineCategory: vi.fn(), updateTelemedicineSubcategory: vi.fn()
}));

import TelemedicineCatalogPage from "../TelemedicineCatalogPage";

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TelemedicineCatalogPage />
    </QueryClientProvider>
  );

describe("telemedicine catalogue", () => {
  it("lists services with plain KES prices and sentence-case status", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: /^General Practitioner \(duplicate name\)/ }));

    const gp = (await screen.findByText("GP video visit")).closest("li") as HTMLElement;
    expect(within(gp).getByText(/KES 1,500 · 30 min/)).toBeInTheDocument();
    expect(within(gp).getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(/KES 1 · 15 min · Emergency capable/)).toBeInTheDocument();
  });

  it("flags specialties that share a name and marks inactive areas", async () => {
    renderPage();
    expect(await screen.findAllByText(/\(duplicate name\)/)).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: "Consultation areas" })).getByText("Suspended")).toBeInTheDocument();
  });

  it("filters areas and services by the search box", async () => {
    renderPage();
    await screen.findByText("General Medicine");
    fireEvent.change(screen.getByLabelText("Search the catalogue"), { target: { value: "mental" } });

    const areas = within(screen.getByRole("region", { name: "Consultation areas" }));
    expect(areas.queryByText("General Medicine")).not.toBeInTheDocument();
    expect(areas.getByText("Mental Health")).toBeInTheDocument();
  });

  it("names each Edit button after the thing it edits", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Edit General Medicine" })).toBeInTheDocument();
  });
});
