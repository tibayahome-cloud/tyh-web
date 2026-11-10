/**
 * The booking's "Your details" step, for someone who chose a time without an account.
 *
 * It is the sign-up form of the sign-up page, reached in the middle of a booking, with a way to sign in instead. What
 * matters here is that the person is signed in by the time it reports back (the booking's next request needs the token),
 * that nobody is left on a dead end when the automatic sign-in does not work, and that a staff account cannot book.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postMock, loginClientProviderMock, logoutMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  loginClientProviderMock: vi.fn(),
  logoutMock: vi.fn()
}));

vi.mock("../../../../shared/libs/api", () => ({ default: { post: (...args: unknown[]) => postMock(...args) } }));
vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ loginClientProvider: loginClientProviderMock, logout: logoutMock })
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.fullName": "Full name",
        "auth.emailOrPhone": "Email or phone",
        "auth.password": "Password",
        "auth.signUpError": "We could not complete your registration.",
        "auth.forgotPassword": "Forgot your password?",
        "auth.signUpCta": "Create account"
      })[key] ?? key
  })
}));

import { BookingAccountStep } from "../BookingAccountStep";

// Six characters with a capital, a small letter, a number and a symbol: the shortest password the rule allows.
const PASSWORD = "Ab1!xy";

const CLIENT_RESULT = { status: "authenticated", user: { roles: ["client"] } };

// The API refuses a taken number or email with a 400 and only a message ("Phone already in use").
const refused = (message: string) =>
  new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: {} as never,
    data: { error: { code: 400, name: "Bad Request", message } }
  });

const renderStep = (props: Partial<React.ComponentProps<typeof BookingAccountStep>> = {}) => {
  const onReady = vi.fn();
  const onBack = vi.fn();
  render(<BookingAccountStep onReady={onReady} onBack={onBack} {...props} />);
  return { onReady, onBack };
};

const fillSignUp = async (user: ReturnType<typeof userEvent.setup>, { phone = "0712 345 678" } = {}) => {
  await user.type(screen.getByLabelText(/^Full name/), "Jane Client");
  await user.type(screen.getByLabelText(/^Phone/), phone);
  await user.type(screen.getByLabelText(/^Password/), PASSWORD);
  for (const box of screen.getAllByRole("checkbox")) {
    await user.click(box);
  }
  await user.click(screen.getByRole("button", { name: "Continue to payment" }));
};

const openSignIn = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /already have an account\? sign in/i }));
  await screen.findByRole("heading", { name: "Sign in to continue" });
};

const fillSignIn = async (user: ReturnType<typeof userEvent.setup>, password = PASSWORD) => {
  await user.type(screen.getByLabelText(/^Email or phone/), "0712 345 678");
  await user.type(screen.getByLabelText(/^Password/), password);
  await user.click(screen.getByRole("button", { name: "Sign in and continue" }));
};

beforeEach(() => {
  postMock.mockReset();
  postMock.mockResolvedValue({ data: { meta: {} } });
  loginClientProviderMock.mockReset();
  loginClientProviderMock.mockResolvedValue(CLIENT_RESULT);
  logoutMock.mockReset();
  logoutMock.mockResolvedValue(undefined);
});

describe("making an account in the middle of a booking", () => {
  it("is headed Your details and leads on to payment", () => {
    renderStep();

    expect(screen.getByRole("heading", { name: "Your details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to payment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("registers one clean number, signs the person in, and only then reports back", async () => {
    const user = userEvent.setup();
    const { onReady } = renderStep();

    await fillSignUp(user);

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0][0]).toBe("/auth/register");
    expect(postMock.mock.calls[0][1]).toMatchObject({ phone: "+254712345678", full_name: "Jane Client" });
    expect(postMock.mock.calls[0][1].legal_documents).toBeDefined();
    expect(loginClientProviderMock).toHaveBeenCalledWith({
      emailOrPhone: "+254712345678",
      password: PASSWORD,
      remember: true
    });
    // Signed in first: the call order is the guarantee that the hold which follows is sent with a token.
    expect(loginClientProviderMock.mock.invocationCallOrder[0]).toBeLessThan(onReady.mock.invocationCallOrder[0]);
  });

  it("accepts a six-character password that meets the rule", async () => {
    const user = userEvent.setup();
    const { onReady } = renderStep();

    await fillSignUp(user);

    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(postMock.mock.calls[0][1].password).toBe(PASSWORD);
  });

  it("does not register anyone until the two agreements are ticked", async () => {
    const user = userEvent.setup();
    const { onReady } = renderStep();
    await user.type(screen.getByLabelText(/^Full name/), "Jane Client");
    await user.type(screen.getByLabelText(/^Phone/), "0712 345 678");
    await user.type(screen.getByLabelText(/^Password/), PASSWORD);

    await user.click(screen.getByRole("button", { name: "Continue to payment" }));

    expect(postMock).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("uses the autocomplete values a password manager needs to suggest a strong password", () => {
    renderStep();

    expect(screen.getByLabelText(/^Full name/)).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText(/^Phone/)).toHaveAttribute("autocomplete", "tel");
    expect(screen.getByLabelText(/^Phone/)).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute("autocomplete", "new-password");
  });

  it("moves to signing in, with a message, when the account was made but signing in did not work", async () => {
    loginClientProviderMock.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    const { onReady } = renderStep();

    await fillSignUp(user);

    expect(await screen.findByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your account is ready. Sign in to continue.");
    expect(onReady).not.toHaveBeenCalled();
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("moves to signing in, with a message, when the new account asks for a verification code", async () => {
    loginClientProviderMock.mockResolvedValue({ status: "mfa_required" });
    const user = userEvent.setup();
    const { onReady } = renderStep();

    await fillSignUp(user);

    expect(await screen.findByText("Your account is ready. Sign in to continue.")).toBeInTheDocument();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("says what went wrong and stays on the form when the registration is refused", async () => {
    postMock.mockRejectedValue(new Error("Request failed"));
    const user = userEvent.setup();
    const { onReady } = renderStep();

    await fillSignUp(user);

    expect(await screen.findByText(/we could not complete your registration|request failed/i)).toBeInTheDocument();
    expect(loginClientProviderMock).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Your details" })).toBeInTheDocument();
  });

  it("takes someone whose number already has an account to signing in, with the number carried over", async () => {
    postMock.mockRejectedValue(refused("Phone already in use"));
    const user = userEvent.setup();
    const { onReady } = renderStep();

    await fillSignUp(user);

    expect(await screen.findByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "That number already has an account. Sign in to carry on with your booking."
    );
    // The number as the sign-up form holds it (spaces already removed).
    expect(screen.getByLabelText(/^Email or phone/)).toHaveValue("0712345678");
    // Only the password is left to type, so focus is already there.
    expect(screen.getByLabelText(/^Password/)).toHaveFocus();
    expect(loginClientProviderMock).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("names the email, and carries it over, when the email is the one that is taken", async () => {
    postMock.mockRejectedValue(refused("Email already in use"));
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole("button", { name: /add an email/i }));
    await user.type(screen.getByLabelText(/^Email/), "jane@example.com");

    await fillSignUp(user);

    expect(await screen.findByRole("status")).toHaveTextContent("That email already has an account.");
    expect(screen.getByLabelText(/^Email or phone/)).toHaveValue("jane@example.com");
  });

  it("lets the person finish signing in after that, and carries on with the booking", async () => {
    postMock.mockRejectedValue(refused("Phone already in use"));
    const user = userEvent.setup();
    const { onReady } = renderStep();
    await fillSignUp(user);
    await screen.findByRole("heading", { name: "Sign in to continue" });

    await user.type(screen.getByLabelText(/^Password/), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in and continue" }));

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(loginClientProviderMock).toHaveBeenCalledWith({
      emailOrPhone: "0712345678",
      password: PASSWORD,
      remember: true
    });
  });

  it("clears that notice when the person chooses to create an account after all", async () => {
    postMock.mockRejectedValue(refused("Phone already in use"));
    const user = userEvent.setup();
    renderStep();
    await fillSignUp(user);
    await screen.findByRole("heading", { name: "Sign in to continue" });

    await user.click(screen.getByRole("button", { name: /new here\? create an account/i }));

    expect(await screen.findByRole("heading", { name: "Your details" })).toBeInTheDocument();
    expect(screen.queryByText(/already has an account/i)).not.toBeInTheDocument();
  });

  it("still shows any other refusal on the form, in the server's words", async () => {
    postMock.mockRejectedValue(refused("Phone number is not valid for Kenya"));
    const user = userEvent.setup();
    renderStep();

    await fillSignUp(user);

    expect(await screen.findByText("Phone number is not valid for Kenya")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your details" })).toBeInTheDocument();
  });

  it("goes back to the times", async () => {
    const user = userEvent.setup();
    const { onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows that the time is being held, and no form, while the hold is made", () => {
    renderStep({ busy: true });

    expect(screen.getByText("Holding your time")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Full name/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue to payment" })).not.toBeInTheDocument();
  });
});

describe("signing in instead", () => {
  it("swaps to the sign-in form and back again", async () => {
    const user = userEvent.setup();
    renderStep();

    await openSignIn(user);
    expect(screen.getByRole("button", { name: "Sign in and continue" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Full name/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /new here\? create an account/i }));

    expect(await screen.findByRole("heading", { name: "Your details" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Full name/)).toBeInTheDocument();
  });

  it("signs a returning client in with their number and carries on", async () => {
    const user = userEvent.setup();
    const { onReady } = renderStep();
    await openSignIn(user);

    await fillSignIn(user);

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(loginClientProviderMock).toHaveBeenCalledWith({
      emailOrPhone: "0712 345 678",
      password: PASSWORD,
      remember: true
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it("uses the autocomplete values that let a password manager fill the saved login", async () => {
    const user = userEvent.setup();
    renderStep();
    await openSignIn(user);

    expect(screen.getByLabelText(/^Email or phone/)).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute("autocomplete", "current-password");
  });

  it("offers to reset a forgotten password in a new tab, so the booking is still here afterwards", async () => {
    const user = userEvent.setup();
    renderStep();
    await openSignIn(user);

    const link = screen.getByRole("link", { name: "Forgot your password? (opens in a new tab)" });

    expect(link).toHaveAttribute("href", "/forgot-password");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });

  it("asks only that a password be entered, not how long it is", async () => {
    const user = userEvent.setup();
    const { onReady } = renderStep();
    await openSignIn(user);

    await user.type(screen.getByLabelText(/^Email or phone/), "0712 345 678");
    await user.click(screen.getByRole("button", { name: "Sign in and continue" }));

    expect(await screen.findByText("Enter your password")).toBeInTheDocument();
    expect(loginClientProviderMock).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("shows the reason when the details are wrong and stays on the form", async () => {
    loginClientProviderMock.mockRejectedValue(new Error("Wrong phone number or password."));
    const user = userEvent.setup();
    const { onReady } = renderStep();
    await openSignIn(user);

    await fillSignIn(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong phone number or password.");
    expect(onReady).not.toHaveBeenCalled();
  });

  it("sends an account that asks for a verification code to the sign-in page", async () => {
    loginClientProviderMock.mockResolvedValue({ status: "mfa_required" });
    const user = userEvent.setup();
    const { onReady } = renderStep();
    await openSignIn(user);

    await fillSignIn(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/verification code/i);
    expect(onReady).not.toHaveBeenCalled();
  });

  it.each([["provider"], ["admin.ops"], ["admin.super"], ["admin"]])(
    "signs a %s account straight out again and does not let it book",
    async (role) => {
      loginClientProviderMock.mockResolvedValue({ status: "authenticated", user: { roles: [role] } });
      const user = userEvent.setup();
      const { onReady } = renderStep();
      await openSignIn(user);

      await fillSignIn(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(/staff account/i);
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(onReady).not.toHaveBeenCalled();
    }
  );

  it("still tells the person it is a staff account when signing out fails", async () => {
    loginClientProviderMock.mockResolvedValue({ status: "authenticated", user: { roles: ["provider"] } });
    logoutMock.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    const { onReady } = renderStep();
    await openSignIn(user);

    await fillSignIn(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/staff account/i);
    expect(onReady).not.toHaveBeenCalled();
  });
});
