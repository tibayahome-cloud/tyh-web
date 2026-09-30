/**
 * Registration password behaviour: the requirements are visible up front, every rule and the
 * confirmation report live, a weak password never reaches the server, and a server rejection or
 * network failure is shown clearly without losing what was typed.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.fn();

vi.mock("../../shared/libs/api", () => ({ default: { post: (...args: unknown[]) => postMock(...args) } }));

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
    <MemoryRouter>
      <SignUp />
    </MemoryRouter>
  );

const passwordField = () => screen.getByLabelText(/^Password/);
const confirmField = () => screen.getByLabelText(/^Confirm password/);

const fillAccount = async (user: ReturnType<typeof userEvent.setup>, password = GOOD, confirm = GOOD) => {
  await user.type(screen.getByLabelText(/^Full name/), "Jane Client");
  await user.type(screen.getByLabelText(/^Email/), "jane@example.com");
  await user.type(passwordField(), password);
  await user.type(confirmField(), confirm);
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
  });

  it("shows the requirements before anything is typed", () => {
    renderPage();

    const list = document.getElementById("signup-password-requirements") as HTMLElement;
    expect(within(list).getByRole("list", { name: "Requirements for your password" })).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(passwordField()).toHaveAttribute("aria-describedby", "signup-password-requirements");
    expect(confirmField()).toHaveAttribute("aria-describedby", "signup-password-requirements");
  });

  it("names the failing rule while the password is typed", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(passwordField(), "abcdefg1!x");

    expect(await screen.findByText("Password needs an uppercase letter", { selector: "span.text-red-500" })).toBeInTheDocument();
  });

  it("reports a mismatched confirmation live", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(passwordField(), GOOD);
    await user.type(confirmField(), "@Qwerty12");

    expect(await screen.findByText("Passwords must match", { selector: "span.text-red-500" })).toBeInTheDocument();
  });

  it("never sends a weak password to the server", async () => {
    const user = userEvent.setup();
    renderPage();

    await fillAccount(user, "weakpass", "weakpass");
    await user.click(submitButton());

    expect(postMock).not.toHaveBeenCalled();
    await waitFor(() => expect(passwordField()).toHaveFocus());
  });

  it("registers with a valid password and carries on to the next step", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({ data: { meta: {} } });
    renderPage();

    await fillAccount(user);
    await user.click(submitButton());

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0][0]).toBe("/auth/register");
    expect(postMock.mock.calls[0][1]).toMatchObject({ email: "jane@example.com", password: GOOD });
    expect(await screen.findByText("Account Verified!")).toBeInTheDocument();
  });

  it("shows a server rejection of the password on the password field", async () => {
    const user = userEvent.setup();
    postMock.mockRejectedValue(httpError(400, "Password must be 10+ chars with upper, lower, digit, special."));
    renderPage();

    await fillAccount(user);
    await user.click(submitButton());

    expect(
      await screen.findByText("Password must be 10+ chars with upper, lower, digit, special.", {
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

    expect(await screen.findByText("Account Verified!")).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it("still lets the person show and hide each password", async () => {
    const user = userEvent.setup();
    renderPage();

    const [showPassword] = screen.getAllByRole("button", { name: "Show" });
    await user.click(showPassword);

    expect(passwordField()).toHaveAttribute("type", "text");
    expect(confirmField()).toHaveAttribute("type", "password");
  });
});
