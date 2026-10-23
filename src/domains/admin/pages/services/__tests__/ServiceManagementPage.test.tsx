import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/libs/api", () => ({ api: { get: vi.fn(async () => ({ data: { data: [{}, {}] } })) } }));
vi.mock("../CatalogPage", () => ({ ServiceCatalogPanel: ({ kind }: { kind: string }) => <div>categories of {kind}</div> }));
vi.mock("../ServiceListPage", () => ({ ServiceListPanel: ({ kind }: { kind: string }) => <div>services of {kind}</div> }));
vi.mock("../RequestsPage", () => ({ ServiceRequestsPanel: () => <div>service requests</div> }));
vi.mock("../TelemedicineCatalogPage", () => ({ default: () => <div>telemedicine catalogue</div> }));

import ServiceManagementPage from "../ServiceManagementPage";

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ServiceManagementPage />
    </QueryClientProvider>
  );

describe("admin service workspace", () => {
  it("starts on home-based care and offers the three kinds side by side", () => {
    renderPage();

    const kinds = screen.getByRole("radiogroup", { name: "Kind of care" });
    expect(kinds).toHaveTextContent("Home-based care");
    expect(kinds).toHaveTextContent("Ambulance");
    expect(kinds).toHaveTextContent("Telemedicine");
    expect(screen.getByRole("radio", { name: /Home-based care/ })).toBeChecked();
    expect(screen.getByText("categories of home_based")).toBeInTheDocument();
  });

  it("shows only that kind's categories and services when a kind is chosen", () => {
    renderPage();

    fireEvent.click(screen.getByRole("radio", { name: /Ambulance/ }));
    expect(screen.getByText("categories of ambulance")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Services" }));
    expect(screen.getByText("services of ambulance")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Requests" })).not.toBeInTheDocument();
  });

  it("keeps service requests with home-based care only", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Requests" }));

    expect(screen.getByText("service requests")).toBeInTheDocument();
  });

  it("opens the existing telemedicine catalogue for Telemedicine, with no second set of tabs", () => {
    renderPage();

    fireEvent.click(screen.getByRole("radio", { name: /Telemedicine/ }));

    expect(screen.getByText("telemedicine catalogue")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
