import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.mock("../../../../shared/libs/facilities", () => ({
  fetchFacilityBookings: (...args: unknown[]) => fetchMock(...args)
}));

import { FacilityBookingsPanel } from "../FacilityBookingsPanel";

const counts = {
  home: { total: 6, byStatus: { requested: 2, scheduled: 1, fully_completed: 3 } },
  telemedicine: { total: 4, byStatus: { telemedicine_paid_pending_assignment: 1, scheduled: 1, fully_completed: 2 } }
};

const booking = (id: string, over: Record<string, unknown> = {}) => ({
  id, status: "requested", scheduledAt: null, createdAt: "2026-10-12T08:00:00Z", priceCents: 150000, currency: "KES", paidAt: null,
  isTelemedicine: false, telemedicineSession: null,
  service: { id: "s1", name: "Nurse Visit at Home" }, client: { id: "c1", fullName: "Amina Client" }, provider: null, ...over
});

const result = (bookings: unknown[], over: Record<string, unknown> = {}) => ({
  bookings,
  meta: { page: { number: 1, size: 15, total: bookings.length, totalPages: 1 } },
  counts,
  ...over
});

const renderPanel = (onAssign?: (b: unknown) => void) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FacilityBookingsPanel facilityId="f-1" onAssign={onAssign as never} />
      </QueryClientProvider>
    </MemoryRouter>
  );

const lastCall = () => fetchMock.mock.calls.at(-1) as [string, Record<string, unknown>];

