/** The facility admin's own checklist page: it finds the facility they manage and shows its documents. */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ scope: {} as Record<string, unknown> }));
vi.mock("../../finance/paymentAccess", () => ({ useAdminFacilityScope: () => state.scope }));
vi.mock("../FacilityDocumentsPanel", () => ({
  FacilityDocumentsPanel: ({ facilityId, mode }: { facilityId: string; mode: string }) => <p>panel for {facilityId} as {mode}</p>
}));

import { OurDocumentsPage } from "../OurDocumentsPage";

beforeEach(() => {
  state.scope = { isLoading: false, facility: { id: "f1", name: "Example Clinic" }, hasInvalidScope: false };
});

describe("Our documents", () => {
  it("shows the checklist for the facility the admin manages", () => {
    render(<OurDocumentsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Our documents" })).toBeInTheDocument();
    expect(screen.getByText("panel for f1 as facility_admin")).toBeInTheDocument();
    expect(screen.getByText(/What Example Clinic shows to prove it is legitimate/)).toBeInTheDocument();
  });

  it("waits while the facility is being found", () => {
    state.scope = { isLoading: true, facility: null, hasInvalidScope: false };
    render(<OurDocumentsPage />);

    expect(screen.getByLabelText("Loading documents")).toBeInTheDocument();
    expect(screen.queryByText(/panel for/)).not.toBeInTheDocument();
  });

  it("explains itself when no single facility can be found", () => {
    state.scope = { isLoading: false, facility: null, hasInvalidScope: true };
    render(<OurDocumentsPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("We could not tell which facility you manage");
  });
});
