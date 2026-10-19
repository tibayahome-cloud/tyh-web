/**
 * The prompt called phone verification "required" (it is optional), said "Code sent" as soon as the request was
 * queued even when the text never went, accepted four to six characters of anything, and had no way to correct a
 * wrong number. These pin the honest version.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const auth = vi.hoisted(() => ({ bootstrapMe: vi.fn() }));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../libs/api", () => ({ api, default: api }));
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ user: { phone: "+254712345678" }, bootstrapMe: auth.bootstrapMe })
}));
vi.mock("../ToastProvider", () => ({ useToast: () => toast }));

import { PhoneVerificationPrompt } from "../PhoneVerificationPrompt";

const apiError = (status: number, message: string) =>
  new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {},
    data: { error: { message } }
  } as never);

const renderPrompt = (props: Partial<React.ComponentProps<typeof PhoneVerificationPrompt>> = {}) => {
  const onClose = vi.fn();
  const onVerified = vi.fn();
  render(
    <MemoryRouter initialEntries={["/home"]}>
      <Routes>
        <Route path="/home" element={<PhoneVerificationPrompt open onClose={onClose} onVerified={onVerified} {...props} />} />
        <Route path="/app/profile" element={<p>PROFILE PAGE</p>} />
      </Routes>
    </MemoryRouter>
  );
  return { onClose, onVerified };
};

const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  api.post.mockResolvedValue({ data: {} });
  api.get.mockResolvedValue({ data: { data: { delivery: "sent" } } });
  auth.bootstrapMe.mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

const requestCode = async (user: ReturnType<typeof setup>) => {
  await user.click(screen.getByRole("button", { name: "Send code" }));
  await screen.findByText(/We sent a 6-digit code/);
};

describe("PhoneVerificationPrompt", () => {
  it("does not claim verification is required, and shows the number masked", () => {
    renderPrompt();
    expect(screen.getByText("Confirm your phone number")).toBeInTheDocument();
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
    expect(screen.getByText("We will text a 6-digit code to +254****678.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
  });

  it("asks for a code and says 'sent' only once the server says it was sent", async () => {
    api.get.mockResolvedValueOnce({ data: { data: { delivery: "pending" } } });
    const user = setup();
    renderPrompt();

    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Sending your code…")).toBeInTheDocument();
    expect(screen.queryByText(/We sent a 6-digit code/)).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(2100));
    expect(await screen.findByText("We sent a 6-digit code to +254****678.")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/auth/verify/phone/init");
  });

  it("says it could not send, and offers to try again, when the code was not sent", async () => {
    api.get.mockResolvedValue({ data: { data: { delivery: "failed" } } });
    const user = setup();
    renderPrompt();

    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("We could not send the code right now. Try again shortly.")).toBeInTheDocument();
    expect(screen.queryByText(/We sent a 6-digit code/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it("keeps the old 'sent' wording against an API that has no status call", async () => {
    api.get.mockRejectedValue(apiError(404, "Not found"));
    const user = setup();
    renderPrompt();
    await requestCode(user);
  });

  it("takes only a six-digit code: numeric keyboard, one-time-code autofill, digits only, Confirm only at six", async () => {
    const user = setup();
    renderPrompt();
    await requestCode(user);

    const input = screen.getByLabelText("Verification code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("maxlength", "6");

    const confirm = screen.getByRole("button", { name: "Confirm phone" });
    await user.type(input, "12 34");
    expect(input).toHaveValue("1234");
    expect(confirm).toBeDisabled();

    await user.type(input, "5-6");
    expect(input).toHaveValue("123456");
    expect(confirm).toBeEnabled();
  });

  it("confirms the code, refreshes the user and reports it", async () => {
    const user = setup();
    const { onVerified, onClose } = renderPrompt();
    await requestCode(user);

    await user.type(screen.getByLabelText("Verification code"), "654321");
    await user.click(screen.getByRole("button", { name: "Confirm phone" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/auth/verify/phone/confirm", { code: "654321" }));
    await waitFor(() => expect(auth.bootstrapMe).toHaveBeenCalled());
    expect(onVerified).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows what the server said when the code is wrong or used up", async () => {
    const user = setup();
    renderPrompt();
    await requestCode(user);
    api.post.mockRejectedValueOnce(apiError(400, "Too many wrong attempts. Request a new code."));

    await user.type(screen.getByLabelText("Verification code"), "000000");
    await user.click(screen.getByRole("button", { name: "Confirm phone" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many wrong attempts. Request a new code.");
  });

  it("makes the person wait before asking for another code, and counts down", async () => {
    const user = setup();
    renderPrompt();
    await requestCode(user);

    const resend = screen.getByRole("button", { name: /Send a new code in \d+s/ });
    expect(resend).toBeDisabled();

    // One tick at a time: each second schedules the next only after React has re-rendered.
    for (let second = 0; second < 31; second += 1) {
      await act(() => vi.advanceTimersByTimeAsync(1000));
    }
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeEnabled();
  });

  it("lets someone with the wrong number go and change it", async () => {
    const user = setup();
    renderPrompt();
    await requestCode(user);

    await user.click(screen.getByRole("button", { name: "Wrong number? Change it" }));
    expect(await screen.findByText("PROFILE PAGE")).toBeInTheDocument();
  });

  it("sends someone with no number on file to their profile", async () => {
    api.post.mockRejectedValueOnce(apiError(400, "No phone number on file. Please update your profile first."));
    const user = setup();
    renderPrompt();

    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Add a phone number to your profile first.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to profile" }));
    expect(await screen.findByText("PROFILE PAGE")).toBeInTheDocument();
  });
});
