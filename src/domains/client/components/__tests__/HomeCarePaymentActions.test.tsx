/**
 * Paying for a completed home-care visit: the saved number is the default, a different number is
 * for this payment only, the number that will be charged is always spelled out, and nothing is
 * sent until the choice is valid.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HomeCarePaymentActions } from "../HomeCarePaymentActions";

type Props = Partial<Parameters<typeof HomeCarePaymentActions>[0]>;

const renderActions = (props: Props = {}) => {
  const onConfirm = vi.fn();
  const onDecline = vi.fn();
  const utils = render(
    <HomeCarePaymentActions
      savedPhone="+254712345678"
      amountCents={250000}
      isPending={false}
      failed={false}
      resetKey="booking-1"
      onConfirm={onConfirm}
      onDecline={onDecline}
      {...props}
    />
  );
  return { onConfirm, onDecline, ...utils };
};

const summary = () => screen.getByRole("status");

describe("home-care payment", () => {
  describe("default: the saved number", () => {
    it("selects the saved number and says who will be charged and how much", () => {
      renderActions();

      expect(screen.getByRole("radio", { name: /My saved number/ })).toBeChecked();
      expect(screen.getByText("0712 345 678", { selector: "span.block" })).toBeInTheDocument();
      expect(summary()).toHaveTextContent(/M-Pesa will ask 0712 345 678 to pay/);
      expect(summary()).toHaveTextContent(/2,500\.00/);
      expect(screen.queryByLabelText(/Number to charge/)).not.toBeInTheDocument();
    });

    it("charges the normalised saved number when confirmed", async () => {
      const user = userEvent.setup();
      const { onConfirm } = renderActions();

      await user.click(screen.getByRole("button", { name: "Confirm & pay" }));

      expect(onConfirm).toHaveBeenCalledWith("254712345678");
    });

    it("accepts a saved number stored in local format", async () => {
      const user = userEvent.setup();
      const { onConfirm } = renderActions({ savedPhone: "0722000111" });

      await user.click(screen.getByRole("button", { name: "Confirm & pay" }));

      expect(onConfirm).toHaveBeenCalledWith("254722000111");
    });
  });

  describe("a different number, for this payment only", () => {
    it("reveals a phone field and says the saved number is not changed once a valid number is entered", async () => {
      const user = userEvent.setup();
      renderActions();

      await user.click(screen.getByRole("radio", { name: /A different number/ }));
      const field = screen.getByLabelText(/Number to charge/);
      expect(field).toHaveAttribute("type", "tel");
      expect(field).toHaveAttribute("inputmode", "tel");
      expect(summary()).toHaveTextContent("Choose a number to see who will be charged.");

      await user.type(field, "0722 000 111");

      expect(summary()).toHaveTextContent(/M-Pesa will ask 0722 000 111 to pay/);
      expect(summary()).toHaveTextContent(/Your saved number, 0712 345 678, is not changed\./);
    });

    it("validates and normalises what was typed before submitting", async () => {
      const user = userEvent.setup();
      const { onConfirm } = renderActions();

      await user.click(screen.getByRole("radio", { name: /A different number/ }));
      await user.type(screen.getByLabelText(/Number to charge/), "+254 722-000-111");
      await user.click(screen.getByRole("button", { name: "Confirm & pay" }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith("254722000111");
    });

    it("blocks an empty or invalid number and explains why, without calling onConfirm", async () => {
      const user = userEvent.setup();
      const { onConfirm } = renderActions();

      await user.click(screen.getByRole("radio", { name: /A different number/ }));
      await user.click(screen.getByRole("button", { name: "Confirm & pay" }));
      expect(await screen.findByText(/M-Pesa phone number is required/i)).toBeInTheDocument();

      await user.type(screen.getByLabelText(/Number to charge/), "0612345678");
      expect(await screen.findByText(/Enter a valid Safaricom number/i)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Confirm & pay" }));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(summary()).toHaveTextContent("Choose a number to see who will be charged.");
    });

    it("does not nag before the person has finished typing", async () => {
      const user = userEvent.setup();
      renderActions();

      await user.click(screen.getByRole("radio", { name: /A different number/ }));

      expect(screen.queryByText(/required|valid Safaricom/i)).not.toBeInTheDocument();
    });

    it("goes back to the saved number when chosen again, keeping the saved number as the charge", async () => {
      const user = userEvent.setup();
      const { onConfirm } = renderActions();

      await user.click(screen.getByRole("radio", { name: /A different number/ }));
      await user.type(screen.getByLabelText(/Number to charge/), "0722000111");
      await user.click(screen.getByRole("radio", { name: /My saved number/ }));
      await user.click(screen.getByRole("button", { name: "Confirm & pay" }));

      expect(onConfirm).toHaveBeenCalledWith("254712345678");
    });

    it("keeps what was typed when the booking data refreshes but is still the same booking", async () => {
      const user = userEvent.setup();
      const { rerender } = renderActions();
      await user.click(screen.getByRole("radio", { name: /A different number/ }));
      await user.type(screen.getByLabelText(/Number to charge/), "0722000111");

      rerender(
        <HomeCarePaymentActions
          savedPhone="+254712345678"
          amountCents={250000}
          isPending={false}
          failed={false}
          resetKey="booking-1"
          onConfirm={vi.fn()}
          onDecline={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/Number to charge/)).toHaveValue("0722000111");
    });

    it("starts again from the saved number for a different booking", async () => {
      const user = userEvent.setup();
      const { rerender } = renderActions();
      await user.click(screen.getByRole("radio", { name: /A different number/ }));
      await user.type(screen.getByLabelText(/Number to charge/), "0722000111");

      rerender(
        <HomeCarePaymentActions
          savedPhone="+254712345678"
          amountCents={250000}
          isPending={false}
          failed={false}
          resetKey="booking-2"
          onConfirm={vi.fn()}
          onDecline={vi.fn()}
        />
      );

      expect(screen.getByRole("radio", { name: /My saved number/ })).toBeChecked();
      expect(screen.queryByLabelText(/Number to charge/)).not.toBeInTheDocument();
    });
  });

  describe("no usable saved number", () => {
    it.each([null, undefined, "", "+447700900123"])("asks for a number when the saved one is %j", async (savedPhone) => {
      const user = userEvent.setup();
      const { onConfirm } = renderActions({ savedPhone });

      expect(screen.queryByRole("radio", { name: /My saved number/ })).not.toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /A different number/ })).toBeChecked();
      expect(screen.getByText("Enter the Safaricom number to pay with.")).toBeInTheDocument();

      await user.type(screen.getByLabelText(/Number to charge/), "0712345678");
      await user.click(screen.getByRole("button", { name: "Confirm & pay" }));

      expect(onConfirm).toHaveBeenCalledWith("254712345678");
      expect(summary()).not.toHaveTextContent(/is not changed/);
    });
  });

  describe("loading, failure and retry", () => {
    it("locks the choice and shows progress while the request is pending", () => {
      renderActions({ isPending: true });

      const confirm = screen.getByRole("button", { name: "Confirm & pay" });
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: /My saved number/ })).toBeDisabled();
      expect(screen.getByRole("radio", { name: /A different number/ })).toBeDisabled();
    });

    it("offers Try again after a failure and keeps the entered number", async () => {
      const user = userEvent.setup();
      const { onConfirm, rerender } = renderActions();
      await user.click(screen.getByRole("radio", { name: /A different number/ }));
      await user.type(screen.getByLabelText(/Number to charge/), "0722000111");

      rerender(
        <HomeCarePaymentActions
          savedPhone="+254712345678"
          amountCents={250000}
          isPending={false}
          failed
          resetKey="booking-1"
          onConfirm={onConfirm}
          onDecline={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/Number to charge/)).toHaveValue("0722000111");
      await user.click(screen.getByRole("button", { name: "Try again" }));
      expect(onConfirm).toHaveBeenCalledWith("254722000111");
    });

    it("declines without needing a valid number", async () => {
      const user = userEvent.setup();
      const { onDecline, onConfirm } = renderActions({ savedPhone: null });

      await user.click(screen.getByRole("button", { name: "Decline" }));

      expect(onDecline).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  it("uses a labelled group and 44px targets", () => {
    renderActions();

    expect(screen.getByRole("group", { name: "Pay with" })).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio.closest("label") as HTMLElement).className).toContain("min-h-11");
    }
  });
});
