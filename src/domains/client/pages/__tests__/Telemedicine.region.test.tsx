/**
 * The telemedicine page never asks for a country. A client whose country is known (it is read from their phone number)
 * sees nothing about it; one whose number gives none is told remote consultations are in Kenya for now and is taken to
 * the profile to add a Kenyan number.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: { user: { id: "u1", countryCode: "KE" as string | null } } }));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: auth.user, isAuthenticated: true })
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
vi.mock("../../components/TelemedicineRequestDialog", () => ({ TelemedicineRequestDialog: () => null }));

import ClientTelemedicinePage from "../Telemedicine";

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/app/telemedicine"]}>
        <Routes>
          <Route path="/app/telemedicine" element={<ClientTelemedicinePage />} />
          <Route path="/app/profile" element={<div>profile page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => {
  auth.user = { id: "u1", countryCode: "KE" };
});

describe("telemedicine page and the client's country", () => {
  it("says nothing about a country when it is known", () => {
    renderPage();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/country required/i)).not.toBeInTheDocument();
  });

  it("tells a number outside Kenya that remote consultations are in Kenya for now, and takes them to add one", async () => {
    auth.user = { id: "u1", countryCode: null };
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Remote consultations are available in Kenya for now");
    expect(screen.queryByText(/country required/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Update phone number" }));

    expect(await screen.findByText("profile page")).toBeInTheDocument();
  });
});
