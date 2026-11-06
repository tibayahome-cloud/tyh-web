/**
 * The queue of providers' documents: whose turn it is comes first, each tab shows its count, and a facility admin
 * and a super admin read the same list (the super admin also sees which facility each provider belongs to).
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  superAdmin: false,
  get: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  counts: { waiting: 0, sent_back: 0, incomplete: 0, complete: 0 },
  totalPages: 1,
  fail: false
}));

vi.mock("../../../../../shared/hooks/useRbac", () => ({ useRbac: () => ({ hasRole: () => state.superAdmin, roles: [] }) }));
vi.mock("../../../../../shared/libs/api", () => ({ api: { get: (...args: unknown[]) => state.get(...args) } }));

import { DocumentsPage } from "../DocumentsPage";

const row = (overrides: Record<string, unknown> = {}) => ({
  application_id: "app-1",
  provider_user_id: "u-1",
  provider_name: "Dr Waiting",
  facility_id: "f-1",
  facility_name: "Example Clinic",
  provider_verified: false,
  application_status: "submitted",
  state: "waiting",
  waiting: 2,
  sent_back: 0,
  missing_required: 0,
  approved: 1,
  required_total: 3,
  submitted_at: "2026-11-05T08:00:00+00:00",
  documents_due_on: null,
  documents_days_left: null,
  ...overrides
});

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;

const renderPage = (initial = "/admin/documents") =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Routes>
          <Route path="/admin/documents" element={<><DocumentsPage /><Where /></>} />
          <Route path="/admin/documents/providers/:applicationId" element={<Where />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  state.superAdmin = false;
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

describe("Documents queue", () => {
  it("opens on the providers waiting for a reviewer and counts every tab", async () => {
    renderPage();

    expect(await screen.findByText("Dr Waiting")).toBeInTheDocument();
    expect(screen.getByText("2 documents waiting · 1 of 3 required approved")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Waiting for you1", "Sent back2", "Not finished3", "Done4"]);
    expect(screen.getByRole("tab", { name: /Waiting for you/ })).toHaveAttribute("aria-selected", "true");
    expect(state.get).toHaveBeenCalledWith("/provider-documents/review", expect.objectContaining({ params: expect.objectContaining({ "filter[state]": "waiting" }) }));
  });

  it("asks for another state when a tab is chosen, and keeps it in the address", async () => {
    state.rows = [row(), row({ application_id: "app-2", provider_name: "Dr Fixing", state: "sent_back", waiting: 0, sent_back: 1 })];
    renderPage();
    await screen.findByText("Dr Waiting");

    fireEvent.click(screen.getByRole("tab", { name: /Sent back/ }));

    expect(await screen.findByText("Dr Fixing")).toBeInTheDocument();
    expect(screen.queryByText("Dr Waiting")).not.toBeInTheDocument();
    expect(screen.getByTestId("where").textContent).toContain("state=sent_back");
  });

  it("moves between tabs with the arrow keys", async () => {
    renderPage();
    await screen.findByText("Dr Waiting");
    const first = screen.getByRole("tab", { name: /Waiting for you/ });

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });

    await waitFor(() => expect(screen.getByRole("tab", { name: /Sent back/ })).toHaveAttribute("aria-selected", "true"));
  });

  it("tells a reviewer plainly when nothing is waiting", async () => {
    state.rows = [];
    renderPage();

    expect(await screen.findByText("Nothing is waiting for you")).toBeInTheDocument();
    expect(screen.getByText(/appear here/)).toBeInTheDocument();
  });

  it("opens a provider's documents from the row", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("link", { name: /Dr Waiting/ }));

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin/documents/providers/app-1"));
  });

  it("shows the facility only to a super admin", async () => {
    renderPage();
    await screen.findByText("Dr Waiting");
    expect(screen.queryByText("Example Clinic")).not.toBeInTheDocument();
  });

  it("shows which facility each provider belongs to for a super admin", async () => {
    state.superAdmin = true;
    renderPage();

    expect(await screen.findByText("Example Clinic")).toBeInTheDocument();
  });

  it("warns about a due date while documents are still owed", async () => {
    state.rows = [row({ documents_days_left: 9 })];
    renderPage();

    expect(await screen.findByText("9 days left")).toBeInTheDocument();
  });

  it("sends the search after a short pause", async () => {
    renderPage();
    await screen.findByText("Dr Waiting");

    fireEvent.change(screen.getByRole("searchbox", { name: /Search providers/ }), { target: { value: "search term" } });

    await waitFor(() =>
      expect(state.get).toHaveBeenCalledWith("/provider-documents/review", expect.objectContaining({ params: expect.objectContaining({ "filter[search]": "search term" }) }))
    );
  });

  it("explains a failed load and lets the reviewer try again", async () => {
    state.fail = true;
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("pages through a long list", async () => {
    state.totalPages = 3;
    renderPage();
    await screen.findByText("Dr Waiting");

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain("page=2"));
  });
});
