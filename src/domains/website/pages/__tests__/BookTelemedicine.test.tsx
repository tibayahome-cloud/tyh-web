/**
 * The public page where a visitor who is not signed in starts booking a remote consultation.
 *
 * The page is only the doorway: the booking dialog does the work, and these tests pin what the doorway must do. It opens
 * the booking at once (the visitor already said what they want by tapping "Talk to a doctor"), it can be reopened after
 * the dialog is closed (closing must not strand anyone on an empty page), and it takes the person to their booking when
 * one has been made.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../client/components/TelemedicineRequestDialog", () => ({
  TelemedicineRequestDialog: ({
    open,
    onClose,
    onCreated
  }: {
    open: boolean;
    onClose: () => void;
    onCreated?: (bookingId: string) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Book a remote consultation">
        <button type="button" onClick={onClose}>
          Close booking
        </button>
        <button type="button" onClick={() => onCreated?.("booking-42")}>
          Booking made
        </button>
      </div>
    ) : null
}));

import { BookTelemedicine } from "../BookTelemedicine";

const BookingPage = () => {
  const { id } = useParams();
  return <p>{`booking page for ${id}`}</p>;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/book/telemedicine"]}>
      <Routes>
        <Route path="/book/telemedicine" element={<BookTelemedicine />} />
        <Route path="/app/bookings/:id" element={<BookingPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("the public booking page", () => {
  it("opens the booking straight away", () => {
    renderPage();

    expect(screen.getByRole("dialog", { name: "Book a remote consultation" })).toBeInTheDocument();
  });

  it("says what it is for and when details are asked for", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Talk to a doctor online" })).toBeInTheDocument();
    expect(screen.getByText(/pay with M-Pesa/i)).toBeInTheDocument();
    expect(screen.getByText(/only once you have chosen a time/i)).toBeInTheDocument();
  });

  it("stays on the page when the booking is closed, with a button to open it again", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Close booking" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Talk to a doctor online" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Choose a consultation" }));

    expect(screen.getByRole("dialog", { name: "Book a remote consultation" })).toBeInTheDocument();
  });

  it("takes the person to their booking once it is made", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Booking made" }));

    expect(screen.getByText("booking page for booking-42")).toBeInTheDocument();
  });
});
