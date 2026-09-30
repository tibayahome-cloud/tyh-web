/**
 * Reset and first-time setup share one page (an invitation link adds ?flow=invitation). Every
 * password rule reports live, requirements are visible before submitting, the confirmation is
 * checked as it is typed, and whatever the server says back is shown clearly.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.fn();

vi.mock("../../shared/libs/api", () => ({ default: { post: (...args: unknown[]) => postMock(...args) } }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.resetPasswordTitle": "Reset your password",
        "auth.resetPasswordDescription": "Choose a new password for your account.",
        "auth.confirmPassword": "Confirm password",
        "auth.resetPasswordCta": "Reset password",
        "auth.resetPasswordSuccess": "Your password has been reset.",
        "auth.resetPasswordError": "We could not reset your password.",
        "auth.resetPasswordMissingToken": "This reset link is missing its token.",
        "auth.resetPasswordMissingTokenHelp": "Need a new link?",
        "auth.backToLogin": "Back to sign in",
        "auth.forgotPassword": "Forgot password?"
      })[key] ?? key
  })
}));

import { ResetPassword } from "../ResetPassword";

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const renderPage = (search = "?token=abc123") =>
  render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

const httpError = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { error: { code: "x", name: "y", message } }
  });

const GOOD = "@Qwerty123";

const passwordField = () => screen.getByLabelText(/^(New password|Create password)/);
const confirmField = () => screen.getByLabelText(/^Confirm password/);
// Scoped to the checklist: the same words also appear in the field's own error message.
const ruleState = (label: RegExp) => {
  const list = document.getElementById("reset-password-requirements") as HTMLElement;
  return (within(list).getByText(label).closest("li") as HTMLElement).textContent ?? "";
};

describe("reset and set-up password page", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  describe("requirements", () => {
    it("shows every requirement before anything is typed or submitted", () => {
      renderPage();

      expect(screen.getByText("Your password needs")).toBeInTheDocument();
      for (const rule of [/At least 10 characters/, /uppercase/, /lowercase/, /One number/, /special character/]) {
        expect(screen.getByText(rule)).toBeInTheDocument();
      }
      expect(screen.getByText(/Both passwords match/)).toBeInTheDocument();
    });

    it("ties both fields to the requirements for assistive technology", () => {
      renderPage();

      expect(passwordField()).toHaveAttribute("aria-describedby", "reset-password-requirements");
      expect(confirmField()).toHaveAttribute("aria-describedby", "reset-password-requirements");
      expect(document.getElementById("reset-password-requirements")).not.toBeNull();
    });

    it("uses set-up wording for an invitation link and reset wording otherwise", () => {
      const { unmount } = renderPage("?token=abc&flow=invitation");
      expect(screen.getByLabelText(/^Create password/)).toBeInTheDocument();
      expect(screen.getByText("Create your password to activate your TYH account.")).toBeInTheDocument();
      unmount();

      renderPage();
      expect(screen.getByLabelText(/^New password/)).toBeInTheDocument();
      expect(screen.getByText("Choose a new password for your account.")).toBeInTheDocument();
    });
  });

  describe("live validation", () => {
    it.each([
      ["Ab1!", /At least 10 characters/, "Password must be at least 10 characters"],
      ["abcdefg1!x", /uppercase/, "Password needs an uppercase letter"],
      ["ABCDEFG1!X", /lowercase/, "Password needs a lowercase letter"],
      ["Abcdefgh!x", /One number/, "Password needs a number"],
      ["Abcdefgh1x", /special character/, "Password needs a special character"]
    ])("flags %s as it is typed, naming the failed rule", async (typed, rule, message) => {
      const user = userEvent.setup();
      renderPage();

      await user.type(passwordField(), typed);

      expect(await screen.findByText(message, { selector: "span.text-red-500" })).toBeInTheDocument();
      expect(ruleState(rule)).toMatch(/: not met$/);
    });

    it("clears the error once every rule is met", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(passwordField(), "short");
      await screen.findByText("Password must be at least 10 characters", { selector: "span.text-red-500" });
      await user.clear(passwordField());
      await user.type(passwordField(), GOOD);

      await waitFor(() =>
        expect(screen.queryByText(/Password (must|needs)/, { selector: "span.text-red-500" })).not.toBeInTheDocument()
      );
      expect(screen.getByRole("status")).toHaveTextContent("Password meets every requirement.");
    });

    it("reports a mismatched confirmation while it is typed", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(passwordField(), GOOD);
      await user.type(confirmField(), "@Qwerty12");

      expect(await screen.findByText("Passwords must match", { selector: "span.text-red-500" })).toBeInTheDocument();
      expect(ruleState(/Both passwords match/)).toMatch(/: not met$/);
    });

    it("re-checks the confirmation when the password is edited afterwards", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(passwordField(), GOOD);
      await user.type(confirmField(), GOOD);
      await waitFor(() => expect(ruleState(/Both passwords match/)).toMatch(/: met$/));

      await user.type(passwordField(), "x");

      expect(await screen.findByText("Passwords must match", { selector: "span.text-red-500" })).toBeInTheDocument();
      expect(ruleState(/Both passwords match/)).toMatch(/: not met$/);
    });
  });

  describe("submission", () => {
    it("does not call the server for a weak password, and focuses the field", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(passwordField(), "weak");
      await user.type(confirmField(), "weak");
      await user.click(screen.getByRole("button", { name: "Reset password" }));

      expect(postMock).not.toHaveBeenCalled();
      await waitFor(() => expect(passwordField()).toHaveFocus());
    });

    it("does not call the server when the confirmation differs", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(passwordField(), GOOD);
      await user.type(confirmField(), `${GOOD}x`);
      await user.click(screen.getByRole("button", { name: "Reset password" }));

      expect(postMock).not.toHaveBeenCalled();
      await waitFor(() => expect(confirmField()).toHaveFocus());
    });

    it("sets a new password from a reset link and then returns to sign in", async () => {
      const user = userEvent.setup();
      postMock.mockResolvedValue({ data: {} });
      renderPage("?token=reset-token");

      await user.type(passwordField(), GOOD);
      await user.type(confirmField(), GOOD);
      await user.click(screen.getByRole("button", { name: "Reset password" }));

      await waitFor(() =>
        expect(postMock).toHaveBeenCalledWith("/auth/password-reset/perform", {
          token: "reset-token",
          new_password: GOOD
        })
      );
      expect(await screen.findByText("Your password has been reset.")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"), { timeout: 4000 });
    });

    it("sets a first-time password from an invitation link with the same endpoint", async () => {
      const user = userEvent.setup();
      postMock.mockResolvedValue({ data: {} });
      renderPage("?token=invite-token&flow=invitation");

      await user.type(passwordField(), GOOD);
      await user.type(confirmField(), GOOD);
      await user.click(screen.getByRole("button", { name: "Reset password" }));

      await waitFor(() =>
        expect(postMock).toHaveBeenCalledWith("/auth/password-reset/perform", {
          token: "invite-token",
          new_password: GOOD
        })
      );
      expect(await screen.findByText("Password created. You can now sign in.")).toBeInTheDocument();
    });

    it("blocks submission and explains when the link has no token", () => {
      renderPage("");

      expect(screen.getByText("This reset link is missing its token.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reset password" })).toBeDisabled();
    });

    it("shows a busy state and blocks a second submit while the request is pending", async () => {
      const user = userEvent.setup();
      let finish: (value: unknown) => void = () => undefined;
      postMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      renderPage();

      await user.type(passwordField(), GOOD);
      await user.type(confirmField(), GOOD);
      await user.click(screen.getByRole("button", { name: "Reset password" }));

      const button = await screen.findByRole("button", { name: "Reset password" });
      await waitFor(() => expect(button).toBeDisabled());
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(postMock).toHaveBeenCalledTimes(1);

      finish({ data: {} });
      await screen.findByText("Your password has been reset.");
    });
  });

  describe("server errors", () => {
    const submitValid = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(passwordField(), GOOD);
      await user.type(confirmField(), GOOD);
      await user.click(screen.getByRole("button", { name: "Reset password" }));
    };

    it("shows the server's rejection of the password on the password field and focuses it", async () => {
      const user = userEvent.setup();
      postMock.mockRejectedValue(httpError(400, "Password must be 10+ chars with upper, lower, digit, special."));
      renderPage();

      await submitValid(user);

      expect(
        await screen.findByText("Password must be 10+ chars with upper, lower, digit, special.", {
          selector: "span.text-red-500"
        })
      ).toBeInTheDocument();
      expect(passwordField()).toHaveFocus();
      expect(passwordField()).toHaveAttribute("aria-invalid", "true");
    });

    it("says plainly when the link is invalid or expired, in an alert", async () => {
      const user = userEvent.setup();
      postMock.mockRejectedValue(httpError(400, "Invalid token"));
      renderPage();

      await submitValid(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/invalid or has expired/i);
      expect(alert).not.toHaveTextContent("Invalid token");
    });

    it("keeps what was typed and offers a retry after a network failure", async () => {
      const user = userEvent.setup();
      postMock.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
      postMock.mockResolvedValueOnce({ data: {} });
      renderPage();

      await submitValid(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/could not reach the server/i);
      expect(alert.parentElement).toHaveTextContent(/password was not changed/i);
      expect(passwordField()).toHaveValue(GOOD);
      expect(confirmField()).toHaveValue(GOOD);

      await user.click(screen.getByRole("button", { name: "Reset password" }));

      await screen.findByText("Your password has been reset.");
      expect(postMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not leak server internals on a 500", async () => {
      const user = userEvent.setup();
      postMock.mockRejectedValue(httpError(500, "psycopg.errors.OperationalError: connection lost"));
      renderPage();

      await submitValid(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/something went wrong on our side/i);
      expect(alert).not.toHaveTextContent(/psycopg/);
    });

    it("clears an old error when the person tries again", async () => {
      const user = userEvent.setup();
      postMock.mockRejectedValueOnce(httpError(400, "Invalid token"));
      postMock.mockReturnValueOnce(new Promise(() => undefined));
      renderPage();

      await submitValid(user);
      await screen.findByRole("alert");
      await user.click(screen.getByRole("button", { name: "Reset password" }));

      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    });
  });

  describe("show and hide", () => {
    it("still reveals and hides each password field independently", async () => {
      const user = userEvent.setup();
      renderPage();

      const [showPassword, showConfirm] = screen.getAllByRole("button", { name: "Show" });
      await user.click(showPassword);
      expect(passwordField()).toHaveAttribute("type", "text");
      expect(confirmField()).toHaveAttribute("type", "password");

      await user.click(showConfirm);
      expect(confirmField()).toHaveAttribute("type", "text");
      await user.click(screen.getAllByRole("button", { name: "Hide" })[0]);
      expect(passwordField()).toHaveAttribute("type", "password");
    });
  });
});
