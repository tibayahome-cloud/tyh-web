/**
 * "Confirm your phone number" is not needed to book, so a client is not asked on their first screen. They are asked once
 * they have booked: the next time they open the app, never while a payment is still waiting on them. Providers are asked
 * straight away, as before.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestUser = { id: string; phone: string | null; phoneVerifiedAt: string | null };

const { auth, bookingList } = vi.hoisted(() => ({
  auth: { user: null as TestUser | null, isAuthenticated: true },
  bookingList: vi.fn()
}));

vi.mock("../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: auth.user, isAuthenticated: auth.isAuthenticated })
}));
vi.mock("../../shared/hooks/useBookings", () => ({
  useBookingList: (...args: unknown[]) => bookingList(...args)
}));
vi.mock("../../shared/components/PhoneVerificationPrompt", () => ({
  PhoneVerificationPrompt: ({ open }: { open: boolean }) => (open ? <div role="dialog">Confirm your phone number</div> : null)
}));

import { PhoneVerificationGate } from "../PhoneVerificationGate";

// One object per test: the gate re-checks whenever the user object changes.
const UNVERIFIED: TestUser = { id: "client-1", phone: "+254712345678", phoneVerifiedAt: null };
const VERIFIED: TestUser = { ...UNVERIFIED, phoneVerifiedAt: "2026-11-01T09:00:00Z" };

const withBookings = (...statuses: string[]) =>
  bookingList.mockReturnValue({ isSuccess: true, data: { bookings: statuses.map((status) => ({ status })) } });

const ClientApp = () => (
  <PhoneVerificationGate after="first-booking">
    <div>client app</div>
  </PhoneVerificationGate>
);

const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  bookingList.mockReset();
  auth.user = UNVERIFIED;
  auth.isAuthenticated = true;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the phone confirmation prompt for a client", () => {
  it("stays away from a client who has not booked, on their first screen or later", async () => {
    withBookings();
    render(<ClientApp />);

    await wait(1500 + 500);
    expect(screen.getByText("client app")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await wait(60_000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("appears for a client who had already booked when the app loaded", async () => {
    withBookings("telemedicine_paid_pending_assignment");
    render(<ClientApp />);

    await wait(1500 + 500);

    expect(screen.getByRole("dialog")).toHaveTextContent("Confirm your phone number");
  });

  it("counts a finished or cancelled booking as having booked", async () => {
    withBookings("cancelled_by_client");
    render(<ClientApp />);

    await wait(1500 + 500);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not count a booking that is still waiting for payment", async () => {
    withBookings("telemedicine_payment_pending");
    render(<ClientApp />);

    await wait(1500 + 500);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not interrupt a booking made during this visit, such as an M-Pesa request still waiting", async () => {
    withBookings();
    const { rerender } = render(<ClientApp />);
    await wait(1500 + 500);

    // The client books and pays; the app now sees a booking that is past setup.
    withBookings("telemedicine_paid_pending_assignment");
    rerender(<ClientApp />);
    await wait(1500 + 500);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays away from a client who has already confirmed their number, and does not look up their bookings", async () => {
    auth.user = VERIFIED;
    withBookings("fully_completed");
    render(<ClientApp />);

    await wait(1500 + 500);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bookingList.mock.calls.every(([, options]) => options?.enabled === false)).toBe(true);
  });

  it("respects a dismissal from the last 24 hours", async () => {
    localStorage.setItem("tiba.phone_verification_dismissed", String(Date.now() - 60 * 60 * 1000));
    withBookings("fully_completed");
    render(<ClientApp />);

    await wait(1500 + 500);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("the phone confirmation prompt for everyone else", () => {
  it("is shown straight away when no booking is required, and never looks at bookings", async () => {
    render(
      <PhoneVerificationGate>
        <div>provider app</div>
      </PhoneVerificationGate>
    );

    await wait(1500 + 500);

    expect(screen.getByRole("dialog")).toHaveTextContent("Confirm your phone number");
    expect(bookingList).not.toHaveBeenCalled();
  });
});
