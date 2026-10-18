import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { formatCancellationReason } from "../../../../shared/constants/bookings";
import { CancelBookingDialog } from "../CancelBookingDialog";

const renderDialog = (props: Partial<React.ComponentProps<typeof CancelBookingDialog>> = {}) => {
  const onConfirm = vi.fn();
  render(<CancelBookingDialog open onClose={() => undefined} onConfirm={onConfirm} {...props} />);
  return onConfirm;
};

describe("CancelBookingDialog", () => {
  it("starts with no reason chosen and will not cancel until one is", async () => {
    const user = userEvent.setup();
    const onConfirm = renderDialog();
    expect(screen.getByRole("combobox", { name: /Reason/ })).toHaveValue("");
    const confirm = screen.getByRole("button", { name: "Cancel booking" });
    expect(confirm).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: /Reason/ }), "scheduling_conflict");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(expect.stringContaining("[scheduling_conflict]"));
  });

  it("requires a note when the reason is Other", async () => {
    const user = userEvent.setup();
    const onConfirm = renderDialog();
    await user.selectOptions(screen.getByRole("combobox", { name: /Reason/ }), "other");
    expect(screen.getByRole("button", { name: "Cancel booking" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /Note/ }), "Duplicate booking");
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(onConfirm).toHaveBeenCalledWith(expect.stringContaining("Duplicate booking"));
  });

  it("warns that cancelling a paid telemedicine booking cannot be undone and sends the payment to review", () => {
    renderDialog({ paidTelemedicine: true });
    const warning = screen.getByRole("alert");
    expect(warning).toHaveTextContent(/already paid/i);
    expect(warning).toHaveTextContent(/cannot be undone/i);
    expect(warning).toHaveTextContent(/payment\s+goes to review/i);
  });

  it("shows no warning for an unpaid or home-care booking", () => {
    renderDialog({ paidTelemedicine: false });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers Keep booking rather than a second Cancel", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Keep booking" })).toBeInTheDocument();
  });
});

describe("formatCancellationReason", () => {
  it("says an administrator cancelled it, never that the client did", () => {
    const text = formatCancellationReason("client_request");
    expect(text).toContain("cancelled by an administrator");
    expect(text).not.toMatch(/^\[client_request\] Client requested cancellation$/);
  });

  it("keeps the internal note", () => {
    expect(formatCancellationReason("scheduling_conflict", "Room double-booked")).toMatch(/- Room double-booked$/);
  });
});
