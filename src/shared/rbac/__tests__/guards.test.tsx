import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequirePerm, RequireRole } from "../Can";

const useAuthMock = vi.fn();
const useRbacMock = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => useAuthMock()
}));

vi.mock("../../hooks/useRbac", () => ({
  useRbac: () => useRbacMock()
}));

describe("guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      sessionExpired: false,
      clearSessionExpired: vi.fn(),
      expireSession: vi.fn()
    });
    useRbacMock.mockReturnValue({
      hasRole: () => true,
      hasPermission: () => true
    });
  });

  it("renders children when role passes", () => {
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route
            path="/app"
            element={
              <RequireRole role="client">
                <div>protected</div>
              </RequireRole>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isBootstrapping: false,
      sessionExpired: false,
      clearSessionExpired: vi.fn(),
      expireSession: vi.fn()
    });
    useRbacMock.mockReturnValue({
      hasRole: () => false,
      hasPermission: () => false
    });

    render(
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route
            path="/app"
            element={
              <RequireRole role="client">
                <div>protected</div>
              </RequireRole>
            }
          />
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("login-page")).toBeInTheDocument();
  });

  it("redirects to admin login when permission missing", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      sessionExpired: false,
      clearSessionExpired: vi.fn(),
      expireSession: vi.fn()
    });
    useRbacMock.mockReturnValue({
      hasRole: () => true,
      hasPermission: () => false
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequirePerm perm="admin.access">
                <div>admin</div>
              </RequirePerm>
            }
          />
          <Route path="/admin/login" element={<div>admin-login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("admin-login")).toBeInTheDocument();
  });
});
