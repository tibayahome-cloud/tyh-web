/**
 * The booking queue filters are chosen by name, never by pasting an id: a person finds a client, a provider or a
 * service by what it is called, and the chosen row's id is what goes to the list.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listMock = vi.fn();

vi.mock("../../../../../shared/hooks/useBookings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../shared/hooks/useBookings")>();
  return { ...actual, useBookingList: (...args: unknown[]) => listMock(...args) };
});
vi.mock("../../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn(), push: vi.fn() }) }));
vi.mock("../../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ roles: ["admin.ops"], permissions: [], accessToken: "t" }) }));
vi.mock("../../../hooks/useFilterLookups", () => ({
  useFilterLookups: () => ({
    clients: { options: [], loading: false, search: vi.fn() },
    providers: { options: [], loading: false, search: vi.fn() },
    services: { options: [{ id: "svc-1", label: "First Medical Consultation" }], loading: false }
  })
}));

import AdminBookingQueuePage from "../QueuePage";

beforeEach(() => {
  listMock.mockReset();
  listMock.mockReturnValue({ data: { bookings: [] }, isLoading: false, isError: false, refetch: vi.fn() });
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <AdminBookingQueuePage />
      </QueryClientProvider>
    </MemoryRouter>
  );

describe("booking queue filters", () => {
  it("asks for people and services by name, with no field names or ids", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByRole("combobox", { name: "Client" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Provider" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Service" })).toBeInTheDocument();
    expect(screen.queryByText(/client_user_id|provider_user_id|service_id|ID\b/)).not.toBeInTheDocument();
  });

  it("filters by the chosen service, showing its name as a chip", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByRole("combobox", { name: "Service" }));
    await user.click(await screen.findByRole("option", { name: "First Medical Consultation" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByText("Service: First Medical Consultation")).toBeInTheDocument();
    expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ serviceId: "svc-1" }), expect.anything());
  });

  it("fills the booked-between dates from a quick choice, as whole days", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByRole("button", { name: "Last 7 days" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    const params = listMock.mock.calls.at(-1)?.[0] as { from: string; to: string };
    expect(params.from).toMatch(/T00:00:00\+03:00$/);
    expect(params.to).toMatch(/T23:59:59\+03:00$/);
    expect(within(document.body).getByText(/^Booked from /)).toBeInTheDocument();
  });
});
