import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthPortalSwitch } from "../AuthPortalSwitch";

const renderSwitch = (active: "personal" | "facility") =>
  render(
    <MemoryRouter>
      <AuthPortalSwitch active={active} />
    </MemoryRouter>
  );

describe("AuthPortalSwitch", () => {
  it.each([
    ["personal", "Personal account", "Facility admin"],
    ["facility", "Facility admin", "Personal account"]
  ] as const)("marks only the %s option as the current page", (active, current, other) => {
    renderSwitch(active);

    expect(screen.getByRole("link", { name: current })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: other })).not.toHaveAttribute("aria-current");
  });

  it("offers exactly the two public sign-ins and nothing about system administration", () => {
    const { container } = renderSwitch("personal");

    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(container.querySelector('a[href="/admin/login"]')).toBeNull();
    expect(container.textContent).not.toMatch(/system|super|restricted/i);
  });

  it("uses semantic links with 44px targets and decorative icons", () => {
    const { container } = renderSwitch("facility");

    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-11");
    }
    container.querySelectorAll("svg").forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"));
  });
});
