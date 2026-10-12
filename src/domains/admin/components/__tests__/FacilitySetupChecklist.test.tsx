import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { facilitySetupChecklist } from "../../../../shared/utils/telemedicineReadiness";
import { FacilitySetupChecklist } from "../FacilitySetupChecklist";

const ready = {
  verified: true,
  telemedicineEnabled: true,
  user: { status: "active" },
  telemedicineSubcategoryAssignments: [{ subcategoryId: "s1", status: "active" }],
  availability: [{ deliveryMode: "both" }]
} as never;

const build = (over: Record<string, unknown> = {}) =>
  facilitySetupChecklist({
    facility: { status: "active", countryCode: "KE" } as never,
    facilityServices: [{ active: true, deliveryMode: "remote", serviceId: "svc1" }] as never,
    catalogServices: [{ id: "svc1", subcategoryId: "s1" }],
    providers: [ready],
    selectableSubcategoryIds: new Set(["s1"]),
    ...over
  });

const renderChecklist = (result = build(), onOpenTab = vi.fn()) => {
  render(<FacilitySetupChecklist steps={result.steps} firstMissing={result.firstMissing} onOpenTab={onOpenTab} />);
  return onOpenTab;
};

describe("FacilitySetupChecklist", () => {
  it("says the facility is ready when every step is done, with no action button", () => {
    renderChecklist();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText(/Clients can find this facility/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Telemedicine setup steps" })).getAllByRole("listitem")).toHaveLength(6);
  });

  it("shows progress and points at the first missing step with a way to fix it", async () => {
    const user = userEvent.setup();
    const onOpenTab = renderChecklist(build({ facilityServices: [{ active: true, deliveryMode: "in_person", serviceId: "x" }] }));

    expect(screen.getByText("4 of 6 done")).toBeInTheDocument();
    expect(screen.getByText(/Clients cannot book telemedicine here/)).toBeInTheDocument();
    expect(screen.getByText("No telemedicine services.")).toBeInTheDocument();
    expect(screen.getByText(/Clients can only book services listed as remote/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to Services" }));
    expect(onOpenTab).toHaveBeenCalledWith("services");
  });

  it("sends provider problems to the Providers tab", async () => {
    const user = userEvent.setup();
    const onOpenTab = renderChecklist(build({ providers: [] }));
    await user.click(screen.getByRole("button", { name: "Go to Providers" }));
    expect(onOpenTab).toHaveBeenCalledWith("operations");
  });

  it("offers no button for a step fixed on the profile, but still says what to do", () => {
    renderChecklist(build({ facility: { status: "suspended", countryCode: "KE" } }));
    expect(screen.getByText("Facility is suspended.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("states done, next and not-done in text, not only with the symbol", () => {
    renderChecklist(build({ providers: [] }));
    expect(screen.getByText(", next step")).toBeInTheDocument();
    expect(screen.getAllByText(", done").length).toBeGreaterThan(0);
    expect(screen.getAllByText(", not done").length).toBeGreaterThan(0);
  });
});
