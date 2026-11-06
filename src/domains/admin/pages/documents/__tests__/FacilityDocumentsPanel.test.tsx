/**
 * A facility's checklist. The facility admin adds, sends and tracks; the super admin can also add for the facility
 * and alone approves or sends back. Papers Tiba Ya Home adds are never the facility admin's to upload.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  payload: {} as Record<string, unknown>,
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
  toast: vi.fn(),
  failPost: false,
  failGet: false,
  postResult: {} as Record<string, unknown>
}));

vi.mock("../../../../../shared/libs/api", () => ({
  api: { get: (...a: unknown[]) => state.get(...a), post: (...a: unknown[]) => state.post(...a), delete: (...a: unknown[]) => state.del(...a) }
}));
vi.mock("../../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: state.toast }) }));
vi.mock("../../../../provider/components/onboarding/DocumentPreviewModal", () => ({
  DocumentPreviewModal: ({ source, title }: { source: string | null; title: string }) =>
    source ? <div role="dialog" aria-label={`Preview of ${title}`}>{source}</div> : null
}));

import { FacilityDocumentsPanel } from "../FacilityDocumentsPanel";

type Doc = Record<string, unknown>;

const doc = (key: string, label: string, status: string, extra: Doc = {}, requirement: Doc = {}): Doc => ({
  id: `d-${key}`,
  status,
  expires_on: null,
  comment: null,
  has_file: !["missing", "not_applicable"].includes(status),
  download_url: ["missing", "not_applicable"].includes(status) ? null : `/api/v1/facilities/f1/documents/d-${key}/file`,
  filename: null,
  submitted_at: null,
  verified_at: null,
  can_upload: ["missing", "uploaded", "rejected"].includes(status),
  requirement: { id: `r-${key}`, key, label, description: null, required: true, only_if_offered: false, has_expiry: false, super_admin_uploads: false, display_order: 1, ...requirement },
  ...extra
});

const summary = (overrides: Doc = {}) => ({
  state: "incomplete",
  required_total: 3,
  required_approved: 1,
  waiting: 0,
  sent_back: 0,
  added_not_sent: 0,
  missing_required: 2,
  in_order: false,
  documents_due_on: null,
  documents_days_left: null,
  ...overrides
});

const pdf = () => new File(["%PDF-1.4 test"], "licence.pdf", { type: "application/pdf" });

const renderPanel = (mode: "facility_admin" | "super_admin") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FacilityDocumentsPanel facilityId="f1" mode={mode} />
    </QueryClientProvider>
  );

const card = (label: string) => screen.getByRole("heading", { level: 3, name: label }).closest("li") as HTMLElement;

beforeEach(() => {
  state.payload = {
    facility: { id: "f1", name: "Example Clinic" },
    summary: summary(),
    documents: [
      doc("reg", "Business registration", "verified", {}, { display_order: 1 }),
      doc("cr12", "CR12 or CR13", "missing", {}, { display_order: 2 }),
      doc("kmpdc", "KMPDC facility licence", "missing", {}, { display_order: 3, has_expiry: true }),
      doc("pharmacy", "Pharmacy licence", "missing", {}, { display_order: 4, required: false, only_if_offered: true, has_expiry: true }),
      doc("agreement", "Signed service agreement", "missing", { can_upload: false }, { display_order: 5, super_admin_uploads: true }),
      doc("kra", "KRA PIN certificate", "missing", {}, { display_order: 6, required: false })
    ]
  };
  state.failPost = false;
  state.failGet = false;
  state.postResult = {};
  for (const mock of [state.get, state.post, state.del, state.toast]) mock.mockReset();
  state.get.mockImplementation(async () => {
    if (state.failGet) throw Object.assign(new Error("boom"), { isAxiosError: true, response: { status: 500 } });
    return { data: { data: state.payload } };
  });
  state.post.mockImplementation(async () => {
    if (state.failPost) throw Object.assign(new Error("no"), { isAxiosError: true, response: { status: 400, data: { error: { message: "Upload a PDF, JPG or PNG file." } } } });
    return { data: { data: state.postResult } };
  });
  state.del.mockResolvedValue({ data: { data: {} } });
});

describe("Facility checklist, as the facility admin", () => {
  it("shows how far the required list is, and groups the documents", async () => {
    renderPanel("facility_admin");

    expect(await screen.findByText("1 of 3 required documents approved")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Required documents approved" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Required documents",
      "If it applies to your facility",
      "Other documents"
    ]);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("holds an upload until a dated document has its expiry date, then sends the date with the file", async () => {
    renderPanel("facility_admin");
    const licence = within(await screen.findByRole("heading", { level: 3, name: "KMPDC facility licence" }).then((h) => h.closest("li") as HTMLElement));

    expect(licence.getByRole("button", { name: /Upload KMPDC facility licence/ })).toBeDisabled();
    fireEvent.change(licence.getByLabelText("Expiry date"), { target: { value: "2031-03-31" } });
    expect(licence.getByRole("button", { name: /Upload KMPDC facility licence/ })).toBeEnabled();
    fireEvent.change(licence.getByTestId("file-input"), { target: { files: [pdf()] } });

    await waitFor(() => expect(state.post).toHaveBeenCalled());
    const [url, form] = state.post.mock.calls[0] as [string, FormData];
    expect(url).toBe("/facilities/f1/documents/d-kmpdc/upload");
    expect(form.get("expires_on")).toBe("2031-03-31");
    expect((form.get("file") as File).name).toBe("licence.pdf");
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Document added" }));
  });

  it("refuses a file that is not a PDF, JPG or PNG before it leaves the page", async () => {
    renderPanel("facility_admin");
    const cr12 = within(await screen.findByRole("heading", { level: 3, name: "CR12 or CR13" }).then((h) => h.closest("li") as HTMLElement));

    fireEvent.change(cr12.getByTestId("file-input"), { target: { files: [new File(["x"], "notes.docx", { type: "application/msword" })] } });

    expect(await cr12.findByRole("alert")).toBeInTheDocument();
    expect(state.post).not.toHaveBeenCalled();
  });

  it("sends everything added for review, and says how many", async () => {
    state.payload = { ...state.payload, summary: summary({ added_not_sent: 2 }) };
    state.postResult = { sent: 2 };
    renderPanel("facility_admin");

    fireEvent.click(await screen.findByRole("button", { name: "Send 2 for review" }));

    await waitFor(() => expect(state.post).toHaveBeenCalledWith("/facilities/f1/documents/send", {}));
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Sent for review" }));
  });

  it("offers no send button when nothing was added", async () => {
    renderPanel("facility_admin");
    await screen.findByText("1 of 3 required documents approved");

    expect(screen.queryByRole("button", { name: /for review$/ })).not.toBeInTheDocument();
  });

  it("does not let the facility admin upload what Tiba Ya Home adds", async () => {
    renderPanel("facility_admin");
    const agreement = within(await screen.findByRole("heading", { level: 3, name: "Signed service agreement" }).then((h) => h.closest("li") as HTMLElement));

    expect(agreement.getByText("Added by Tiba Ya Home. You do not need to upload it.")).toBeInTheDocument();
    expect(agreement.queryByRole("button", { name: /Upload/ })).not.toBeInTheDocument();
  });

  it("lets a facility say a where-applicable document does not apply to it, and take that back", async () => {
    renderPanel("facility_admin");
    fireEvent.click(await within(await screen.findByRole("heading", { level: 3, name: "Pharmacy licence" }).then((h) => h.closest("li") as HTMLElement)).findByRole("button", { name: "This does not apply to us" }));

    await waitFor(() => expect(state.post).toHaveBeenCalledWith("/facilities/f1/documents/d-pharmacy/applicability", { applicable: false }));
  });

  it("shows the reason a document was sent back, and lets it be viewed and removed", async () => {
    state.payload = {
      ...state.payload,
      documents: [doc("cr12", "CR12 or CR13", "rejected", { comment: "The stamp is missing" })]
    };
    renderPanel("facility_admin");
    const cr12 = within(await screen.findByRole("heading", { level: 3, name: "CR12 or CR13" }).then((h) => h.closest("li") as HTMLElement));

    expect(cr12.getByText(/The stamp is missing/)).toBeInTheDocument();
    expect(cr12.getByText("Sent back")).toBeInTheDocument();
    fireEvent.click(cr12.getByRole("button", { name: "View CR12 or CR13" }));
    expect(await screen.findByRole("dialog", { name: "Preview of CR12 or CR13" })).toHaveTextContent("/documents/d-cr12/file");
    fireEvent.click(cr12.getByRole("button", { name: "Remove CR12 or CR13" }));
    await waitFor(() => expect(state.del).toHaveBeenCalledWith("/facilities/f1/documents/d-cr12/document"));
  });

  it("keeps the upload button short on a card that already names the document, and still names it for screen readers", async () => {
    renderPanel("facility_admin");
    const cr12 = within(await screen.findByRole("heading", { level: 3, name: "CR12 or CR13" }).then((h) => h.closest("li") as HTMLElement));

    const button = cr12.getByRole("button", { name: "Upload CR12 or CR13" });
    expect(button).toHaveTextContent(/^Upload$/);
  });

  it("never offers the facility admin a way to approve", async () => {
    state.payload = { ...state.payload, documents: [doc("cr12", "CR12 or CR13", "submitted")] };
    renderPanel("facility_admin");
    await screen.findByText("CR12 or CR13");

    expect(screen.queryByRole("button", { name: /^Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Send back/ })).not.toBeInTheDocument();
  });

  it("shows the grace countdown while documents are owed", async () => {
    state.payload = { ...state.payload, summary: summary({ documents_days_left: 12, documents_due_on: "2026-12-01" }) };
    renderPanel("facility_admin");

    expect(await screen.findByText("You have 12 days to have the required documents approved.")).toBeInTheDocument();
  });

  it("explains a failed load and lets the person try again", async () => {
    state.failGet = true;
    renderPanel("facility_admin");

    expect(within(await screen.findByRole("alert")).getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows the server's reason when an upload is refused", async () => {
    state.failPost = true;
    renderPanel("facility_admin");
    const cr12 = within(await screen.findByRole("heading", { level: 3, name: "CR12 or CR13" }).then((h) => h.closest("li") as HTMLElement));

    fireEvent.change(cr12.getByTestId("file-input"), { target: { files: [pdf()] } });

    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Upload failed", variant: "error" })));
  });
});

describe("Facility checklist, as the super admin", () => {
  beforeEach(() => {
    state.payload = {
      ...state.payload,
      summary: summary({ state: "waiting", waiting: 2 }),
      documents: [
        doc("cr12", "CR12 or CR13", "submitted"),
        doc("kmpdc", "KMPDC facility licence", "submitted", { expires_on: "2031-03-31" }, { has_expiry: true }),
        doc("reg", "Business registration", "verified"),
        doc("agreement", "Signed service agreement", "missing", { can_upload: true }, { super_admin_uploads: true })
      ]
    };
  });

  it("approves a document that is waiting", async () => {
    state.postResult = { summary: summary() };
    renderPanel("super_admin");
    fireEvent.click(await screen.findByRole("button", { name: "Approve CR12 or CR13" }));

    await waitFor(() => expect(state.post).toHaveBeenCalledWith("/facility-documents/d-cr12/review", { decision: "approved" }));
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Approved", description: "CR12 or CR13" }));
  });

  it("says so when the last required document is approved", async () => {
    state.postResult = { summary: summary({ in_order: true, state: "complete" }) };
    renderPanel("super_admin");
    fireEvent.click(await screen.findByRole("button", { name: "Approve CR12 or CR13" }));

    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "All required documents are approved" })));
  });

  it("will not send a document back without a reason, then sends it with one", async () => {
    state.postResult = { summary: summary() };
    renderPanel("super_admin");
    fireEvent.click(await screen.findByRole("button", { name: "Send back CR12 or CR13" }));

    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Send back" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("What needs to change"), { target: { value: "The stamp is missing" } });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith("/facility-documents/d-cr12/review", { decision: "sent_back", note: "The stamp is missing" })
    );
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Sent back" }));
  });

  it("can add the signed agreement for the facility, and offers no send button", async () => {
    renderPanel("super_admin");
    const agreement = within(await screen.findByRole("heading", { level: 3, name: "Signed service agreement" }).then((h) => h.closest("li") as HTMLElement));

    expect(agreement.getByRole("button", { name: /Upload Signed service agreement/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /for review$/ })).not.toBeInTheDocument();
    expect(screen.getByText("2 documents are waiting for your review.")).toBeInTheDocument();
  });

  it("talks about this facility, not yours, when the super admin is looking at someone else's", async () => {
    state.payload = {
      ...state.payload,
      documents: [doc("pharmacy", "Pharmacy licence", "missing", {}, { required: false, only_if_offered: true, has_expiry: true })]
    };
    renderPanel("super_admin");

    expect(await screen.findByRole("heading", { level: 2, name: "If it applies to this facility" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "If it applies to your facility" })).not.toBeInTheDocument();
  });

  it("shows no decision on an approved document", async () => {
    renderPanel("super_admin");
    await screen.findByText("Business registration");

    expect(screen.queryByRole("button", { name: "Approve Business registration" })).not.toBeInTheDocument();
  });
});
