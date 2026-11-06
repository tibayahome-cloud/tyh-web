/**
 * One provider's documents: approve or send back, one at a time. The reviewer only gets the buttons once the provider
 * has sent the documents, a send-back needs a reason, and approving the last required one says the provider is verified.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  application: {} as Record<string, unknown>,
  get: vi.fn(),
  post: vi.fn(),
  toast: vi.fn(),
  postResult: { application_status: "submitted", provider_verified: false } as Record<string, unknown>,
  failPost: false,
  failGet: false
}));

vi.mock("../../../../../shared/libs/api", () => ({
  api: { get: (...args: unknown[]) => state.get(...args), post: (...args: unknown[]) => state.post(...args) }
}));
vi.mock("../../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: state.toast }) }));
vi.mock("../../../../provider/components/onboarding/DocumentPreviewModal", () => ({
  DocumentPreviewModal: ({ source, title }: { source: string | null; title: string }) =>
    source ? <div role="dialog" aria-label={`Preview of ${title}`}>{source}</div> : null
}));

import { ProviderDocumentsReviewPage } from "../ProviderDocumentsReviewPage";

const item = (id: string, label: string, status: string, extra: Record<string, unknown> = {}, type: Record<string, unknown> = {}) => ({
  id,
  status,
  value_text: null,
  file_url: status === "missing" ? null : `/api/v1/provider-applications/app-1/items/${id}/file`,
  download_url: status === "missing" ? null : `/api/v1/provider-applications/app-1/items/${id}/file`,
  comment: null,
  expires_on: null,
  requirement_type: { id: `r-${id}`, key: id, label, input_type: "file", display_order: Number(id.replace(/\D/g, "")) || 0, required_for_verification: true, has_expiry: false, ...type },
  ...extra
});

const application = (status: string, items: Array<Record<string, unknown>>) => ({
  id: "app-1",
  status,
  user: { id: "u-1", full_name: "Dr Example", email: "provider@example.test" },
  items
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/documents/providers/app-1"]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Routes>
          <Route path="/admin/documents/providers/:applicationId" element={<ProviderDocumentsReviewPage />} />
          <Route path="/admin/documents" element={<p>queue</p>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  state.application = application("submitted", [
    item("n1", "National ID", "verified"),
    item("n2", "Practising licence", "pending", { expires_on: "2030-03-31" }, { has_expiry: true }),
    item("n3", "Professional registration", "pending"),
    item("n4", "CV", "pending", {}, { required_for_verification: false })
  ]);
  state.postResult = { application_status: "submitted", provider_verified: false };
  state.failPost = false;
  state.failGet = false;
  state.get.mockReset();
  state.post.mockReset();
  state.toast.mockReset();
  state.get.mockImplementation(async () => {
    if (state.failGet) throw Object.assign(new Error("nope"), { isAxiosError: true, response: { status: 500 } });
    return { data: { data: state.application } };
  });
  state.post.mockImplementation(async () => {
    if (state.failPost) throw Object.assign(new Error("denied"), { isAxiosError: true, response: { status: 403, data: { error: { message: "Not permitted to review this provider's documents" } } } });
    return { data: { data: state.postResult } };
  });
});

describe("Reviewing a provider's documents", () => {
  it("shows who it is, how far the required list is, and the required documents before the rest", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Dr Example" })).toBeInTheDocument();
    expect(screen.getByText("1 of 3 required documents approved")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Required documents approved" })).toHaveAttribute("aria-valuenow", "1");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Required documents", "Other documents"]);
    expect(screen.getByText(/You do not need a second approval/)).toBeInTheDocument();
  });

  it("gives approve and send back only for documents waiting for the reviewer", async () => {
    renderPage();
    await screen.findByText("Practising licence");

    expect(screen.getByRole("button", { name: "Approve Practising licence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send back Practising licence" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve National ID" })).not.toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("approves a document and says so", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve Professional registration" }));

    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith("/provider-applications/app-1/items/n3/review", { decision: "approved" })
    );
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Approved", description: "Professional registration" }));
  });

  it("says the provider is verified when the last required document is approved", async () => {
    state.postResult = { application_status: "approved", provider_verified: true };
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Approve Practising licence" }));

    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Dr Example is now verified" })));
  });

  it("will not send a document back without a reason, then sends it with one", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Send back Practising licence" }));

    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Send back" });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("What needs to change"), { target: { value: "The photo is blurry" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith("/provider-applications/app-1/items/n2/review", { decision: "sent_back", note: "The photo is blurry" })
    );
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Sent back" }));
  });

  it("opens the document for viewing", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "View Practising licence" }));

    expect(await screen.findByRole("dialog", { name: "Preview of Practising licence" })).toHaveTextContent("/items/n2/file");
  });

  it("shows the expiry date and the reason a document was sent back", async () => {
    state.application = application("under_review", [
      item("n1", "National ID", "rejected", { comment: "The photo is blurry" }),
      item("n2", "Practising licence", "verified", { expires_on: "2030-03-31" }, { has_expiry: true })
    ]);
    renderPage();

    expect(await screen.findByText("Expires 31 Mar 2030")).toBeInTheDocument();
    expect(screen.getByText(/The photo is blurry/)).toBeInTheDocument();
    expect(screen.getByText("Sent back")).toBeInTheDocument();
  });

  it("offers no decisions while the provider has not sent the documents", async () => {
    state.application = application("draft", [item("n1", "National ID", "pending"), item("n2", "Practising licence", "missing")]);
    renderPage();

    expect(await screen.findByText(/has not sent these for review yet/)).toBeInTheDocument();
    expect(screen.getByText("Not sent yet")).toBeInTheDocument();
    expect(screen.getByText("Not added")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Send back/ })).not.toBeInTheDocument();
  });

  it("says a verified provider is verified", async () => {
    state.application = application("approved", [item("n1", "National ID", "verified")]);
    renderPage();

    expect(await screen.findByRole("status")).toHaveTextContent("Dr Example is verified.");
  });

  it("shows typed answers such as a KRA PIN right on the page", async () => {
    state.application = application("submitted", [
      item("n1", "KRA PIN", "pending", { value_text: "A123456789B", file_url: null, download_url: null }, { input_type: "text", required_for_verification: false })
    ]);
    renderPage();

    expect(await screen.findByText("A123456789B")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View KRA PIN" })).not.toBeInTheDocument();
  });

  it("tells the reviewer when a decision is refused", async () => {
    state.failPost = true;
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve Practising licence" }));

    await waitFor(() =>
      expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "That did not go through", variant: "error" }))
    );
  });

  it("explains a failed load and offers another try", async () => {
    state.failGet = true;
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
