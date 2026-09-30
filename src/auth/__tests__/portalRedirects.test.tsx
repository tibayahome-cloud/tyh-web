/**
 * Where people land when they sign out, when a session expires, and when they open the admin
 * area directly without signing in. A facility admin is never sent to the system administration
 * page; a super admin goes back to their own.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const useRbacMock = vi.fn();
const clearSessionExpiredMock = vi.fn();

vi.mock("../../shared/hooks/useAuth", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../../shared/hooks/useRbac", () => ({ useRbac: () => useRbacMock() }));

import { LogoutGate } from "../LogoutGate";
import { SessionExpired } from "../SessionExpired";
import { RequirePerm } from "../../shared/rbac/Can";
import { adminLoginPath, readArea } from "../../shared/utils/portalMemory";
import { PlatformAdminGuard } from "../../domains/admin/guards";

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
};

const auth = (overrides: Record<string, unknown> = {}) => ({
  isAuthenticated: false,
  isBootstrapping: false,
  sessionExpired: false,
  roles: [] as string[],
  clearSessionExpired: clearSessionExpiredMock,
  ...overrides
});

const renderAdminArea = (initialPath = "/admin/dashboard") =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <LogoutGate redirectTo={adminLoginPath}>
              <div>admin area</div>
            </LogoutGate>
          }
        />
        <Route path="/admin/login" element={<Where />} />
        <Route path="/session-expired" element={<SessionExpired />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

describe("admin area sign-out and direct access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useRbacMock.mockReturnValue({ hasPermission: () => true, hasRole: () => true });
  });

  it("sends someone who opens the admin area without signing in to the neutral facility sign-in", () => {
    useAuthMock.mockReturnValue(auth());
    renderAdminArea("/admin/facilities/anything");

    expect(screen.getByTestId("where")).toHaveTextContent("/facility/login");
  });

  it("does not send an unknown visitor to the system sign-in from a URL alone", () => {
    useAuthMock.mockReturnValue(auth());
    renderAdminArea("/admin/login-please");

    expect(screen.getByTestId("where")).not.toHaveTextContent("/admin/login");
  });

  it("returns a facility admin to the facility sign-in after they sign out", () => {
    useAuthMock.mockReturnValue(auth({ isAuthenticated: true, roles: ["admin.ops"] }));
    const { rerender } = renderAdminArea();
    expect(screen.getByText("admin area")).toBeInTheDocument();
    expect(readArea()).toBe("facility");

    useAuthMock.mockReturnValue(auth());
    rerender(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <LogoutGate redirectTo={adminLoginPath}>
                <div>admin area</div>
              </LogoutGate>
            }
          />
          <Route path="/admin/login" element={<Where />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("where")).toHaveTextContent("/facility/login");
  });

  it("returns a super admin to the system sign-in after they sign out", () => {
    useAuthMock.mockReturnValue(auth({ isAuthenticated: true, roles: ["admin.super"] }));
    renderAdminArea();
    expect(readArea()).toBe("system");

    useAuthMock.mockReturnValue(auth());
    renderAdminArea("/admin/dashboard");

    expect(screen.getAllByTestId("where").at(-1)).toHaveTextContent("/admin/login");
  });

  it("does not remember an area, or redirect, while the session is still loading", () => {
    useAuthMock.mockReturnValue(auth({ isBootstrapping: true }));
    renderAdminArea();

    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
    expect(readArea()).toBeNull();
  });

  it("leaves the personal and provider gates pointing at the personal sign-in", () => {
    useAuthMock.mockReturnValue(auth());
    render(
      <MemoryRouter initialEntries={["/app/home"]}>
        <Routes>
          <Route
            path="/app/*"
            element={
              <LogoutGate redirectTo="/login">
                <div>client area</div>
              </LogoutGate>
            }
          />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("where")).toHaveTextContent("/login");
  });
});

describe("session expiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useRbacMock.mockReturnValue({ hasPermission: () => true, hasRole: () => true });
  });

  it("shows the expiry page for an admin area regardless of who was signed in", () => {
    useAuthMock.mockReturnValue(auth({ sessionExpired: true }));
    renderAdminArea();

    expect(screen.getByText("Session expired")).toBeInTheDocument();
  });

  it.each([
    ["facility", "/facility/login"],
    ["system", "/admin/login"],
    ["client", "/login"],
    ["provider", "/login"],
    [null, "/login"]
  ] as const)("returns a %s session to %s", async (area, expected) => {
    const user = userEvent.setup();
    if (area) {
      window.localStorage.setItem("tiba.lastArea", area);
    }
    useAuthMock.mockReturnValue(auth({ sessionExpired: true }));
    renderAdminArea();

    await user.click(screen.getByRole("button", { name: "Go to login" }));

    expect(screen.getByTestId("where")).toHaveTextContent(expected);
    expect(clearSessionExpiredMock).toHaveBeenCalled();
  });
});

describe("permission gate default redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  const renderGate = () =>
    render(
      <MemoryRouter initialEntries={["/admin/x"]}>
        <Routes>
          <Route
            path="/admin/x"
            element={
              <RequirePerm perm="admin.access">
                <div>allowed</div>
              </RequirePerm>
            }
          />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );

  it("sends an unauthenticated visitor to the facility sign-in by default", () => {
    useAuthMock.mockReturnValue(auth());
    useRbacMock.mockReturnValue({ hasPermission: () => false });
    renderGate();

    expect(screen.getByTestId("where")).toHaveTextContent("/facility/login");
  });

  it("sends someone who lost the permission to the sign-in for the area they were in", () => {
    window.localStorage.setItem("tiba.lastArea", "system");
    useAuthMock.mockReturnValue(auth({ isAuthenticated: true }));
    useRbacMock.mockReturnValue({ hasPermission: () => false });
    renderGate();

    expect(screen.getByTestId("where")).toHaveTextContent("/admin/login");
  });

  it("lets an authorised person through", () => {
    useAuthMock.mockReturnValue(auth({ isAuthenticated: true }));
    useRbacMock.mockReturnValue({ hasPermission: () => true });
    renderGate();

    expect(screen.getByText("allowed")).toBeInTheDocument();
  });
});

describe("routing between the two admin audiences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue(auth({ isAuthenticated: true }));
  });

  const renderGuard = () =>
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route
            path="/admin/dashboard"
            element={
              <PlatformAdminGuard>
                <div>system dashboard</div>
              </PlatformAdminGuard>
            }
          />
          <Route path="/admin/facility" element={<div>facility portal</div>} />
        </Routes>
      </MemoryRouter>
    );

  it("keeps a super admin on the system dashboard", () => {
    useRbacMock.mockReturnValue({
      hasRole: (required: string | string[]) => (Array.isArray(required) ? required.includes("admin.super") : required === "admin.super")
    });
    renderGuard();

    expect(screen.getByText("system dashboard")).toBeInTheDocument();
  });

  it("sends a facility admin who opens the system dashboard to the facility portal", () => {
    useRbacMock.mockReturnValue({ hasRole: () => false });
    renderGuard();

    expect(screen.getByText("facility portal")).toBeInTheDocument();
    expect(screen.queryByText("system dashboard")).not.toBeInTheDocument();
  });
});
