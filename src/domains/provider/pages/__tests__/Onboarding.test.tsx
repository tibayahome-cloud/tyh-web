/**
 * Provider onboarding: one status at the top in plain words, a checklist with one action per document, and the right
 * state for providers who are verified or were set up by their facility and have no application at all.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: {} as Record<string, unknown>, application: null as unknown, post: vi.fn(), put: vi.fn() }));

vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "p1" } }) }));
vi.mock("../../../../shared/hooks/useSocket", () => ({ useSocket: () => null }));
vi.mock("../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../hooks/useProviderProfile", () => ({ useProviderProfile: () => ({ data: { daily_request_limit: 5, can_emergency: false } }) }));
vi.mock("../../../../shared/libs/api", () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url === "/provider-applications/me/status") return { data: { data: state.status } };
      if (url === "/provider-applications/me") {
        if (!state.application) throw Object.assign(new Error("not found"), { isAxiosError: true, response: { status: 404 } });
        return { data: { data: state.application } };
      }
      return { data: { data: {} } };
    }),
    post: (...args: unknown[]) => state.post(...args),
    put: (...args: unknown[]) => state.put(...args),
    patch: vi.fn()
  }
}));
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return { ...actual, isAxiosError: (e: { isAxiosError?: boolean }) => Boolean(e?.isAxiosError) };
});

import OnboardingPage from "../Onboarding";

const summary = (overrides: Record<string, unknown> = {}) => ({
  status: "not_started",
  items_done: 0,
  items_total: 0,
  items: [],
  next_item: null,
  reviewer_note: null,
  ready_to_submit: false,
  verified_at: null,
  ...overrides
});

const appItem = (id: string, label: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  status,
  file_url: null,
  download_url: null,
  value_text: null,
  comment: null,
  requirement_type: { id: `r-${id}`, label, input_type: "file", display_order: Number(id.replace(/\D/g, "")) || 0 },
  ...extra
});

const renderPage = async () => {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <OnboardingPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
  return screen.findByRole("heading", { name: "Your verification" });
};

beforeEach(() => {
  state.status = summary();
  state.application = null;
  state.post.mockReset();
  state.post.mockResolvedValue({});
  state.put.mockReset();
  state.put.mockResolvedValue({});
});

describe("onboarding status", () => {
  it("not started: says so and offers to start", async () => {
    await renderPage();

    const card = screen.getByRole("region", { name: "Verification status" });
    expect(within(card).getByText("Not started")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Start verification" }));
    await vi.waitFor(() => expect(state.post).toHaveBeenCalledWith("/provider-applications", {}));
  });

  it("verified with no application: says verified, offers no start and no upload", async () => {
    state.status = summary({ status: "set_up_by_facility" });
    await renderPage();

    expect(screen.getByText("Your facility set you up")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start verification" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Awaiting initialization|0%/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Documents" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set your hours" })).toBeInTheDocument();
  });

  it("documents needed: counts them and lists each with its own status and action", async () => {
    state.status = summary({
      status: "documents_needed",
      items_done: 1,
      items_total: 2,
      next_item: { requirement_key: "l", label: "Practising licence", input_type: "file", status: "missing", reviewer_note: null }
    });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "pending"), appItem("2", "Practising licence", "missing")] };
    await renderPage();

    expect(screen.getByText("Documents needed (1 of 2)")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Documents provided" })).toHaveAttribute("aria-valuenow", "1");
    const list = screen.getByRole("list", { name: "Documents" });
    expect(within(list).getByText("Sent, waiting for review")).toBeInTheDocument();
    expect(within(list).getByText("Needed")).toBeInTheDocument();
    expect(within(list).getAllByText("Choose a file")).toHaveLength(2);
    expect(within(list).getAllByText("Take a photo")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/\b(missing|pending|rejected)\b/);
  });

  it("needs changes: shows the reviewer's note on the document that was sent back", async () => {
    state.status = summary({
      status: "needs_changes",
      items_done: 1,
      items_total: 2,
      reviewer_note: "The photo is blurry",
      items: [{ requirement_key: "l", label: "Practising licence", input_type: "file", status: "rejected", reviewer_note: "The photo is blurry" }]
    });
    state.application = { id: "a1", status: "under_review", items: [appItem("1", "National ID", "verified"), appItem("2", "Practising licence", "rejected")] };
    await renderPage();

    expect(screen.getAllByText("The photo is blurry").length).toBeGreaterThan(0);
    expect(screen.getByText("Sent back")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("everything uploaded: offers to send for review", async () => {
    state.status = summary({ status: "documents_needed", items_done: 1, items_total: 1, ready_to_submit: true });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "pending")] };
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Send for review" }));

    await vi.waitFor(() => expect(state.post).toHaveBeenCalledWith("/provider-applications/a1/submit", {}));
  });

  it("in review: nothing to do but wait", async () => {
    state.status = summary({ status: "in_review", items_done: 1, items_total: 1 });
    state.application = { id: "a1", status: "submitted", items: [appItem("1", "National ID", "pending")] };
    await renderPage();

    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send for review|Start verification/ })).not.toBeInTheDocument();
  });

  it("uploads a chosen file straight away, to that document", async () => {
    state.status = summary({ status: "documents_needed", items_done: 0, items_total: 1 });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    await renderPage();

    const input = screen.getByText("Choose a file").closest("label")!.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "id.pdf", { type: "application/pdf" })] } });

    await vi.waitFor(() => expect(state.post).toHaveBeenCalledWith("/provider-applications/a1/items/1/upload", expect.any(FormData), expect.anything()));
  });

  it("lets a phone take a photo from its camera", async () => {
    state.status = summary({ status: "documents_needed", items_done: 0, items_total: 1 });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    await renderPage();

    const camera = screen.getByText("Take a photo").closest("label")!.querySelector("input[type=file]");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(camera).toHaveAttribute("accept", "image/*");
  });
});
