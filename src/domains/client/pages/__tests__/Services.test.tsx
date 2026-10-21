import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ services: [] as unknown[] }));
vi.mock("../../../../shared/libs/api", () => ({ api: { get: vi.fn(async () => ({ data: { data: api.services } })) } }));
vi.mock("../../../../shared/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../components/BookingRequestDialog", () => ({
  BookingRequestDialog: ({ open, serviceId }: { open: boolean; serviceId: string | null }) => (open ? <p>booking {serviceId}</p> : null)
}));

import ServicesPage from "../Services";

const svc = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  key: id,
  name,
  description: null,
  base_price_cents: 150000,
  default_estimate_minutes: 30,
  is_emergency_capable: false,
  active: true,
  remote_capable: false,
  category: { id: "c1", name: "Nursing & Caregiver Services" },
  ...extra
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ServicesPage />
      </QueryClientProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  api.services = [svc("a", "Wound dressing"), svc("v", "General consultation", { remote_capable: true }), svc("e", "Ambulance transfer", { is_emergency_capable: true, category: { id: "c2", name: "Ambulance" } })];
});

describe("client Services", () => {
  it("lists care that comes to you, not video consultations, with plain badges and price", async () => {
    renderPage();

    expect(await screen.findByText("Wound dressing")).toBeInTheDocument();
    expect(screen.queryByText("General consultation")).not.toBeInTheDocument();
    expect(screen.getAllByText("Home visit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("KES 1,500").length).toBeGreaterThan(0);
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("offers a tile per kind of care and narrows the list when one is chosen", async () => {
    renderPage();
    await screen.findByText("Wound dressing");

    fireEvent.click(screen.getByRole("button", { name: /Ambulance/ }));

    expect(screen.getByText("Ambulance transfer")).toBeInTheDocument();
    expect(screen.queryByText("Wound dressing")).not.toBeInTheDocument();
  });

  it("opens booking from the Book button", async () => {
    renderPage();
    await screen.findByText("Wound dressing");

    fireEvent.click(screen.getAllByRole("button", { name: "Book" })[0]);

    expect(screen.getByText(/booking /)).toBeInTheDocument();
  });

  it("says when nothing matches and offers to clear", async () => {
    renderPage();
    await screen.findByText("Wound dressing");

    fireEvent.change(screen.getByLabelText("Search services"), { target: { value: "zzzz" } });

    expect(screen.getByText("Nothing matches")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Wound dressing")).toBeInTheDocument();
  });
});
