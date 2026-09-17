/**
 * Component-level coverage for the payout-destination verification UI: the real OTP flow
 * (format-valid entry, in-progress, OTP required, OTP failed/expired, verified-and-locked) plus
 * the speculative lookup states, exercised here via an injected `lookupDestination` double --
 * never a real endpoint. Confirms the exact confirmation copy the product asked for
 * ("Send payout to ...", "Account name: ...") and that no raw IMSI/internal id ever renders.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PayoutDestinationVerifier } from "../PayoutDestinationVerifier";

vi.mock("../../libs/payoutDestinationVerification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../libs/payoutDestinationVerification")>();
  return { ...actual, MPESA_DESTINATION_LOOKUP_ENABLED: true };
});

const typePhone = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  const input = screen.getByLabelText(/m-pesa payout number/i);
  await user.clear(input);
  await user.type(input, value);
};

describe("PayoutDestinationVerifier", () => {
  it("shows a format error for an implausible number and disables Send code", async () => {
    const user = userEvent.setup();
    render(
      <PayoutDestinationVerifier
        requestCode={vi.fn()}
        verifyCode={vi.fn()}
      />
    );

    await typePhone(user, "123");

    expect(screen.getByText(/enter a valid kenyan mobile number/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send code/i })).toBeDisabled();
  });

  it("enables Send code once the number is format-valid", async () => {
    const user = userEvent.setup();
    render(<PayoutDestinationVerifier requestCode={vi.fn()} verifyCode={vi.fn()} />);

    await typePhone(user, "0712345678");

    expect(screen.getByRole("button", { name: /send code/i })).toBeEnabled();
  });

  it("shows an in-progress state while the code is being requested", async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: { phone_masked: string; verified: boolean }) => void = () => {};
    const requestCode = vi.fn(
      () => new Promise<{ phone_masked: string; verified: boolean }>((resolve) => { resolveRequest = resolve; })
    );

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={vi.fn()} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(screen.getByRole("button", { name: /send code/i })).toBeDisabled();

    resolveRequest({ phone_masked: "07** ***678", verified: false });
    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument());
  });

  it("moves to OTP required after a code is sent for an unverified number", async () => {
    const user = userEvent.setup();
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: false });

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={vi.fn()} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByText(/we sent a code to 07\*\* \*\*\*678/i)).toBeInTheDocument();
    expect(requestCode).toHaveBeenCalledWith("0712345678");
  });

  it("shows the verified-and-locked confirmation with the exact requested copy", async () => {
    const user = userEvent.setup();
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: false });
    const verifyCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: true });
    const onVerified = vi.fn();

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={verifyCode} onVerified={onVerified} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));
    await screen.findByLabelText(/verification code/i);

    await user.type(screen.getByLabelText(/verification code/i), "123456");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    expect(await screen.findByText("Send payout to 07** ***678")).toBeInTheDocument();
    expect(verifyCode).toHaveBeenCalledWith("0712345678", "123456");
    expect(onVerified).toHaveBeenCalledWith({ phone_masked: "07** ***678", verified: true }, "0712345678");
  });

  it("skips straight to verified-and-locked when the backend reports the number already verified", async () => {
    const user = userEvent.setup();
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: true });

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={vi.fn()} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByText("Send payout to 07** ***678")).toBeInTheDocument();
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
  });

  it("shows distinct copy for an expired code versus an invalid one, and offers to resend", async () => {
    const user = userEvent.setup();
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: false });
    const verifyCode = vi.fn().mockRejectedValue(new Error("This code has expired"));

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={verifyCode} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));
    await screen.findByLabelText(/verification code/i);

    await user.type(screen.getByLabelText(/verification code/i), "000000");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    expect(await screen.findByText(/that code has expired/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send a new code/i })).toBeInTheDocument();
  });

  it("shows invalid-code copy when the backend error doesn't mention expiry", async () => {
    const user = userEvent.setup();
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: false });
    const verifyCode = vi.fn().mockRejectedValue(new Error("Incorrect code"));

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={verifyCode} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));
    await screen.findByLabelText(/verification code/i);

    await user.type(screen.getByLabelText(/verification code/i), "000000");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    expect(await screen.findByText(/that code didn't work/i)).toBeInTheDocument();
  });

  it("shows the Safaricom-confirmed lookup outcome without blocking the OTP flow", async () => {
    const user = userEvent.setup();
    const lookupDestination = vi.fn().mockResolvedValue({
      outcome: "verified_safaricom",
      phone_masked: "07** ***678",
      account_name: null
    });
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: false });

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={vi.fn()} lookupDestination={lookupDestination} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByText(/safaricom number confirmed/i)).toBeInTheDocument();
    expect(lookupDestination).toHaveBeenCalledWith("0712345678");
    // The OTP flow still proceeds regardless of the lookup outcome.
    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it("shows the unsupported-network outcome without blocking the flow", async () => {
    const user = userEvent.setup();
    const lookupDestination = vi.fn().mockResolvedValue({
      outcome: "unsupported_network",
      phone_masked: "07** ***678",
      account_name: null
    });
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: false });

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={vi.fn()} lookupDestination={lookupDestination} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByText(/doesn't look like a safaricom number/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it("shows a returned account name for confirmation, using only the backend's own value", async () => {
    const user = userEvent.setup();
    const lookupDestination = vi.fn().mockResolvedValue({
      outcome: "name_verified",
      phone_masked: "07** ***678",
      account_name: "Willis Raburu"
    });
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: false });

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={vi.fn()} lookupDestination={lookupDestination} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByText("Account name: Willis Raburu")).toBeInTheDocument();
  });

  it("shows a name-unavailable note without ever fabricating a name", async () => {
    const user = userEvent.setup();
    const lookupDestination = vi.fn().mockResolvedValue({
      outcome: "name_unavailable",
      phone_masked: "07** ***678",
      account_name: null
    });
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: false });

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={vi.fn()} lookupDestination={lookupDestination} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByText(/couldn't confirm an account name/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Account name:/)).not.toBeInTheDocument();
  });

  it("shows a lookup-unavailable note and still allows sending the code", async () => {
    const user = userEvent.setup();
    const lookupDestination = vi.fn().mockRejectedValue(new Error("network error"));
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: false });

    render(<PayoutDestinationVerifier requestCode={requestCode} verifyCode={vi.fn()} lookupDestination={lookupDestination} />);
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByText(/couldn't check this number right now/i)).toBeInTheDocument();
    expect(requestCode).toHaveBeenCalled();
  });

  it("never renders a raw IMSI, internal id, or api payload", async () => {
    const user = userEvent.setup();
    const lookupDestination = vi.fn().mockResolvedValue({
      outcome: "name_verified",
      phone_masked: "07** ***678",
      account_name: "Willis Raburu"
    });
    const requestCode = vi.fn().mockResolvedValue({ phone_masked: "07** ***678", verified: true });

    const { container } = render(
      <PayoutDestinationVerifier requestCode={requestCode} verifyCode={vi.fn()} lookupDestination={lookupDestination} />
    );
    await typePhone(user, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));
    await screen.findByText("Send payout to 07** ***678");

    expect(container.textContent).not.toMatch(/imsi/i);
    expect(container.textContent).not.toMatch(/[0-9a-f]{24,}/i); // no raw hex/object ids
  });
});
