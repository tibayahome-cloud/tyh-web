import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { KpiCard } from "../KpiCard";

const renderCard = (props: Partial<React.ComponentProps<typeof KpiCard>> = {}) =>
  render(
    <MemoryRouter>
      <KpiCard label="Available to withdraw" value="KES 1,200.00" {...props} />
    </MemoryRouter>
  );

describe("KpiCard", () => {
  it("names the number, shows it, and says what it covers", () => {
    renderCard({ caption: "In your wallet now" });
    const card = screen.getByRole("group", { name: "Available to withdraw" });
    expect(within(card).getByText("KES 1,200.00")).toBeInTheDocument();
    expect(within(card).getByText("In your wallet now")).toBeInTheDocument();
  });

  it("offers the one next step as a link", () => {
    renderCard({ action: { label: "Withdraw", to: "/pro/payments" } });
    expect(screen.getByRole("link", { name: "Withdraw" })).toHaveAttribute("href", "/pro/payments");
  });

  it("shows supporting figures under the main number, and nothing extra when there are none", () => {
    const { unmount } = renderCard({ children: <p>Pending: KES 50.00</p> });
    expect(screen.getByText("Pending: KES 50.00")).toBeInTheDocument();
    unmount();
    renderCard();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
