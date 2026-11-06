/** The super admin's queue of facilities: whose turn it is comes first, each tab shows its count. */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  get: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  counts: { waiting: 0, sent_back: 0, incomplete: 0, complete: 0 },
  totalPages: 1,
  fail: false
}));

vi.mock("../../../../../shared/libs/api", () => ({ api: { get: (...args: unknown[]) => state.get(...args) } }));

import { FacilitiesQueuePage } from "../FacilitiesQueuePage";

const row = (overrides: Record<string, unknown> = {}) => ({
  facility_id: "f-1",
  facility_name: "Example Hospital",
  facility_status: "active",
  state: "waiting",
  required_total: 7,
  required_approved: 2,
  waiting: 3,
  sent_back: 0,
  added_not_sent: 0,
  missing_required: 2,
  in_order: false,
  documents_due_on: null,
  documents_days_left: null,
  oldest_submitted_at: "2026-11-05T08:00:00+00:00",
  ...overrides
});

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/documents/facilities"]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Routes>
          <Route path="/admin/documents/facilities" element={<><FacilitiesQueuePage /><Where /></>} />
          <Route path="/admin/documents/facilities/:facilityId" element={<Where />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  state.rows = [row()];
  state.counts = { waiting: 1, sent_back: 2, incomplete: 3, complete: 4 };
  state.totalPages = 1;
  state.fail = false;
  state.get.mockReset();
  state.get.mockImplementation(async (_url: string, config: { params?: Record<string, unknown> } = {}) => {
    if (state.fail) throw Object.assign(new Error("boom"), { isAxiosError: true, response: { status: 500 } });
    const wanted = config.params?.["filter[state]"];
    return {
      data: {
        data: state.rows.filter((entry) => entry.state === wanted),
        meta: { counts: state.counts, page: { number: 1, size: 20, total: state.rows.length, total_pages: state.totalPages } }
      }
    };
  });
});

describe("Facilities documents queue", () => {
  it("opens on the facilities waiting for the super admin and counts every tab", async () => {
    renderPage();

    expect(await screen.findByText("Example Hospital")).toBeInTheDocument();
    expect(screen.getByText("3 documents waiting · 2 of 7 required approved")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Waiting for you1", "Sent back2", "Not finished3", "Done4"]);
    expect(state.get).toHaveBeenCalledWith("/facility-documents/review", expect.objectContaining({ params: expect.objectContaining({ "filter[state]": "waiting" }) }));
  });

  it("asks for another state when a tab is chosen and keeps it in the address", async () => {
    state.rows = [row(), row({ facility_id: "f-2", facility_name: "Fixing Clinic", state: "sent_back", waiting: 0, sent_back: 1 })];
    renderPage();
    await screen.findByText("Example Hospital");

    fireEvent.click(screen.getByRole("tab", { name: /Sent back/ }));

    expect(await screen.findByText("Fixing Clinic")).toBeInTheDocument();
    expect(screen.getByTestId("where").textContent).toContain("state=sent_back");
  });

  it("moves between tabs with the arrow keys", async () => {
    renderPage();
    await screen.findByText("Example Hospital");
    const first = screen.getByRole("tab", { name: /Waiting for you/ });

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });

    await waitFor(() => expect(screen.getByRole("tab", { name: /Sent back/ })).toHaveAttribute("aria-selected", "true"));
  });

  it("opens a facility's documents from the row", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("link", { name: /Example Hospital/ }));

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin/documents/facilities/f-1"));
  });

  it("tells the super admin plainly when nothing is waiting", async () => {
    state.rows = [];
    renderPage();

    expect(await screen.findByText("Nothing is waiting for you")).toBeInTheDocument();
  });

  it("warns about the date while documents are still owed", async () => {
    state.rows = [row({ documents_days_left: -2 })];
    renderPage();

    expect(await screen.findByText("Documents overdue")).toBeInTheDocument();
  });

  it("sends the search after a short pause", async () => {
    renderPage();
    await screen.findByText("Example Hospital");

    fireEvent.change(screen.getByRole("searchbox", { name: /Search facilities/ }), { target: { value: "hospital" } });

    await waitFor(() =>
      expect(state.get).toHaveBeenCalledWith("/facility-documents/review", expect.objectContaining({ params: expect.objectContaining({ "filter[search]": "hospital" }) }))
    );
  });

  it("explains a failed load and lets the super admin try again", async () => {
    state.fail = true;
    renderPage();

    expect(within(await screen.findByRole("alert")).getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("pages through a long list", async () => {
    state.totalPages = 3;
    renderPage();
    await screen.findByText("Example Hospital");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain("page=2"));
  });
});
