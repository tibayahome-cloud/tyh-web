/**
 * An ambulance is paid for before it is sent. After the request, the page follows the M-Pesa prompt: it waits, says when
 * the payment failed and sends the prompt again, says when the request lapsed, and moves on once it is paid.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchAmbulancePayment: vi.fn(), resendAmbulancePayment: vi.fn() }));
vi.mock("../../../../../shared/libs/homeCarePublic", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../shared/libs/homeCarePublic")>()),
  ...api
}));

import type { AmbulancePayment, HomeCareRequestResult } from "../../../../../shared/libs/homeCarePublic";
import { DoneStep } from "../DoneStep";
import { PayStep } from "../PayStep";

const payment = (state: AmbulancePayment["state"]): AmbulancePayment => ({
  state,
  amount_cents: 805000,
  currency: "KES",
  payer_phone_masked: "0712***678",
  can_resend_at: null,
  pay_by: "2026-11-27T10:00:00Z",
  sent_to_facility: state === "paid"
});

const result = (state: AmbulancePayment["state"]): HomeCareRequestResult => ({
  booking_id: "abcd1234-0000",
  reference: "abcd1234",
  status: "ambulance_payment_pending",
  scheduled_at: null,
  facility: { id: "fac-1", name: "OCOA Ambulance Services" },
  price_cents: 805000,
  currency: "KES",
  account_created: true,
  payment: payment(state)
});

const renderStep = (state: AmbulancePayment["state"], onPaid = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <PayStep result={result(state)} phone="0712345678" onPaid={onPaid} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return onPaid;
};

beforeEach(() => {
  api.fetchAmbulancePayment.mockReset();
  api.resendAmbulancePayment.mockReset();
});

describe("paying for the ambulance", () => {
  it("asks for the M-Pesa PIN for the facility's price and says the ambulance is sent once paid", () => {
    api.fetchAmbulancePayment.mockResolvedValue(payment("waiting"));
    renderStep("waiting");

    expect(screen.getByRole("heading", { name: /Pay Ksh\s?8,050 to send the ambulance/ })).toBeInTheDocument();
    expect(screen.getByText(/Check your phone \(0712\*\*\*678\) and enter your M-Pesa PIN/)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/OCOA Ambulance Services sends the ambulance once you have paid/);
    expect(screen.getByText(/or the request lapses/)).toBeInTheDocument();
  });

  it("moves on once M-Pesa confirms the payment", async () => {
    api.fetchAmbulancePayment.mockResolvedValue(payment("paid"));
    const onPaid = renderStep("paid");

    await waitFor(() => expect(onPaid).toHaveBeenCalled());
  });

  it("says when the payment failed and sends the prompt again to the same phone", async () => {
    api.fetchAmbulancePayment.mockResolvedValue(payment("failed"));
    api.resendAmbulancePayment.mockResolvedValue(payment("sending"));
    const user = userEvent.setup();
    renderStep("failed");

    expect(screen.getByRole("heading", { name: "The payment did not go through" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send the prompt again" }));

    expect(api.resendAmbulancePayment).toHaveBeenCalledWith("abcd1234-0000", "0712345678");
  });

  it("says to call when the prompt has been sent too many times", () => {
    api.fetchAmbulancePayment.mockResolvedValue(payment("exhausted"));
    renderStep("exhausted");

    expect(screen.queryByRole("button", { name: /Send the prompt again/ })).not.toBeInTheDocument();
    expect(screen.getByText(/sent too many times/)).toBeInTheDocument();
  });

  it("says a lapsed request was not charged and offers a new one", () => {
    api.fetchAmbulancePayment.mockResolvedValue(payment("expired"));
    renderStep("expired");

    expect(screen.getByRole("heading", { name: "This request was not paid in time" })).toBeInTheDocument();
    expect(screen.getByText(/nothing was charged/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Make a new request" })).toHaveAttribute("href", "/book/home-care?care=ambulance");
  });
});

describe("the confirmation", () => {
  it("says an ambulance has been paid for, and home care is still paid after the visit", () => {
    const { unmount } = render(
      <MemoryRouter>
        <DoneStep result={result("paid")} serviceName="Advanced life support" phone="0712345678" ambulance />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Paid. Your ambulance request is with the facility" })).toBeInTheDocument();
    expect(screen.getByText(/You have paid Ksh\s?8,050\./)).toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter>
        <DoneStep result={{ ...result("paid"), payment: null }} serviceName="Wound dressing" phone="0712345678" />
      </MemoryRouter>
    );
    expect(screen.getByText(/paid after the visit/)).toBeInTheDocument();
  });
});
