/**
 * The public page where a visitor who is not signed in books a remote consultation.
 *
 * The booking is the page itself, not a popup over an empty page: the visitor already said what they want by tapping
 * "Talk to a doctor", and there is nothing underneath to go back to. The dialog does the work, so these tests pin only
 * what the page must do around it: lay the booking out as a page, send "close" home, and take the person to their booking
 * when one has been made.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const { receivedProps } = vi.hoisted(() => ({
  receivedProps: { current: null as null | Record<string, unknown> }
}));

vi.mock("../../../client/components/TelemedicineRequestDialog", () => ({
  TelemedicineRequestDialog: (props: {
    open: boolean;
    layout?: string;
    onClose: () => void;
    onCreated?: (bookingId: string) => void;
  }) => {
    receivedProps.current = props;
    return (
      <div data-testid="booking" data-layout={props.layout} data-open={String(props.open)}>
        <button type="button" onClick={props.onClose}>
          Leave the booking
        </button>
        <button type="button" onClick={() => props.onCreated?.("booking-42")}>
          Booking made
        </button>
      </div>
    );
  }
}));

import { BookTelemedicine } from "../BookTelemedicine";

const Where = ({ label }: { label: string }) => {
  const { id } = useParams();
  return <p>{id ? `${label} ${id}` : label}</p>;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/book/telemedicine"]}>
      <Routes>
        <Route path="/" element={<Where label="landing page" />} />
        <Route path="/book/telemedicine" element={<BookTelemedicine />} />
        <Route path="/app/bookings/:id" element={<Where label="booking page" />} />
      </Routes>
    </MemoryRouter>
  );

describe("the public booking page", () => {
  it("is the booking itself, laid out as a page and not as a popup", () => {
    renderPage();

    const booking = screen.getByTestId("booking");
    expect(booking).toHaveAttribute("data-layout", "page");
    expect(booking).toHaveAttribute("data-open", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no page of its own behind the booking: no heading and no button to open it", () => {
    renderPage();

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /choose a consultation/i })).not.toBeInTheDocument();
  });

  it("sends the person home when the booking is closed, since there is no page behind it to stay on", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Leave the booking" }));

    expect(screen.getByText("landing page")).toBeInTheDocument();
  });

  it("takes the person to their booking once it is made", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Booking made" }));

    expect(screen.getByText("booking page booking-42")).toBeInTheDocument();
  });
});
