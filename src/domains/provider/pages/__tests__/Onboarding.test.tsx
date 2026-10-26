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

const appItem = (id: string, label: string, status: string, extra: Record<string, unknown> = {}, type: Record<string, unknown> = {}) => ({
  id,
  status,
  file_url: null,
  download_url: null,
  value_text: null,
  comment: null,
  requirement_type: { id: `r-${id}`, label, input_type: "file", display_order: Number(id.replace(/\D/g, "")) || 0, required_for_verification: true, ...type },
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
    await vi.waitFor(() => expect(state.post).toHaveBeenCalledWith("/provider-applications/me/open", {}));
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
    const group = screen.getByRole("region", { name: "Other documents" });
    expect(within(group).getByText("1 left")).toBeInTheDocument();
    const list = within(group).getByRole("list", { name: "Documents in Other documents" });
    expect(within(list).getByText("Sent, waiting for review")).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Add Practising licence" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Replace National ID" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b(missing|pending|rejected)\b/);

    fireEvent.click(within(list).getByRole("button", { name: "Add Practising licence" }));
    expect(within(list).getByText("Choose a file")).toBeInTheDocument();
    expect(within(list).getByText("Take a photo")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Add National ID" }));
    const input = screen.getByText("Choose a file").closest("label")!.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "id.pdf", { type: "application/pdf" })] } });

    await vi.waitFor(() => expect(state.post).toHaveBeenCalledWith("/provider-applications/a1/items/1/upload", expect.any(FormData), expect.anything()));
  });

  it("lets a phone take a photo from its camera", async () => {
    state.status = summary({ status: "documents_needed", items_done: 0, items_total: 1 });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add National ID" }));
    const camera = screen.getByText("Take a photo").closest("label")!.querySelector("input[type=file]");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(camera).toHaveAttribute("accept", "image/*");
  });
});

describe("documents owed by a provider who was already working", () => {
  const owing = (overrides: Record<string, unknown> = {}) =>
    summary({
      status: "set_up_by_facility",
      documents_in_order: false,
      documents_due_on: "2026-12-25",
      documents_days_left: 12,
      required_total: 4,
      ...overrides
    });

  it("says what is owed and by when, and offers to add the documents", async () => {
    state.status = owing();
    await renderPage();

    const card = screen.getByRole("region", { name: "Verification status" });
    expect(within(card).getByText("Add your documents to keep taking bookings")).toBeInTheDocument();
    expect(within(card).getByText(/in 12 days/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Add your documents" }));
    await vi.waitFor(() => expect(state.post).toHaveBeenCalledWith("/provider-applications/me/open", {}));
  });

  it("groups documents, says how many required ones are left, and marks optional ones", async () => {
    state.status = owing();
    state.application = {
      id: "a1",
      status: "draft",
      items: [
        appItem("1", "National ID or passport", "missing", {}, { key: "national-id" }),
        appItem("2", "Curriculum vitae", "missing", {}, { key: "cv", required_for_verification: false })
      ]
    };
    await renderPage();

    const identity = screen.getByRole("region", { name: "Your identity" });
    expect(within(identity).getByText("1 left")).toBeInTheDocument();
    expect(within(identity).getByRole("button", { name: "Add National ID or passport" })).toBeInTheDocument();

    const professional = screen.getByRole("region", { name: "Your professional standing" });
    expect(within(professional).getByText("Done")).toBeInTheDocument();
    expect(within(professional).queryByRole("button", { name: "Add Curriculum vitae" })).not.toBeInTheDocument();
    fireEvent.click(within(professional).getByRole("button", { name: /Your professional standing/ }));
    expect(within(professional).getByText("Optional")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add your documents" })).not.toBeInTheDocument();
  });

  it("asks for the expiry date before a dated document can be uploaded, then sends it with the file", async () => {
    state.status = owing();
    state.application = {
      id: "a1",
      status: "draft",
      items: [appItem("1", "Practising licence", "missing", {}, { required_for_verification: true, has_expiry: true })]
    };
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add Practising licence" }));

    const file = screen.getByText("Choose a file").closest("label")!.querySelector("input[type=file]") as HTMLInputElement;
    expect(file).toBeDisabled();
    expect(screen.getByText("Enter the date first, then choose the file.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Expiry date"), { target: { value: "2027-03-31" } });
    expect(file).not.toBeDisabled();
    fireEvent.change(file, { target: { files: [new File(["x"], "licence.pdf", { type: "application/pdf" })] } });

    await vi.waitFor(() => expect(state.post).toHaveBeenCalled());
    const form = state.post.mock.calls[0][1] as FormData;
    expect(form.get("expires_on")).toBe("2027-03-31");
  });

  it("takes the KRA PIN and the M-Pesa number as one-line typed answers with an example", async () => {
    state.status = owing();
    state.application = {
      id: "a1",
      status: "draft",
      items: [
        appItem("1", "KRA PIN number", "missing", {}, { key: "kra-pin", input_type: "text", required_for_verification: true }),
        appItem("2", "M-Pesa number for payouts", "missing", {}, { key: "payout-details", input_type: "text", required_for_verification: true })
      ]
    };
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add KRA PIN number" }));
    fireEvent.click(screen.getByRole("button", { name: /Payments and agreements/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add M-Pesa number for payouts" }));

    const kra = screen.getByLabelText("KRA PIN number") as HTMLInputElement;
    expect(kra.tagName).toBe("INPUT");
    expect(kra).toHaveAttribute("placeholder", "A123456789B");
    expect(screen.getByLabelText("M-Pesa number for payouts")).toHaveAttribute("inputmode", "tel");
    expect(document.querySelector("textarea")).toBeNull();

    fireEvent.change(kra, { target: { value: "A123456789B" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save answer" })[0]);
    await vi.waitFor(() =>
      expect(state.put).toHaveBeenCalledWith("/provider-applications/a1/items/1", { value_text: "A123456789B", status: "pending" })
    );
  });
});
