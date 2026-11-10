/**
 * The sign-up page and the booking's details step share one form. The booking hands someone whose number already has an
 * account over to signing in; the sign-up page does not pass that hand-over, so it keeps showing the server's refusal on
 * the form, as it always has.
 */

import { render, screen } from "@testing-library/react";
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
        "auth.fullName": "Full name",
        "auth.password": "Password",
        "auth.signUpError": "We could not complete your registration.",
        "auth.signUpCta": "Create account"
      })[key] ?? key
  })
}));

import { SignUp } from "../SignUp";

const refused = (message: string) =>
  new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: {} as never,
    data: { error: { code: 400, name: "Bad Request", message } }
  });

describe("signing up with a number that already has an account, on the sign-up page", () => {
  beforeEach(() => {
    postMock.mockReset();
    loginClientProviderMock.mockReset();
  });

  it("shows the refusal on the form and does not sign anyone in", async () => {
    postMock.mockRejectedValue(refused("Phone already in use"));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
          <Route path="*" element={<p>somewhere else</p>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/^Full name/), "Jane Client");
    await user.type(screen.getByLabelText(/^Phone/), "0712 345 678");
    await user.type(screen.getByLabelText(/^Password/), "Ab1!xy");
    for (const box of screen.getAllByRole("checkbox")) {
      await user.click(box);
    }
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Phone already in use")).toBeInTheDocument();
    expect(loginClientProviderMock).not.toHaveBeenCalled();
    expect(screen.queryByText("somewhere else")).not.toBeInTheDocument();
  });
});
