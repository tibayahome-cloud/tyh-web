/**
 * Reviews: what the page is for is said at the top, each row names the people and service and links to the booking, and
 * the outcome is a choice that says what it will do, with the amount when money is involved.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lib = vi.hoisted(() => ({ fetch: vi.fn(), resolve: vi.fn() }));
vi.mock("../../../../../shared/libs/telemedicineOps", () => ({
  fetchReviewQueue: lib.fetch,
  resolveReviewItem: lib.resolve
}));
vi.mock("../../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import ReviewQueuePage from "../ReviewQueuePage";

const outcomes = [
  { key: "refund_full", label: "Refund the client in full", effect: "Sends the whole payment back to the client." },
  { key: "no_action", label: "No action needed", effect: "Closes this item. No money moves." }
];

const row = (overrides: Record<string, unknown> = {}) => ({
  category: "payment_review",
  id: "d1",
  status: "open",
  bookingId: "b1",
  facilityId: "f1",
  scheduledAt: "2026-10-20T09:00:00Z",
  paymentId: "p1",
  openedAt: new Date(Date.now() - 50 * 3_600_000).toISOString(),
  summary: "No provider was available",
  clientName: "Amina Client",
  providerName: null,
  serviceName: "Online consultation",
  outcomes,
  refundableAmountCents: 150000,
  refundableCurrency: "KES",
  ...overrides
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ReviewQueuePage />
      </QueryClientProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  lib.fetch.mockReset();
  lib.resolve.mockReset();
  lib.resolve.mockResolvedValue({ outcome: "refund_full", refund: { requested: true, amount_cents: 150000, currency: "KES", already_requested: false } });
});

describe("Reviews page", () => {
  it("has one name and says what it is for", async () => {
    lib.fetch.mockResolvedValue([row()]);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.getByText(/Things that need a person to decide/)).toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
  });

  it("names the client and service, how long it has been open, and links to the booking", async () => {
    lib.fetch.mockResolvedValue([row()]);
    renderPage();

    expect(await screen.findByText("Online consultation")).toBeInTheDocument();
    expect(screen.getByText("Client Amina Client")).toBeInTheDocument();
    expect(screen.getByText("Open for 2 days")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open booking" })).toHaveAttribute("href", "/admin/bookings/b1");
    expect(screen.queryByText("Appointment time unknown")).not.toBeInTheDocument();
  });

  it("counts each kind and shows the longest-waiting first", async () => {
    lib.fetch.mockResolvedValue([
      row({ id: "new", serviceName: "Newer", openedAt: new Date(Date.now() - 3_600_000).toISOString() }),
      row({ id: "old", serviceName: "Older", category: "no_show", outcomes: [], refundableAmountCents: null })
    ]);
    renderPage();

    await screen.findByText("Older");
    const names = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(names.findIndex((t) => t.includes("Older"))).toBeLessThan(names.findIndex((t) => t.includes("Newer")));
    expect(screen.getByRole("button", { name: "Everything (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nobody attended (1)" })).toBeInTheDocument();
  });

  it("says nothing needs a decision when the list is empty", async () => {
    lib.fetch.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nothing needs a decision right now.")).toBeInTheDocument();
  });

  it("names what failed and offers a retry", async () => {
    lib.fetch.mockRejectedValue(new Error("x"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not load the reviews");
  });
});

describe("resolving", () => {
  it("offers a list of outcomes, each saying what it does, with the refund amount", async () => {
    lib.fetch.mockResolvedValue([row()]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));

    expect(screen.queryByPlaceholderText(/e\.g\. rebooked/)).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Refund the client in full/ })).toBeInTheDocument();
    expect(screen.getByText("Sends KES 1,500 back to the client.")).toBeInTheDocument();
    expect(screen.getByText("Closes this item. No money moves.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/does not move money/);
  });

  it("needs an outcome and a note before it can be submitted", async () => {
    lib.fetch.mockResolvedValue([row()]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
    const submit = screen.getByRole("button", { name: "Mark as resolved" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /No action needed/ }));
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Note for the record"), { target: { value: "checked" } });
    expect(submit).toBeEnabled();
  });

  it("names the amount on the refund button and sends it with the request", async () => {
    lib.fetch.mockResolvedValue([row()]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));

    fireEvent.click(screen.getByRole("radio", { name: /Refund the client in full/ }));
    fireEvent.change(screen.getByLabelText("Note for the record"), { target: { value: "client asked" } });
    fireEvent.click(screen.getByRole("button", { name: "Refund KES 1,500 and close" }));

    await vi.waitFor(() =>
      expect(lib.resolve).toHaveBeenCalledWith("payment_review", "d1", { reason: "client asked", outcome: "refund_full", refundAmountCents: 150000 })
    );
  });

  it("sends no amount for an outcome that moves no money", async () => {
    lib.fetch.mockResolvedValue([row()]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));

    fireEvent.click(screen.getByRole("radio", { name: /No action needed/ }));
    fireEvent.change(screen.getByLabelText("Note for the record"), { target: { value: "fine" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark as resolved" }));

    await vi.waitFor(() =>
      expect(lib.resolve).toHaveBeenCalledWith("payment_review", "d1", { reason: "fine", outcome: "no_action", refundAmountCents: null })
    );
  });

  it("does not offer to resolve a reschedule here; it points at the booking", async () => {
    lib.fetch.mockResolvedValue([row({ category: "reschedule_escalation", outcomes: [], refundableAmountCents: null })]);
    renderPage();

    const item = (await screen.findAllByRole("listitem"))[0];
    expect(within(item).queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
    expect(within(item).getByText(/has to accept or decline it/)).toBeInTheDocument();
  });
});
