import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformAdminGuard } from "../guards";

const useAuthMock = vi.fn();
const useRbacMock = vi.fn();

vi.mock("../../../shared/hooks/useAuth", () => ({
  useAuth: () => useAuthMock()
}));

vi.mock("../../../shared/hooks/useRbac", () => ({
  useRbac: () => useRbacMock()
}));

describe("PlatformAdminGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
  });

  it("renders platform-admin content for platform roles", () => {
    useRbacMock.mockReturnValue({
      hasRole: (required: string | string[]) => (Array.isArray(required) ? required.includes("admin.super") : required === "admin.super")
    });

    render(
      <MemoryRouter initialEntries={["/admin/global"]}>
        <Routes>
          <Route path="/admin/global" element={<PlatformAdminGuard><div>platform content</div></PlatformAdminGuard>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("platform content")).toBeInTheDocument();
  });

  it("redirects facility admins away from platform content", () => {
    useRbacMock.mockReturnValue({
      hasRole: (required: string | string[]) => Array.isArray(required) && required.includes("admin.ops")
    });

    render(
      <MemoryRouter initialEntries={["/admin/global"]}>
        <Routes>
          <Route path="/admin/global" element={<PlatformAdminGuard><div>platform content</div></PlatformAdminGuard>} />
          <Route path="/admin/facility" element={<div>facility workspace</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("facility workspace")).toBeInTheDocument();
    expect(screen.queryByText("platform content")).not.toBeInTheDocument();
  });
});
