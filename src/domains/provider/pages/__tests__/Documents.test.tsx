/**
 * The provider's Documents page: the legal documents they have accepted, and every document they have sent, with its
 * state in words, any expiry date, and a way to open it.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  legal: [] as unknown[],
  application: null as unknown,
  appError: false,
  status: { status: "documents_needed" } as Record<string, unknown>
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "p1", legalConsent: { required: true, complete: true, documents: state.legal } } }) }));
vi.mock("../../../../shared/libs/api", () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url === "/provider-applications/me/status") return { data: { data: state.status } };
      if (url === "/provider-applications/me") {
        if (state.appError) throw Object.assign(new Error("boom"), { isAxiosError: true, response: { status: 500 } });
        if (!state.application) throw Object.assign(new Error("not found"), { isAxiosError: true, response: { status: 404 } });
        return { data: { data: state.application } };
      }
      return { data: { data: {} } };
    })
  }
}));
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return { ...actual, isAxiosError: (e: { isAxiosError?: boolean }) => Boolean(e?.isAxiosError) };
});
vi.mock("../../components/onboarding/DocumentPreviewModal", () => ({
  DocumentPreviewModal: ({ source, title }: { source: string | null; title: string }) => (source ? <p>Previewing {title}</p> : null)
}));

import DocumentsPage from "../Documents";

const item = (id: string, label: string, status: string, extra: Record<string, unknown> = {}, type: Record<string, unknown> = {}) => ({
  id,
  status,
  file_url: null,
  download_url: null,
  value_text: null,
  comment: null,
  expires_on: null,
  requirement_type: { id: `r${id}`, label, input_type: "file", display_order: Number(id), required_for_verification: false, ...type },
  ...extra
});

const renderPage = async () => {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DocumentsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
  return screen.findByRole("heading", { name: "Documents" });
};

beforeEach(() => {
  state.legal = [];
  state.application = null;
  state.appError = false;
  state.status = { status: "documents_needed" };
});

describe("legal documents", () => {
  it("lists each with its version, when it was accepted and a link to read it", async () => {
    state.legal = [
      { type: "terms", version: "2026-01", accepted: true, accepted_at: "2026-03-05T09:00:00+00:00", public_url: "https://example.test/terms" },
      { type: "privacy", version: "2026-01", accepted: true, accepted_at: null, public_url: "https://example.test/privacy" }
    ];
    await renderPage();

    const list = screen.getByRole("list", { name: "Legal documents" });
    expect(within(list).getByText("Terms of Service")).toBeInTheDocument();
    expect(within(list).getByText(/Version 2026-01, accepted 5 Mar 2026/)).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "Read Terms of Service" })).toHaveAttribute("href", "https://example.test/terms");
    expect(within(list).getByRole("link", { name: "Read Privacy Policy" })).toHaveAttribute("target", "_blank");
  });

  it("says so when there is nothing to show", async () => {
    await renderPage();
    expect(screen.getByText("No legal documents to show yet.")).toBeInTheDocument();
  });
});

describe("your documents", () => {
  it("shows what was sent with its state in words, the expiry date, and opens a document", async () => {
    state.application = {
      id: "a1",
      status: "draft",
      items: [
        item("1", "National ID or passport", "pending", { file_url: "/f1", download_url: "/f1" }),
        item("2", "Current annual practising licence", "verified", { file_url: "/f2", download_url: "/f2", expires_on: "2020-01-15" }, { has_expiry: true }),
        item("3", "KRA PIN number", "pending", { value_text: "A123456789B" }, { input_type: "text" })
      ]
    };
    await renderPage();

    const list = await screen.findByRole("list", { name: "Documents you have sent" });
    expect(within(list).getAllByText("Uploaded")).toHaveLength(2);
    expect(within(list).getByText("Approved")).toBeInTheDocument();
    expect(within(list).getByText("Expired 15 Jan 2020")).toBeInTheDocument();
    expect(within(list).getByText("A123456789B")).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: "View KRA PIN number" })).not.toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: "View National ID or passport" }));
    expect(screen.getByText("Previewing National ID or passport")).toBeInTheDocument();
  });

  it("calls an uploaded document waiting for review only once it has been sent", async () => {
    state.status = { status: "in_review" };
    state.application = { id: "a1", status: "submitted", items: [item("1", "National ID", "pending", { file_url: "/f1" })] };
    await renderPage();

    expect(await screen.findByText("Waiting for review")).toBeInTheDocument();
  });

  it("lists what is still needed and links to where to add it", async () => {
    state.application = { id: "a1", status: "draft", items: [item("1", "National ID", "missing", {}, { required_for_verification: true })] };
    await renderPage();

    const needed = await screen.findByRole("list", { name: "Documents still needed" });
    expect(within(needed).getByText("National ID")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add them" })).toHaveAttribute("href", "/pro/onboarding");
  });

  it("invites a provider with nothing sent to add documents", async () => {
    await renderPage();
    expect(await screen.findByText("You have not sent any documents yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add your documents" })).toHaveAttribute("href", "/pro/onboarding");
  });

  it("says the documents could not be loaded instead of showing an empty page", async () => {
    state.appError = true;
    await renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not load your documents.");
    expect(screen.queryByText("You have not sent any documents yet.")).not.toBeInTheDocument();
  });
});
