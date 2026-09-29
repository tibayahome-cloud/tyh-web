/**
 * Client sign-in page. Sign in is the one filled, dominant action; account creation and the admin
 * entry point are quiet text links. These tests pin that hierarchy, the 44px touch targets, and
 * -- because the layout was rebuilt around it -- that authentication, role routing, MFA hand-off,
 * remember-me and error handling still behave exactly as before.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loginClientProviderMock = vi.fn();
const logoutMock = vi.fn();
const saveTwofaChallengeMock = vi.fn();
const setTwofaPendingFlagMock = vi.fn();
const clearTwofaChallengeMock = vi.fn();
const isTwofaPendingMock = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.loginTitle": "Sign in",
        "auth.signUp": "Create account",
        "auth.emailOrPhone": "Email or phone",
        "auth.password": "Password",
        "auth.rememberMe": "Remember me",
        "auth.forgotPassword": "Forgot password?",
        "auth.submit": "Sign in",
        "auth.signingIn": "Signing you in",
        "auth.redirecting": "Redirecting"
      })[key] ?? key
  })
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ loginClientProvider: loginClientProviderMock, logout: logoutMock })
}));

vi.mock("../../../../shared/utils/twofaStorage", () => ({
  saveTwofaChallenge: (...args: unknown[]) => saveTwofaChallengeMock(...args),
  setTwofaPendingFlag: (...args: unknown[]) => setTwofaPendingFlagMock(...args),
  clearTwofaChallenge: (...args: unknown[]) => clearTwofaChallengeMock(...args),
  isTwofaPending: () => isTwofaPendingMock()
}));

import ClientLoginPage from "../Login";

const Where = () => {
  const location = useLocation();
  return (
    <div data-testid="where" data-state={JSON.stringify(location.state ?? null)}>
      {location.pathname}
    </div>
  );
};

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<ClientLoginPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText("Email or phone"), "jane@example.com");
  await user.type(screen.getByLabelText("Password"), "correct-horse");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
};

describe("client sign-in page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTwofaPendingMock.mockReturnValue(false);
    logoutMock.mockResolvedValue(undefined);
  });

  describe("visual hierarchy", () => {
    it("has Sign in as the single filled primary action", () => {
      renderLogin();

      const signIn = screen.getByRole("button", { name: "Sign in" });
      expect(signIn).toHaveAttribute("type", "submit");
      expect(signIn.className).toContain("bg-tiba-blue");
      expect(signIn.className).toContain("w-full");
      expect(signIn.className).toContain("min-h-12");

      // Nothing else on the page is a filled or bordered call to action.
      const filled = screen
        .getAllByRole("link")
        .filter((link) => /\b(bg-tiba-blue|border-tiba-blue|w-full)\b/.test(link.className));
      expect(filled).toHaveLength(0);
    });

    it("offers account creation once, as a quiet text link", () => {
      renderLogin();

      const signup = screen.getAllByRole("link", { name: "Create account" });
      expect(signup).toHaveLength(1);
      expect(signup[0]).toHaveAttribute("href", "/signup");
      expect(signup[0].className).not.toMatch(/\bbg-|\bborder\b|w-full/);
      expect(screen.getByText(/New to Tiba Ya Home\?/)).toBeInTheDocument();
    });

    it("offers exactly two ways in -- personal account and facility admin -- with personal selected", () => {
      renderLogin();

      const nav = screen.getByRole("navigation", { name: "Choose how you sign in" });
      const links = within(nav).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual(["Personal account", "Facility admin"]);
      expect(links.map((link) => link.getAttribute("href"))).toEqual(["/login", "/facility/login"]);
      expect(within(nav).getByRole("link", { name: "Personal account" })).toHaveAttribute("aria-current", "page");
      expect(within(nav).getByRole("link", { name: "Facility admin" })).not.toHaveAttribute("aria-current");
    });

    it("never links to, or mentions, system administration", () => {
      const { container } = renderLogin();

      expect(container.querySelector('a[href="/admin/login"]')).toBeNull();
      expect(screen.queryByText(/admin sign in/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/system|portal/i)).not.toBeInTheDocument();
    });

    it("no longer renders the oversized sign-up panel", () => {
      const { container } = renderLogin();

      expect(container.querySelector(".bg-tiba-blue\\/5")).toBeNull();
      expect(screen.queryByText("Accessing a facility or system portal?")).not.toBeInTheDocument();
    });

    it("keeps every interactive control at least 44px tall", () => {
      renderLogin();

      for (const name of ["Create account", "Forgot password?", "Personal account", "Facility admin"]) {
        expect(screen.getByRole("link", { name }).className, name).toContain("min-h-11");
      }
      const remember = screen.getByLabelText("Remember me").closest("label") as HTMLElement;
      expect(remember.className).toContain("min-h-11");
      expect(screen.getByRole("button", { name: /show/i }).className).toMatch(/\bh-11\b.*\bmin-w-11\b/);
    });
  });

  describe("accessibility and keyboard order", () => {
    it("labels the fields and exposes a semantic password toggle", async () => {
      const user = userEvent.setup();
      renderLogin();

      expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
      expect(screen.getByLabelText("Email or phone")).toHaveAttribute("autocomplete", "username");
      const password = screen.getByLabelText("Password");
      expect(password).toHaveAttribute("type", "password");
      expect(password).toHaveAttribute("autocomplete", "current-password");

      const toggle = screen.getByRole("button", { name: "Show" });
      expect(toggle).toHaveAttribute("type", "button");
      await user.click(toggle);
      expect(password).toHaveAttribute("type", "text");
      expect(screen.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-pressed", "true");
    });

    it("tabs through the form in visual order", async () => {
      const user = userEvent.setup();
      renderLogin();

      const order = [
        screen.getByRole("link", { name: "Personal account" }),
        screen.getByRole("link", { name: "Facility admin" }),
        screen.getByLabelText("Email or phone"),
        screen.getByLabelText("Password"),
        screen.getByRole("button", { name: "Show" }),
        screen.getByLabelText("Remember me"),
        screen.getByRole("link", { name: "Forgot password?" }),
        screen.getByRole("button", { name: "Sign in" }),
        screen.getByRole("link", { name: "Create account" })
      ];
      for (const element of order) {
        await user.tab();
        expect(element).toHaveFocus();
      }
    });

    it("points forgot-password at the existing flow", () => {
      renderLogin();
      expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    });
  });

  describe("authentication behaviour (unchanged)", () => {
    it("signs a client in with remember-me on by default and lands on the client home", async () => {
      const user = userEvent.setup();
      loginClientProviderMock.mockResolvedValue({ status: "authenticated", user: { roles: ["client"] } });
      renderLogin();

      expect(screen.getByLabelText("Remember me")).toBeChecked();
      await fillAndSubmit(user);

      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app/home"));
      expect(loginClientProviderMock).toHaveBeenCalledWith({
        emailOrPhone: "jane@example.com",
        password: "correct-horse",
        remember: true
      });
    });

    it("passes remember-me through when the person turns it off", async () => {
      const user = userEvent.setup();
      loginClientProviderMock.mockResolvedValue({ status: "authenticated", user: { roles: ["client"] } });
      renderLogin();

      await user.click(screen.getByLabelText("Remember me"));
      await fillAndSubmit(user);

      await waitFor(() => expect(loginClientProviderMock).toHaveBeenCalled());
      expect(loginClientProviderMock.mock.calls[0][0]).toMatchObject({ remember: false });
    });

    it("sends a provider to the provider home", async () => {
      const user = userEvent.setup();
      loginClientProviderMock.mockResolvedValue({ status: "authenticated", user: { roles: ["provider"] } });
      renderLogin();

      await fillAndSubmit(user);

      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/pro/home"));
    });

    it("signs a system admin out and sends them to their own sign-in instead", async () => {
      const user = userEvent.setup();
      loginClientProviderMock.mockResolvedValue({ status: "authenticated", user: { roles: ["admin.super"] } });
      renderLogin();

      await fillAndSubmit(user);

      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin/login"));
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("where").getAttribute("data-state")).toContain("admin-role");
    });

    it("signs a facility admin out and sends them to the facility sign-in, never the system one", async () => {
      const user = userEvent.setup();
      loginClientProviderMock.mockResolvedValue({ status: "authenticated", user: { roles: ["admin.ops"] } });
      renderLogin();

      await fillAndSubmit(user);

      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/facility/login"));
      expect(screen.getByTestId("where")).not.toHaveTextContent("/admin/login");
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("where").getAttribute("data-state")).toContain("facility-role");
    });

    it("hands off to two-factor verification with the challenge saved", async () => {
      const user = userEvent.setup();
      loginClientProviderMock.mockResolvedValue({
        status: "mfa_required",
        method: "sms",
        sessionHint: "hint-1",
        userId: "user-1",
        availableMethods: ["sms", "email"]
      });
      renderLogin();

      await fillAndSubmit(user);

      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/two-factor"));
      expect(saveTwofaChallengeMock).toHaveBeenCalledWith({
        method: "sms",
        sessionHint: "hint-1",
        userId: "user-1",
        origin: "client",
        methods: ["sms", "email"]
      });
      expect(setTwofaPendingFlagMock).toHaveBeenLastCalledWith(true);
    });

    it("resumes a pending two-factor challenge instead of showing the form", async () => {
      isTwofaPendingMock.mockReturnValue(true);
      renderLogin();

      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/two-factor"));
    });

    it("shows the server's error in an alert and re-enables the button", async () => {
      const user = userEvent.setup();
      loginClientProviderMock.mockRejectedValue(new Error("Invalid credentials"));
      renderLogin();

      await fillAndSubmit(user);

      const alert = await screen.findByRole("alert");
      expect(within(alert).getByText("Invalid credentials")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });

    it("falls back to a generic message for a non-Error failure", async () => {
      const user = userEvent.setup();
      loginClientProviderMock.mockRejectedValue("boom");
      renderLogin();

      await fillAndSubmit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(/could not sign you in/i);
    });

    it("validates before calling the API", async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByText("Email or phone is required")).toBeInTheDocument();
      expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
      expect(loginClientProviderMock).not.toHaveBeenCalled();
    });

    it("shows a busy state and blocks a second submit while signing in", async () => {
      const user = userEvent.setup();
      let resolveLogin: (value: unknown) => void = () => undefined;
      loginClientProviderMock.mockReturnValue(new Promise((resolve) => (resolveLogin = resolve)));
      renderLogin();

      await fillAndSubmit(user);

      const button = await screen.findByRole("button", { name: "Sign in" });
      await waitFor(() => expect(button).toBeDisabled());
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("Signing you in")).toBeInTheDocument();

      resolveLogin({ status: "authenticated", user: { roles: ["client"] } });
      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app/home"));
    });
  });
});
