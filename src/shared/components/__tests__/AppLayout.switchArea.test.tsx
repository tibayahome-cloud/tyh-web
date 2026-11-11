/**
 * The layout works out which other areas to offer from the person's roles and the area they are in, so each area offers the
 * other and never itself, and a person with one role is offered nothing.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: { roles: [] as string[] } }));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", fullName: "Dr Jane Both", email: "jane@example.com", roles: auth.roles },
    logout: vi.fn(),
    isAuthenticated: true
  })
}));
vi.mock("../NotificationCenter", () => ({ NotificationCenter: () => null }));

import { AppLayout } from "../AppLayout";

const Page = ({ name }: { name: string }) => (
  <AppLayout>
    <p>{name}</p>
  </AppLayout>
);
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/facility" element={<Page name="admin page" />} />
        <Route path="/pro/home" element={<Page name="provider page" />} />
        <Route path="/app/home" element={<Page name="patient page" />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Dr Jane Both|JB/ }));
};

describe("switching between the areas a person's roles open", () => {
  beforeEach(() => {
    auth.roles = [];
  });

  it("offers a facility admin who is also a provider the provider area, and takes them there", async () => {
    auth.roles = ["admin.ops", "provider"];
    const user = userEvent.setup();
    renderAt("/admin/facility");
    await openMenu(user);

    expect(screen.getAllByRole("button", { name: /^Switch to / }).map((b) => b.textContent)).toEqual(["Switch to provider area"]);
    await user.click(screen.getByRole("button", { name: "Switch to provider area" }));

    expect(await screen.findByText("provider page")).toBeInTheDocument();
  });

  it("offers the same person the admin area from the provider area, and takes them back", async () => {
    auth.roles = ["provider", "admin.ops"];
    const user = userEvent.setup();
    renderAt("/pro/home");
    await openMenu(user);

    expect(screen.getAllByRole("button", { name: /^Switch to / }).map((b) => b.textContent)).toEqual([
      "Switch to facility admin area"
    ]);
    await user.click(screen.getByRole("button", { name: "Switch to facility admin area" }));

    expect(await screen.findByText("admin page")).toBeInTheDocument();
  });

  it("offers an administrator who holds the patient role the patient area", async () => {
    auth.roles = ["admin.ops", "client"];
    const user = userEvent.setup();
    renderAt("/admin/facility");
    await openMenu(user);

    await user.click(screen.getByRole("button", { name: "Switch to patient area" }));

    expect(await screen.findByText("patient page")).toBeInTheDocument();
  });

  it.each([["client", "/app/home"], ["provider", "/pro/home"], ["admin.ops", "/admin/facility"]])(
    "offers a person with only the %s role nothing",
    async (role, path) => {
      auth.roles = [role];
      const user = userEvent.setup();
      renderAt(path);
      await openMenu(user);

      expect(screen.queryByRole("button", { name: /Switch to/ })).not.toBeInTheDocument();
    }
  );

  it("never offers the area the person is already in", async () => {
    auth.roles = ["admin.ops", "provider", "client"];
    const user = userEvent.setup();
    renderAt("/pro/home");
    await openMenu(user);

    expect(screen.getAllByRole("button", { name: /^Switch to / }).map((b) => b.textContent)).toEqual([
      "Switch to facility admin area",
      "Switch to patient area"
    ]);
  });
});
