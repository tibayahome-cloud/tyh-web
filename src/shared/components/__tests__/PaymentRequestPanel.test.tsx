/**
 * The provider's side of getting paid for a home visit: send one request, see where it stands, and only be offered
 * what the server would accept (not while a prompt is out, not inside the 60 seconds, not past three).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookState = vi.hoisted(() => ({ query: {} as Record<string, unknown>, mutate: vi.fn(), send: {} as Record<string, unknown> }));
vi.mock("../../hooks/usePaymentRequest", () => ({
  usePaymentRequest: () => hookState.query,
  useSendPaymentRequest: () => ({ mutate: hookState.mutate, isPending: false, error: null, ...hookState.send })
}));

import { PaymentRequestPanel } from "../PaymentRequestPanel";

const base = {
  state: "none",
  amountCents: 250000,
  currency: "KES",
  maxPrompts: 3,
  promptsSent: 0,
  payerPhoneMasked: null,
  sentAt: null,
  canResendAt: null
};

const setState = (overrides: Record<string, unknown> = {}) => {
  hookState.query = { isPending: false, isError: false, data: { ...base, ...overrides }, refetch: vi.fn() };
};

const renderPanel = () => render(<PaymentRequestPanel bookingId="b1" clientName="Amina" />);

beforeEach(() => {
  hookState.mutate.mockReset();
  hookState.send = {};
  setState();
});

describe("PaymentRequestPanel", () => {
  it("asks for the amount, in shillings, and sends to the number on the account by default", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "Send payment request for KES 2,500" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Send payment request for/ }));
    expect(hookState.mutate).toHaveBeenCalledWith(undefined);
  });

  it("sends to a different number, normalised, only once it is a valid Safaricom number", () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("A different number"));
    const field = screen.getByLabelText(/Number to charge/);

    fireEvent.change(field, { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /Send payment request/ }));
    expect(hookState.mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter a valid Safaricom number/)).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "0712 345 678" } });
    fireEvent.click(screen.getByRole("button", { name: /Send payment request/ }));
    expect(hookState.mutate).toHaveBeenCalledWith("+254712345678");
  });

  it("while the client is deciding, shows the masked number and offers no second send", () => {
    setState({ state: "waiting", promptsSent: 1, payerPhoneMasked: "+254*****03" });
    renderPanel();

    expect(screen.getByText("Waiting for Amina to approve")).toBeInTheDocument();
    expect(screen.getByText(/Sent to \+254\*{5}03\. Request 1 of 3/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send/ })).not.toBeInTheDocument();
  });

  it("after a failure, counts down the minute before it can be sent again", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T10:00:00Z"));
    setState({ state: "failed", promptsSent: 1, canResendAt: "2026-10-21T10:00:42Z" });
    renderPanel();

    expect(screen.getByRole("button", { name: "Send again in 42 s" })).toBeDisabled();
    vi.useRealTimers();
  });

  it("offers a resend once the wait is over", () => {
    setState({ state: "failed", promptsSent: 1, canResendAt: "2020-01-01T00:00:00Z" });
    renderPanel();

    expect(screen.getByRole("button", { name: "Send the request again" })).toBeEnabled();
  });

  it("says the limit was reached and offers nothing more", () => {
    setState({ state: "exhausted", promptsSent: 3 });
    renderPanel();

    expect(screen.getByText("The payment was not completed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send/ })).not.toBeInTheDocument();
  });

  it("shows the visit as paid", () => {
    setState({ state: "paid" });
    renderPanel();

    expect(screen.getByRole("status")).toHaveTextContent("Amina paid");
  });

  it("names the failure and offers a retry when the state cannot be loaded", () => {
    hookState.query = { isPending: false, isError: true, data: undefined, refetch: vi.fn() };
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent("could not check");
  });
});
