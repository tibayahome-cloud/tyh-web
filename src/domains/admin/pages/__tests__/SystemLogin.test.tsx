/**
 * System administration sign-in. It is not linked from any public page, looks unmistakably
 * different from the facility admin sign-in, and offers no cross-portal call to action.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loginAdminMock = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.email": "Email",
        "auth.password": "Password",
        "auth.rememberMe": "Remember me",
        "auth.submit": "Sign in",
        "auth.switchUser": "Back to user sign in",
        "auth.adminRedirectNotice": "Please use your administrator sign-in.",
        "auth.signingIn": "Signing you in",
        "auth.redirecting": "Redirecting"
      })[key] ?? key
  })
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ loginAdmin: loginAdminMock })
}));

vi.mock("../../../../shared/utils/twofaStorage", () => ({
  saveTwofaChallenge: vi.fn(),
  setTwofaPendingFlag: vi.fn(),
  clearTwofaChallenge: vi.fn(),
  isTwofaPending: () => false
}));

import AdminLoginPage from "../Login";

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const renderPage = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/admin/login", state }]}>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

describe("system administration sign-in page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is clearly a restricted system page, not a variant of the facility sign-in", () => {
    const { container } = renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "System administration" })).toBeInTheDocument();
    expect(screen.getByText("Restricted access")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/facility/i);
    expect(screen.queryByRole("navigation", { name: "Choose how you sign in" })).not.toBeInTheDocument();
  });

  it("does not link to the facility sign-in or advertise switching between admin types", () => {
    const { container } = renderPage();

    expect(container.querySelector('a[href="/facility/login"]')).toBeNull();
    expect(screen.queryByText(/Need client access/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Back to user sign in" })).toHaveAttribute("href", "/login");
  });

  it("still signs in through the admin API and opens the dashboard", async () => {
    const user = userEvent.setup();
    loginAdminMock.mockResolvedValue({ status: "authenticated", user: { roles: ["admin.super"] } });
    renderPage();

    await user.type(screen.getByLabelText("Email"), "root@tiba.example");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin/dashboard"));
  });

  it("keeps existing bookmarks working: a facility admin who signs in here still reaches the facility portal", async () => {
    const user = userEvent.setup();
    loginAdminMock.mockResolvedValue({ status: "authenticated", user: { roles: ["admin.ops"] } });
    renderPage();

    await user.type(screen.getByLabelText("Email"), "ops@clinic.example");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin/facility"));
  });

  it("shows the redirect notice when sent here from the personal sign-in", () => {
    renderPage({ redirected: "admin-role" });

    expect(screen.getByText("Please use your administrator sign-in.")).toBeInTheDocument();
  });
});
