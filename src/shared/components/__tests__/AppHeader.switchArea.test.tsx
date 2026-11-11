/**
 * Someone who is both a facility admin and a provider needs a way from one area to the other. It is one item at the top of the
 * user menu, "Switch to ...", and it is there only when the person's roles open another area. Everyone else sees the menu they
 * always saw.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { OpenArea } from "../../rbac/portalRoles";
import type { AuthUser } from "../../schemas/user";

vi.mock("../NotificationCenter", () => ({ NotificationCenter: () => null }));

import { AppHeader } from "../AppHeader";

const USER = { id: "u1", fullName: "Dr Jane Both", email: "jane@example.com" } as unknown as AuthUser;
const PROVIDER_AREA: OpenArea = { key: "provider", label: "provider area", path: "/pro/home" };
const ADMIN_AREA: OpenArea = { key: "admin", label: "facility admin area", path: "/admin/facility" };

const renderHeader = (props: { otherAreas?: OpenArea[]; onSwitchArea?: (area: OpenArea) => void } = {}) =>
  render(<AppHeader user={USER} onLogout={vi.fn()} {...props} />);

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Dr Jane Both|JB/ }));
};

describe("the user menu", () => {
  it("offers no switch to someone whose roles open one area", async () => {
    const user = userEvent.setup();
    renderHeader();
    await openMenu(user);

    expect(screen.queryByRole("button", { name: /Switch to/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("offers the other area to someone whose roles open two", async () => {
    const user = userEvent.setup();
    renderHeader({ otherAreas: [PROVIDER_AREA] });
    await openMenu(user);

    expect(screen.getByRole("button", { name: "Switch to provider area" })).toBeInTheDocument();
  });

  it("lists every other area when there are more than one", async () => {
    const user = userEvent.setup();
    renderHeader({ otherAreas: [ADMIN_AREA, PROVIDER_AREA] });
    await openMenu(user);

    expect(screen.getAllByRole("button", { name: /^Switch to / }).map((button) => button.textContent)).toEqual([
      "Switch to facility admin area",
      "Switch to provider area"
    ]);
  });

  it("goes to the area chosen and closes the menu", async () => {
    const user = userEvent.setup();
    const onSwitchArea = vi.fn();
    renderHeader({ otherAreas: [PROVIDER_AREA], onSwitchArea });
    await openMenu(user);

    await user.click(screen.getByRole("button", { name: "Switch to provider area" }));

    expect(onSwitchArea).toHaveBeenCalledWith(PROVIDER_AREA);
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("puts the switch above Profile, apart from the account items, and keeps it a touch-sized target", async () => {
    const user = userEvent.setup();
    renderHeader({ otherAreas: [PROVIDER_AREA] });
    await openMenu(user);

    const buttons = screen.getAllByRole("button").map((button) => button.textContent?.trim());
    expect(buttons.indexOf("Switch to provider area")).toBeLessThan(buttons.indexOf("Profile"));
    expect(screen.getByRole("navigation", { name: "Switch area" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to provider area" })).toHaveClass("min-h-11");
  });
});
