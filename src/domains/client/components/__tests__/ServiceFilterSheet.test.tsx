import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ServiceFilterSheet } from "../ServiceFilterSheet";
import { NO_FILTERS, groupTiles, type CatalogService } from "../../utils/serviceCatalog";

const svc = (id: string, category: string, extra: Partial<CatalogService> = {}): CatalogService => ({
  id,
  key: id,
  name: `Service ${id}`,
  description: null,
  base_price_cents: 150000,
  default_estimate_minutes: 30,
  is_emergency_capable: false,
  active: true,
  remote_capable: false,
  category: { id: category, name: category },
  ...extra
});

const services = [
  svc("a", "Nursing & Caregiver Services"),
  svc("b", "Nursing & Caregiver Services", { is_emergency_capable: true, base_price_cents: 600000 }),
  svc("c", "Therapy & Rehabilitation")
];

const renderSheet = (onApply = vi.fn()) => {
  render(
    <ServiceFilterSheet
      open
      onClose={vi.fn()}
      filters={NO_FILTERS}
      onApply={onApply}
      groups={groupTiles(services)}
      services={services}
      imageForGroup={() => "/g.png"}
      allImage="/all.png"
    />
  );
  return onApply;
};

describe("ServiceFilterSheet", () => {
  it("lists every kind of care with its count, all visible in one place", () => {
    renderSheet();

    const group = screen.getByRole("radiogroup", { name: "Kind of care" });
    expect(group).toHaveTextContent("All kinds of care");
    expect(group).toHaveTextContent("Nursing & doctor visits");
    expect(group).toHaveTextContent("Therapy & rehabilitation");
    expect(screen.getByRole("radio", { name: /All kinds of care/ })).toBeChecked();
  });

  it("says how many services applying will show, and updates as choices change", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: "Show 3 services" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Nursing & doctor visits/ }));
    expect(screen.getByRole("button", { name: "Show 2 services" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: /Urgent care only/ }));
    expect(screen.getByRole("button", { name: "Show 1 service" })).toBeInTheDocument();
  });

  it("will not apply a choice that leaves nothing to show", () => {
    renderSheet();

    fireEvent.click(screen.getByRole("radio", { name: /Therapy & rehabilitation/ }));
    fireEvent.click(screen.getByRole("switch", { name: /Urgent care only/ }));

    expect(screen.getByRole("button", { name: "No services match" })).toBeDisabled();
  });

  it("applies the chosen filters only when asked", () => {
    const onApply = renderSheet();

    fireEvent.click(screen.getByRole("radio", { name: "Over KES 5,000" }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Show/ }));

    expect(onApply).toHaveBeenCalledWith({ ...NO_FILTERS, priceBand: "high" });
  });

  it("clears every choice", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: /Nursing & doctor visits/ }));

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.getByRole("radio", { name: /All kinds of care/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Any price" })).toBeChecked();
  });
});
