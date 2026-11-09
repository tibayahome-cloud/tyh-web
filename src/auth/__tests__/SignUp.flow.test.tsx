/**
 * Creating an account is one pass: register, be signed in at once, and arrive where you were heading.
 *
 * Before, registering ended on an "Account Verified!" screen (nothing had been verified) that sent the person to the
 * sign-in page to type the same details again, and the reason they came (usually to book a consultation) was lost.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.fn();
const loginClientProviderMock = vi.fn();

vi.mock("../../shared/libs/api", () => ({ default: { post: (...args: unknown[]) => postMock(...args) } }));
vi.mock("../../shared/hooks/useAuth", () => ({ useAuth: () => ({ loginClientProvider: loginClientProviderMock }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.signUpTitle": "Create your account",
        "auth.fullName": "Full name",
        "auth.email": "Email",
        "auth.phone": "Phone",
        "auth.password": "Password",
        "auth.confirmPassword": "Confirm password",
        "auth.signUpError": "We could not complete your registration.",
        "auth.haveAccount": "Already have an account?",
        "auth.backToLogin": "Back to sign in",
        "auth.signUpCta": "Create account"
      })[key] ?? key
  })
}));

import { SignUp } from "../SignUp";

const PASSWORD = "@Qwerty123";

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname}${location.search}`}</div>;
};

const renderPage = (entry = "/signup") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

const fill = async (user: ReturnType<typeof userEvent.setup>, { phone = "0712 345 678", email = "" } = {}) => {
  await user.type(screen.getByLabelText(/^Full name/), "Jane Client");
  if (email) await user.type(screen.getByLabelText(/^Email/), email);
  if (phone) await user.type(screen.getByLabelText(/^Phone/), phone);
  await user.type(screen.getByLabelText(/^Password/), PASSWORD);
  await user.type(screen.getByLabelText(/^Confirm password/), PASSWORD);
  for (const box of screen.getAllByRole("checkbox")) {
    await user.click(box);
  }
  await user.click(screen.getAllByRole("button").filter((b) => b.getAttribute("type") === "submit")[0]);
};

describe("creating an account", () => {
  beforeEach(() => {
    postMock.mockReset();
    postMock.mockResolvedValue({ data: { meta: {} } });
    loginClientProviderMock.mockReset();
    loginClientProviderMock.mockResolvedValue({ status: "authenticated", user: { roles: ["client"] } });
  });

  it("signs the person in at once with the number they gave, and lands on Home when nowhere was carried", async () => {
    const user = userEvent.setup();
    renderPage();

    await fill(user);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app/home"));
    expect(loginClientProviderMock).toHaveBeenCalledWith({ emailOrPhone: "+254712345678", password: PASSWORD, remember: true });
  });

  it("sends the booking the visitor came for through to the end", async () => {
    const user = userEvent.setup();
    renderPage("/signup?next=%2Fapp%2Ftelemedicine%3Fbook%3D1");

    await fill(user);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app/telemedicine?book=1"));
  });

  it("ignores a destination that leaves the site", async () => {
    const user = userEvent.setup();
    renderPage("/signup?next=https%3A%2F%2Felsewhere.example");

    await fill(user);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app/home"));
  });

  it("registers one clean number whichever way it was written", async () => {
    const user = userEvent.setup();
    renderPage();

    await fill(user, { phone: "0712 345 678" });

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0][0]).toBe("/auth/register");
    expect(postMock.mock.calls[0][1]).toMatchObject({ phone: "+254712345678", full_name: "Jane Client" });
  });

  it("signs in with the email when that is all the person gave", async () => {
    const user = userEvent.setup();
    renderPage();

    await fill(user, { phone: "", email: "jane@example.com" });

    await waitFor(() => expect(loginClientProviderMock).toHaveBeenCalled());
    expect(loginClientProviderMock.mock.calls[0][0]).toMatchObject({ emailOrPhone: "jane@example.com" });
    expect(postMock.mock.calls[0][1].phone).toBeUndefined();
  });

  it("falls back to the sign-in page, keeping the destination, when the automatic sign-in fails", async () => {
    const user = userEvent.setup();
    loginClientProviderMock.mockRejectedValue(new Error("network"));
    renderPage("/signup?next=%2Fapp%2Ftelemedicine%3Fbook%3D1");

    await fill(user);

    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent("/login?next=%2Fapp%2Ftelemedicine%3Fbook%3D1")
    );
  });

  it("shows no verification or success screen, and no promise of a verification step", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByText(/phone verification required/i)).not.toBeInTheDocument();
    await fill(user);

    await waitFor(() => expect(screen.getByTestId("where")).toBeInTheDocument());
    expect(screen.queryByText("Account Verified!")).not.toBeInTheDocument();
    expect(screen.queryByText(/enter verification code/i)).not.toBeInTheDocument();
  });

  it("keeps the destination on the link to sign in", () => {
    renderPage("/signup?next=%2Fapp%2Ftelemedicine%3Fbook%3D1");

    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fapp%2Ftelemedicine%3Fbook%3D1"
    );
  });
});