describe("FacilityBookingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(result([booking("b1")]));
  });

  it("does not warn when the API sends counts", async () => {
    renderPanel();
    await screen.findByText("Nurse Visit at Home");
    expect(screen.queryByText(/cannot yet separate/)).not.toBeInTheDocument();
  });

  it("opens on home-based care, needs attention, and asks the API for exactly that", async () => {
    renderPanel();
    expect(await screen.findByText("Nurse Visit at Home")).toBeInTheDocument();
    const [facilityId, params] = lastCall();
    expect(facilityId).toBe("f-1");
    expect(params).toMatchObject({ page: 1, pageSize: 15, isTelemedicine: false });
    expect(params.status).toBe("requested,broadcasting,expired_no_accept,disputed,telemedicine_paid_pending_assignment,telemedicine_cancelled_payment_review,telemedicine_unattended");
  });

  it("shows counts on the tabs and the status filters, from the API's counts", async () => {
    renderPanel();
    await screen.findByText("Nurse Visit at Home");
    const tabs = screen.getByRole("tablist", { name: "Booking type" });
    expect(within(tabs).getByRole("tab", { name: /Home-based care/ })).toHaveTextContent("2 need attention of 6");
    expect(within(tabs).getByRole("tab", { name: /Telemedicine/ })).toHaveTextContent("1 need attention of 4");
    const filters = screen.getByRole("group", { name: "Booking status" });
    expect(within(filters).getByRole("button", { name: /Needs attention/ })).toHaveTextContent("2");
    expect(within(filters).getByRole("button", { name: /Upcoming and active/ })).toHaveTextContent("1");
    expect(within(filters).getByRole("button", { name: /Completed/ })).toHaveTextContent("3");
    expect(within(filters).getByRole("button", { name: /All/ })).toHaveTextContent("6");
  });

  it("switches to telemedicine and asks for telemedicine bookings only", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Nurse Visit at Home");
    await user.click(screen.getByRole("tab", { name: /Telemedicine/ }));
    await waitFor(() => expect(lastCall()[1]).toMatchObject({ isTelemedicine: true, page: 1 }));
    expect(screen.getByRole("tab", { name: /Telemedicine/ })).toHaveAttribute("aria-selected", "true");
  });

  it("changes the status filter, returns to page one, and omits the status for All", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Nurse Visit at Home");
    await user.click(screen.getByRole("button", { name: /Completed/ }));
    await waitFor(() => expect(lastCall()[1]).toMatchObject({ status: "completed_by_provider,client_completed,fully_completed,client_confirmed,paid" }));
    expect(screen.getByRole("button", { name: /Completed/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /^All/ }));
    await waitFor(() => expect(lastCall()[1].status).toBeUndefined());
  });

  it("shows what an admin needs on each row: status, client, provider, amount, payment", async () => {
    fetchMock.mockResolvedValue(
      result([
        booking("b1", { provider: { id: "p1", fullName: "Nurse Joy" }, paidAt: "2026-10-12T09:00:00Z", status: "accepted", scheduledAt: "2026-10-14T10:00:00Z" }),
        booking("b2", { isTelemedicine: true, telemedicineSession: { status: "waiting" }, service: { id: "s2", name: "First Medical Consultation" } })
      ])
    );
    renderPanel();
    const first = (await screen.findByText("Nurse Visit at Home")).closest("li") as HTMLElement;
    expect(within(first).getByText("Accepted")).toBeInTheDocument();
    expect(within(first).getByText("Paid")).toBeInTheDocument();
    expect(within(first).getByText("Nurse Joy")).toBeInTheDocument();
    expect(within(first).getByText(/1,500/)).toBeInTheDocument();
    expect(within(first).queryByText("Video consultation")).not.toBeInTheDocument();

    const second = screen.getByText("First Medical Consultation").closest("li") as HTMLElement;
    expect(within(second).getByText("Video consultation")).toBeInTheDocument();
    expect(within(second).getByText("Not paid")).toBeInTheDocument();
    expect(within(second).getByText("Unassigned")).toBeInTheDocument();
    expect(within(second).getByText("Waiting")).toBeInTheDocument();
  });

  it("links each booking to its detail page", async () => {
    renderPanel();
    expect(await screen.findByRole("link", { name: /View booking for Amina Client, Nurse Visit at Home/ })).toHaveAttribute("href", "/admin/bookings/b1");
  });

  it("offers Assign provider only where a provider can still be assigned, and calls it", async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();
    fetchMock.mockResolvedValue(result([booking("b1"), booking("b2", { status: "fully_completed" }), booking("b3", { status: "accepted", provider: { id: "p", fullName: "P" } })]));
    renderPanel(onAssign);
    await screen.findAllByRole("listitem");
    expect(screen.getAllByRole("button", { name: "Assign provider" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Reassign provider" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Assign provider" }));
    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
  });

  it("is read-only when no assign action is supplied", async () => {
    renderPanel();
    await screen.findByText("Nurse Visit at Home");
    expect(screen.queryByRole("button", { name: /assign provider/i })).not.toBeInTheDocument();
  });

  it("explains an empty group and an empty facility", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(result([]));
    renderPanel();
    expect(await screen.findByText(/No home-based care bookings in "Needs attention"/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^All/ }));
    expect(await screen.findByText(/No home-based care bookings for this facility yet/)).toBeInTheDocument();
  });

  it("pages through the list", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(result([booking("b1")], { meta: { page: { number: 1, size: 15, total: 31, totalPages: 3 } } }));
    renderPanel();
    await screen.findByText("Page 1 of 3");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(lastCall()[1]).toMatchObject({ page: 2 }));
  });

  it("opens on telemedicine when the facility has only telemedicine bookings", async () => {
    fetchMock.mockResolvedValue(result([], { counts: { home: { total: 0, byStatus: {} }, telemedicine: { total: 2, byStatus: { scheduled: 2 } } } }));
    renderPanel();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Telemedicine/ })).toHaveAttribute("aria-selected", "true"));
  });

  it("shows an error with a retry that recovers", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
    renderPanel();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Nurse Visit at Home")).toBeInTheDocument();
  });

  it("copes with an API that sends no counts", async () => {
    fetchMock.mockResolvedValue(result([booking("b1")], { counts: null }));
    renderPanel();
    expect(await screen.findByText("Nurse Visit at Home")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Booking status" })).getByRole("button", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/cannot yet separate telemedicine from home-based care/);
  });
});
