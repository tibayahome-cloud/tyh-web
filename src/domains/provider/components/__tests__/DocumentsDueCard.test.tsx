import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mapOnboardingSummary } from "../../utils/onboardingStatus";

const state = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock("../../hooks/useOnboardingStatus", () => ({ useOnboardingStatus: () => ({ data: state.data }) }));

import { DocumentsDueCard } from "../DocumentsDueCard";

const renderCard = () =>
  render(
    <MemoryRouter>
      <DocumentsDueCard />
    </MemoryRouter>
  );

beforeEach(() => {
  state.data = undefined;
});

describe("DocumentsDueCard", () => {
  it("says nothing while the status is loading or when documents are in order", () => {
    renderCard();
    expect(screen.queryByRole("region", { name: "Documents due" })).not.toBeInTheDocument();

    state.data = mapOnboardingSummary({ status: "verified", documents_in_order: true });
    renderCard();
    expect(screen.queryByRole("region", { name: "Documents due" })).not.toBeInTheDocument();
  });

  it("says nothing to a provider no date applies to", () => {
    state.data = mapOnboardingSummary({ status: "not_started", documents_in_order: false, documents_days_left: null });
    renderCard();
    expect(screen.queryByRole("region", { name: "Documents due" })).not.toBeInTheDocument();
  });

  it("tells a working provider how long they have and links to where to add them", () => {
    state.data = mapOnboardingSummary({
      status: "set_up_by_facility",
      documents_in_order: false,
      documents_days_left: 20,
      required_total: 4,
      items: [{ label: "National ID", status: "pending", required: true }]
    });
    renderCard();

    expect(screen.getByRole("heading", { name: "Add your documents in 20 days" })).toBeInTheDocument();
    expect(screen.getByText(/1 of 4 required documents are in/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add documents" })).toHaveAttribute("href", "/pro/onboarding");
  });

  it("says tomorrow when there is one day left", () => {
    state.data = mapOnboardingSummary({ status: "verified", documents_in_order: false, documents_days_left: 1, required_total: 4 });
    renderCard();
    expect(screen.getByRole("heading", { name: "Add your documents tomorrow" })).toBeInTheDocument();
  });
});
