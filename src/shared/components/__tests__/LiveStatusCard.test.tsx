import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LiveStatusCard, type LiveFix } from "../LiveStatusCard";
import type { LiveStatus } from "../../libs/liveStatus";

const live: LiveStatus = { live: true, firstBlocker: null, blockers: [], nextOpenAt: "2026-10-21T07:40:00+00:00", lookaheadDays: 7 };
const blocked: LiveStatus = {
  live: false,
  firstBlocker: { code: "no_remote_services", message: "No video consultation service is switched on.", fix: "facility_services" },
  blockers: [
    { code: "no_remote_services", message: "No video consultation service is switched on.", fix: "facility_services" },
    { code: "facility_not_active", message: "The facility is suspended.", fix: "facility_status" }
  ],
  nextOpenAt: null,
  lookaheadDays: 7
};

const renderCard = (props: Partial<React.ComponentProps<typeof LiveStatusCard>> = {}) => {
  const resolveFix = vi.fn((blocker): LiveFix =>
    blocker.fix === "facility_services" ? { label: "Open services", to: "/services" } : { hint: "Ask a platform admin." }
  );
  render(
    <MemoryRouter>
      <LiveStatusCard
        title="Live for video consultations"
        subject="facility"
        status={live}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        resolveFix={resolveFix}
        {...props}
      />
    </MemoryRouter>
  );
  return resolveFix;
};

describe("LiveStatusCard", () => {
  it("says Live and shows the next free time", () => {
    renderCard();

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText(/Clients can book video consultations with this facility/)).toBeInTheDocument();
    expect(screen.getByText(/Next free time:/)).toBeInTheDocument();
  });

  it("says Not live, lists every blocker, and links the ones that can be fixed", () => {
    renderCard({ status: blocked });

    expect(screen.getByText("Not live")).toBeInTheDocument();
    expect(screen.getByText(/2 things need fixing/)).toBeInTheDocument();
    expect(screen.getByText("No video consultation service is switched on.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open services" })).toHaveAttribute("href", "/services");
    expect(screen.getByText("Ask a platform admin.")).toBeInTheDocument();
  });

  it("runs a button fix when there is no link", () => {
    const onClick = vi.fn();
    renderCard({ status: blocked, resolveFix: () => ({ label: "Open providers", onClick }) });

    fireEvent.click(screen.getAllByRole("button", { name: "Open providers" })[0]);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("names the provider in the wording for a provider", () => {
    renderCard({ subject: "provider", status: blocked });

    expect(screen.getByText(/Clients cannot book video consultations with this provider yet/)).toBeInTheDocument();
  });

  it("shows a loading state, not Live or Not live", () => {
    renderCard({ status: undefined, isLoading: true });

    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.queryByText("Not live")).not.toBeInTheDocument();
  });

  it("shows an error with a retry instead of guessing", () => {
    const onRetry = vi.fn();
    renderCard({ status: undefined, isError: true, onRetry });

    expect(screen.getByRole("alert")).toHaveTextContent("We could not load the live status");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });
});
