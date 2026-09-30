/**
 * Facility admin sign-in. It shares the admin API with system administration but is a separate,
 * publicly linked entry point; a system administrator who authenticates here is signed out and
 * shown the same message as a failed sign-in, so this page never names another kind of admin.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loginAdminMock = vi.fn();
const logoutMock = vi.fn();
const saveTwofaChallengeMock = vi.fn();
const setTwofaPendingFlagMock = vi.fn();
const isTwofaPendingMock = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.email": "Email",
        "auth.password": "Password",
        "auth.rememberMe": "Remember me",
        "auth.submit": "Sign in",
        "auth.signingIn": "Signing you in",
        "auth.redirecting": "Redirecting"
      })[key] ?? key
  })
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ loginAdmin: loginAdminMock, logout: logoutMock })
}));

vi.mock("../../../../shared/utils/twofaStorage", () => ({
  saveTwofaChallenge: (...args: unknown[]) => saveTwofaChallengeMock(...args),
  setTwofaPendingFlag: (...args: unknown[]) => setTwofaPendingFlagMock(...args),
  clearTwofaChallenge: vi.fn(),
  isTwofaPending: () => isTwofaPendingMock()
}));

import FacilityLoginPage from "../FacilityLogin";

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const renderPage = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/facility/login", state }]}>
      <Routes>
        <Route path="/facility/login" element={<FacilityLoginPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

const submit = async (user: ReturnType<typeof userEvent.setup>) => {
  // Field errors render inside the label, so match the label by its leading text.
  await user.type(screen.getByLabelText(/^Email/), "ops@clinic.example");
  await user.type(screen.getByLabelText(/^Password/), "correct-horse");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
};

describe("facility admin sign-in page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTwofaPendingMock.mockReturnValue(false);
    logoutMock.mockResolvedValue(undefined);
  });

  it("names the facility portal and shows the two-way switch with facility admin selected", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Facility admin sign in" })).toBeInTheDocument();
    expect(screen.getByText("Facility portal")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Choose how you sign in" });
    expect(within(nav).getByRole("link", { name: "Facility admin" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Personal account" })).toHaveAttribute("href", "/login");
  });

  it("never links to or mentions system administration", () => {
    const { container } = renderPage();

    expect(container.querySelector('a[href="/admin/login"]')).toBeNull();
    expect(container.textContent).not.toMatch(/system|super|restricted|platform admin/i);
  });

  it("keeps Sign in the only filled action, at touch-friendly sizes", () => {
    renderPage();

    const signIn = screen.getByRole("button", { name: "Sign in" });
    expect(signIn.className).toContain("bg-tiba-blue");
    expect(signIn.className).toContain("min-h-12");
    expect(screen.getByLabelText("Remember me").closest("label")?.className).toContain("min-h-11");
  });

  it("signs a facility admin in and opens the facility portal, not the system dashboard", async () => {
    const user = userEvent.setup();
    loginAdminMock.mockResolvedValue({ status: "authenticated", user: { roles: ["admin.ops"] } });
    renderPage();

    await submit(user);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin/facility"));
    expect(screen.getByTestId("where")).not.toHaveTextContent("/admin/dashboard");
    expect(loginAdminMock).toHaveBeenCalledWith({
      email: "ops@clinic.example",
      password: "correct-horse",
      remember: true
    });
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it("signs a system administrator out and answers exactly as for a failed sign-in", async () => {
    const user = userEvent.setup();
    loginAdminMock.mockResolvedValue({ status: "authenticated", user: { roles: ["admin.super"] } });
    renderPage();

    await submit(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We could not sign you in. Check your details and try again.");
    expect(alert.textContent).not.toMatch(/admin|system|portal/i);
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
  });

  it("hands off to two-factor verification", async () => {
    const user = userEvent.setup();
    loginAdminMock.mockResolvedValue({
      status: "mfa_required",
      method: "sms",
      sessionHint: "hint",
      userId: "u1",
      availableMethods: ["sms"]
    });
    renderPage();

    await submit(user);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/two-factor"));
    expect(saveTwofaChallengeMock).toHaveBeenCalledWith(expect.objectContaining({ origin: "admin", userId: "u1" }));
    expect(setTwofaPendingFlagMock).toHaveBeenLastCalledWith(true);
  });

  it("shows server errors in an alert and validates before calling the API", async () => {
    const user = userEvent.setup();
    loginAdminMock.mockRejectedValue(new Error("Invalid credentials"));
    renderPage();

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("A valid email is required")).toBeInTheDocument();
    expect(loginAdminMock).not.toHaveBeenCalled();

    await submit(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
  });

  it("explains a redirect from the personal sign-in without naming other admins", () => {
    renderPage({ redirected: "facility-role" });

    expect(screen.getByText(/facility admin account/i)).toBeInTheDocument();
  });
});
