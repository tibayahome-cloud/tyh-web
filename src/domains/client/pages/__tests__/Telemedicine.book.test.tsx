/**
 * "Talk to a Doctor Online" arrives as /app/telemedicine?book=1. The person has already said what they want, so the
 * booking dialog opens at once instead of asking them to find the "Book a consultation" button; the marker is then
 * removed so closing the dialog, or reloading, does not open it again.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", countryCode: "KE" }, isAuthenticated: true })
}));
vi.mock("../../../../shared/hooks/useBookings", () => ({
  useBookingList: () => ({ data: { bookings: [] }, isLoading: false })
}));
vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi" } })
}));
vi.mock("../../../../shared/components/NeedsYourResponse", () => ({ NeedsYourResponse: () => null }));
vi.mock("../../../../shared/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));
vi.mock("../../components/TelemedicineRequestDialog", () => ({
  TelemedicineRequestDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog">
        booking dialog
        <button type="button" onClick={onClose}>
          close dialog
        </button>
      </div>
    ) : null
}));

import ClientTelemedicinePage from "../Telemedicine";

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname}${location.search}`}</div>;
};

const renderPage = (entry: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Where />
        <Routes>
          <Route path="/app/telemedicine" element={<ClientTelemedicinePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("telemedicine page opened with ?book=1", () => {
  it("opens the booking dialog straight away and removes the marker", async () => {
    renderPage("/app/telemedicine?book=1");

    expect(await screen.findByRole("dialog")).toHaveTextContent("booking dialog");
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/app\/telemedicine$/);
  });

  it("does not open the dialog again after it is closed", async () => {
    const user = userEvent.setup();
    renderPage("/app/telemedicine?book=1");

    await user.click(await screen.findByRole("button", { name: "close dialog" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog closed on an ordinary visit, until the person asks for it", async () => {
    const user = userEvent.setup();
    renderPage("/app/telemedicine");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Book a consultation/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("leaves other query parameters alone", async () => {
    renderPage("/app/telemedicine?book=1&tab=history");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/app/telemedicine?tab=history");
  });
});
