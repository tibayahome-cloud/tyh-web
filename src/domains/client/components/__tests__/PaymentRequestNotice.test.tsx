import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookState = vi.hoisted(() => ({ query: {} as Record<string, unknown> }));
vi.mock("../../../../shared/hooks/usePaymentRequest", () => ({ usePaymentRequest: () => hookState.query }));
vi.mock("../../../../shared/components/MpesaPaymentInstructions", () => ({
  MpesaPaymentInstructions: () => <p>manual steps</p>
}));

import { PaymentRequestNotice } from "../PaymentRequestNotice";

const set = (overrides: Record<string, unknown>) => {
  hookState.query = {
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    data: { state: "none", amountCents: 250000, currency: "KES", maxPrompts: 3, promptsSent: 0, payerPhoneMasked: null, ...overrides }
  };
};

const renderNotice = (showManual = false, toggle = vi.fn()) =>
  render(<PaymentRequestNotice bookingId="b1" providerName="Dr Example" showManual={showManual} onToggleManual={toggle} />);

beforeEach(() => set({}));

describe("PaymentRequestNotice", () => {
  it("before any request, says one is coming and that nothing is needed yet", () => {
    renderNotice();

    expect(screen.getByRole("status")).toHaveTextContent("Dr Example has finished the visit and will send you a payment request");
    expect(screen.getByRole("status")).toHaveTextContent("You do not need to do anything yet");
  });

  it("when a request is out, says where to approve it, with the number masked", () => {
    set({ state: "waiting", promptsSent: 1, payerPhoneMasked: "+254*****03" });
    renderNotice();

    expect(screen.getByRole("status")).toHaveTextContent("Approve the M-Pesa prompt on +254*****03");
  });

  it("offers manual payment steps only on request", () => {
    set({ state: "waiting", promptsSent: 1, payerPhoneMasked: "+254*****03" });
    const toggle = vi.fn();
    const { rerender } = renderNotice(false, toggle);
    expect(screen.queryByText("manual steps")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Not seeing the prompt? Pay manually" }));
    expect(toggle).toHaveBeenCalled();

    rerender(<PaymentRequestNotice bookingId="b1" providerName="Dr Example" showManual onToggleManual={toggle} />);
    expect(screen.getByText("manual steps")).toBeInTheDocument();
  });

  it("explains a failed or exhausted request without asking the client for a number", () => {
    set({ state: "failed", promptsSent: 1 });
    const { unmount } = renderNotice();
    expect(screen.getByRole("status")).toHaveTextContent("can send the request again");
    unmount();

    set({ state: "exhausted", promptsSent: 3 });
    renderNotice();
    expect(screen.getByRole("status")).toHaveTextContent("The facility will get in touch");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
