import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppBottomNav } from "../AppBottomNav";
import { AppSidebar, type NavItem } from "../AppSidebar";
import { mapAttentionItem } from "../../libs/telemedicineOps";

const items: NavItem[] = [
  { label: "Home", to: "/app/home", icon: <span /> },
  { label: "Telemedicine", to: "/app/telemedicine", icon: <span />, attention: true },
  { label: "Inbox", to: "/app/inbox", icon: <span />, badge: 3 }
];

describe("navigation attention dot", () => {
  it("marks only the item that needs an answer, with text for screen readers", () => {
    render(
      <MemoryRouter>
        <AppBottomNav items={items} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: /Telemedicine/ })).toHaveTextContent("Needs your response");
    expect(screen.getByRole("link", { name: /Home/ })).not.toHaveTextContent("Needs your response");
    // A count stays a count.
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveTextContent("3");
  });

  it("does the same in the sidebar", () => {
    render(
      <MemoryRouter>
        <AppSidebar items={items} collapsed={false} onToggle={() => undefined} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: /Telemedicine/ })).toHaveTextContent("Needs your response");
    expect(screen.getByRole("link", { name: /Home/ })).not.toHaveTextContent("Needs your response");
  });
});

describe("mapAttentionItem", () => {
  it("maps the API's item", () => {
    expect(
      mapAttentionItem({ kind: "rebooking_offer", id: "o1", booking_id: "b1", proposed_start_at: "x", expires_at: "y", service_name: "S", from_name: "F", role: "client" })
    ).toMatchObject({ kind: "rebooking_offer", id: "o1", bookingId: "b1", expiresAt: "y", serviceName: "S", fromName: "F", role: "client" });
  });

  it("drops anything without a kind, id and booking", () => {
    expect(mapAttentionItem({ kind: "other", id: "1", booking_id: "b" })).toBeNull();
    expect(mapAttentionItem({ kind: "reschedule_request", id: "1" })).toBeNull();
    expect(mapAttentionItem(null)).toBeNull();
  });
});
