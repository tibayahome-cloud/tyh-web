/**
 * Registration password behaviour: one field with one line of help under it that says what is still missing as the
 * person types, a weak password never reaches the server, and a server rejection or network failure is shown clearly
 * without losing what was typed.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

const GOOD = "@Qwerty123";

const httpError = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { error: { code: "x", name: "y", message } }
  });

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="*" element={<div>signed-in-destination</div>} />
      </Routes>
    </MemoryRouter>
  );

const passwordField = () => screen.getByLabelText(/^Password/);

const fillAccount = async (user: ReturnType<typeof userEvent.setup>, password = GOOD) => {
  await user.type(screen.getByLabelText(/^Full name/), "Jane Client");
  await user.type(screen.getByLabelText(/^Phone/), "0712 345 678");
  await user.type(passwordField(), password);
  for (const box of screen.getAllByRole("checkbox")) {
    await user.click(box);
  }
};

const submitButton = () => {
  const buttons = screen.getAllByRole("button").filter((b) => b.getAttribute("type") === "submit");
  return buttons[0];
};

describe("registration password", () => {
  beforeEach(() => {
    postMock.mockReset();
    loginClientProviderMock.mockReset();
    loginClientProviderMock.mockResolvedValue({ status: "authenticated", user: { roles: ["client"] } });
  });

  it("says what a good password looks like before anything is typed", () => {
    renderPage();

    const hint = document.getElementById("signup-password-hint") as HTMLElement;
    expect(hint).toHaveTextContent(/at least 6 characters/i);
    expect(passwordField()).toHaveAttribute("aria-describedby", "signup-password-hint");
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
  });

  it("names the one thing still missing while the password is typed", async () => {
    const user = userEvent.setup();
    renderPage();
    const hint = document.getElementById("signup-password-hint") as HTMLElement;

    await user.type(passwordField(), "abc");
    expect(hint).toHaveTextContent("Keep going: at least 6 characters.");

    await user.clear(passwordField());
    await user.type(passwordField(), "abcdefg1!x");
    expect(hint).toHaveTextContent("Add an uppercase letter.");

    await user.clear(passwordField());
    await user.type(passwordField(), GOOD);
    expect(hint).toHaveTextContent("Good. That works.");
  });

  it("does not repeat the hint as an error line while the person is still typing", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(passwordField(), "abcdefg1!x");

    expect(screen.queryByText("Password needs an uppercase letter")).not.toBeInTheDocument();
  });

  it("never sends a weak password to the server", async () => {
    const user = userEvent.setup();
    renderPage();

    await fillAccount(user, "weak");
    await user.click(submitButton());

    expect(postMock).not.toHaveBeenCalled();
    await waitFor(() => expect(passwordField()).toHaveFocus());
    // The one hint line turns into the error; no second line repeats it.
    const hint = await screen.findByRole("alert");
    expect(hint).toHaveTextContent("Keep going: at least 6 characters.");
    expect(screen.queryByText("Password must be at least 6 characters")).not.toBeInTheDocument();
  });

  it("registers with a valid password and signs the person in", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({ data: { meta: {} } });
    renderPage();

    await fillAccount(user);
    await user.click(submitButton());

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0][0]).toBe("/auth/register");
    expect(postMock.mock.calls[0][1]).toMatchObject({ phone: "+254712345678", password: GOOD });
    expect(await screen.findByText("signed-in-destination")).toBeInTheDocument();
  });

  it("shows a server rejection of the password on the password field", async () => {
    const user = userEvent.setup();
    postMock.mockRejectedValue(httpError(400, "Password must be 6+ chars with upper, lower, digit, special."));
    renderPage();

    await fillAccount(user);
    await user.click(submitButton());

    expect(
      await screen.findByText("Password must be 6+ chars with upper, lower, digit, special.", {
        selector: "span.text-red-500"
      })
    ).toBeInTheDocument();
    expect(passwordField()).toHaveFocus();
  });

  it("keeps the form and offers a retry after a network failure", async () => {
    const user = userEvent.setup();
    postMock.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
    postMock.mockResolvedValueOnce({ data: { meta: {} } });
    renderPage();

    await fillAccount(user);
    await user.click(submitButton());

    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();
    expect(passwordField()).toHaveValue(GOOD);

    await user.click(submitButton());

    expect(await screen.findByText("signed-in-destination")).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it("lets the person show and hide the password", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Show" }));
    expect(passwordField()).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(passwordField()).toHaveAttribute("type", "password");
  });
});
