import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/components/BookingLiveMapCard", () => ({ BookingLiveMapCard: () => <div>map</div> }));
vi.mock("../PaymentRequestNotice", () => ({ PaymentRequestNotice: () => <p>payment request status</p> }));

import ImmersiveBookingView from "../ImmersiveBookingView";

const booking = (status: string) =>
  ({
    id: "b1",
    status,
    provider: { id: "p1", fullName: "Dr Example", phone: null, avatarUrl: null },
    service: { name: "Home nursing visit" },
    addressText: "Kilimani, Nairobi"
  }) as never;

const renderView = (status: string, onClose = vi.fn()) =>
  render(
    <MemoryRouter>
      <ImmersiveBookingView booking={booking(status)} onClose={onClose} onOpenChat={vi.fn()} />
    </MemoryRouter>
  );

describe("client immersive booking view on a phone", () => {
  it("renders in its own layer on the page body, above the app bar and bottom menu, with a labelled way out", () => {
    const { container } = renderView("in_service");

    expect(container).toBeEmptyDOMElement();
    expect(screen.getByRole("dialog", { name: "Your booking" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close and go back/ })).toHaveTextContent("Close");
  });

  it("closes from the Close button", () => {
    const onClose = vi.fn();
    renderView("in_service", onClose);

    fireEvent.click(screen.getByRole("button", { name: /Close and go back/ }));

    expect(onClose).toHaveBeenCalled();
  });

  it("when the visit is finished, shows where the payment request stands instead of pointing at a sheet that no longer asks anything", () => {
    renderView("completed_by_provider");

    expect(screen.getByText("Service finished")).toBeInTheDocument();
    expect(screen.getByText("payment request status")).toBeInTheDocument();
    expect(screen.queryByText(/confirm completion in the sheet below/i)).not.toBeInTheDocument();
  });

  it("lets the handle open and close the sheet", () => {
    renderView("in_service");

    fireEvent.click(screen.getByRole("button", { name: "Show more about this booking" }));

    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  });
});
