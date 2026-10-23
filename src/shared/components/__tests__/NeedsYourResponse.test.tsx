import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ops = vi.hoisted(() => ({
  fetchTelemedicineAttention: vi.fn(),
  acceptReschedule: vi.fn(),
  declineReschedule: vi.fn(),
  acceptRebookingOffer: vi.fn(),
  declineRebookingOffer: vi.fn(),
  acknowledgeAttentionItem: vi.fn()
}));
vi.mock("../../libs/telemedicineOps", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../libs/telemedicineOps")>()), ...ops }));

import { NeedsYourResponse } from "../NeedsYourResponse";

const reschedule = {
  kind: "reschedule_request" as const, id: "r1", bookingId: "b1", proposedStartAt: "2026-10-16T09:00:00Z", expiresAt: null,
  reason: "Running late", createdAt: "2026-10-15T10:00:00Z", currentStartAt: "2026-10-16T08:00:00Z", role: "client" as const,
  serviceName: "First Medical Consultation", fromName: "DR DENIS GITOBU"
};
const offer = {
  kind: "rebooking_offer" as const, id: "o1", bookingId: "b2", proposedStartAt: "2026-10-17T09:00:00Z", expiresAt: "2026-10-16T09:00:00Z",
  reason: null, createdAt: "2026-10-15T11:00:00Z", currentStartAt: null, role: "client" as const,
  serviceName: "Counselling", fromName: "Psychare"
};

const confirmed = {
  kind: "time_confirmed" as const, id: "t1", bookingId: "b3", proposedStartAt: "2026-10-20T09:00:00Z", expiresAt: null,
  reason: null, createdAt: "2026-10-19T10:00:00Z", currentStartAt: "2026-10-20T09:00:00Z", role: "provider" as const,
  serviceName: "Follow-up Consultation", fromName: "Sample Client", acknowledgeable: true
};

const renderCard = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NeedsYourResponse bookingPath={(id) => `/app/bookings/${id}`} />
      </QueryClientProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  ops.fetchTelemedicineAttention.mockResolvedValue([reschedule, offer]);
  ops.acceptReschedule.mockResolvedValue({});
  ops.declineReschedule.mockResolvedValue({});
  ops.acceptRebookingOffer.mockResolvedValue(undefined);
  ops.declineRebookingOffer.mockResolvedValue(undefined);
  ops.acknowledgeAttentionItem.mockResolvedValue(undefined);
});

describe("NeedsYourResponse", () => {
  it("renders nothing when nothing is waiting", async () => {
    ops.fetchTelemedicineAttention.mockResolvedValue([]);
    const { container } = renderCard();
    await waitFor(() => expect(ops.fetchTelemedicineAttention).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("names who proposed what, the proposed and current time, and says nothing changes unless accepted", async () => {
    renderCard();
    const section = await screen.findByRole("region", { name: /Needs your response \(2\)/ });
    expect(within(section).getByText("DR DENIS GITOBU proposed a new time for First Medical Consultation")).toBeInTheDocument();
    expect(within(section).getByText("Running late")).toBeInTheDocument();
    expect(within(section).getByText(/Nothing changes unless you accept/)).toBeInTheDocument();
    expect(within(section).getAllByText("Current time")).toHaveLength(1);
  });

  it("explains a facility's replacement-time offer, including the payment and the deadline", async () => {
    renderCard();
    expect(await screen.findByText("Psychare offered a new time for your Counselling")).toBeInTheDocument();
    expect(screen.getByText(/You have already paid/)).toBeInTheDocument();
    expect(screen.getByText("Answer by")).toBeInTheDocument();
  });

  it("accepts a reschedule proposal by its request id", async () => {
    const user = userEvent.setup();
    renderCard();
    const card = (await screen.findByText(/proposed a new time/)).closest("li") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Accept new time" }));
    await waitFor(() => expect(ops.acceptReschedule).toHaveBeenCalledWith("r1"));
  });

  it("declines a replacement-time offer by its booking id", async () => {
    const user = userEvent.setup();
    renderCard();
    const card = (await screen.findByText(/offered a new time/)).closest("li") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(ops.declineRebookingOffer).toHaveBeenCalledWith("b2"));
  });

  it("links to the booking", async () => {
    renderCard();
    const links = await screen.findAllByRole("link", { name: "View booking" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/app/bookings/b1", "/app/bookings/b2"]);
  });

  it("shows the server's reason when an answer is refused, and keeps the item", async () => {
    ops.acceptReschedule.mockRejectedValue(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400, statusText: "", headers: {}, config: {}, data: { error: { message: "The provider is not free at the proposed time" } }
      } as never)
    );
    const user = userEvent.setup();
    renderCard();
    const card = (await screen.findByText(/proposed a new time/)).closest("li") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Accept new time" }));
    expect(await within(card).findByRole("alert")).toHaveTextContent("The provider is not free at the proposed time");
    expect(screen.getByText(/proposed a new time/)).toBeInTheDocument();
  });

  describe("a confirmed new time", () => {
    it("is shown as an update with nothing to answer, and is dismissed by 'Got it'", async () => {
      ops.fetchTelemedicineAttention.mockResolvedValue([confirmed]);
      const user = userEvent.setup();
      renderCard();

      const section = await screen.findByRole("region", { name: /Updates/ });
      expect(within(section).getByText("Follow-up Consultation with Sample Client has a new confirmed time")).toBeInTheDocument();
      expect(within(section).getByText("New time")).toBeInTheDocument();
      expect(within(section).getByText(/There is nothing you need to do/)).toBeInTheDocument();
      expect(within(section).queryByRole("button", { name: "Accept new time" })).not.toBeInTheDocument();
      expect(within(section).queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();

      await user.click(within(section).getByRole("button", { name: "Got it" }));
      await waitFor(() => expect(ops.acknowledgeAttentionItem).toHaveBeenCalledWith("t1"));
    });

    it("is also dismissed by opening the booking", async () => {
      ops.fetchTelemedicineAttention.mockResolvedValue([confirmed]);
      const user = userEvent.setup();
      renderCard();

      await user.click(await screen.findByRole("link", { name: "View booking" }));
      await waitFor(() => expect(ops.acknowledgeAttentionItem).toHaveBeenCalledWith("t1"));
    });

    it("still says 'Needs your response' when a proposal is waiting alongside it", async () => {
      ops.fetchTelemedicineAttention.mockResolvedValue([reschedule, confirmed]);
      renderCard();
      expect(await screen.findByRole("region", { name: /Needs your response \(2\)/ })).toBeInTheDocument();
    });
  });
});
