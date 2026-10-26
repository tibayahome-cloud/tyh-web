/**
 * Provider onboarding: one status at the top in plain words, a checklist with one action per document, and the right
 * state for providers who are verified or were set up by their facility and have no application at all.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: {} as Record<string, unknown>, application: null as unknown, post: vi.fn(), put: vi.fn(), del: vi.fn() }));

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
    delete: (...args: unknown[]) => state.del(...args),
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
  state.del.mockReset();
  state.del.mockResolvedValue({});
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
    expect(within(list).getByText("Uploaded")).toBeInTheDocument();
    expect(screen.queryByText("Sent, waiting for review")).not.toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Add Practising licence" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Replace National ID" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b(missing|pending|rejected)\b/);

    fireEvent.click(within(list).getByRole("button", { name: "Add Practising licence" }));
    expect(within(list).queryByRole("menuitem", { name: "Take a photo" })).not.toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: "Upload" }));
    expect(within(list).getByRole("menuitem", { name: "Choose a file" })).toBeInTheDocument();
    expect(within(list).getByRole("menuitem", { name: "Take a photo" })).toBeInTheDocument();
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

  it("everything uploaded: asks you to check and confirm before it sends for review", async () => {
    state.status = summary({ status: "documents_needed", items_done: 1, items_total: 1, ready_to_submit: true });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "pending")] };
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Send for review" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Check before you send")).toBeInTheDocument();
    expect(within(dialog).getByRole("list", { name: "Required documents you are sending" })).toHaveTextContent("National ID");
    expect(state.post).not.toHaveBeenCalled();

    const send = within(dialog).getByRole("button", { name: "Send for review" });
    expect(send).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText(/These documents are mine/));
    expect(send).not.toBeDisabled();
    fireEvent.click(send);

    await vi.waitFor(() => expect(state.post).toHaveBeenCalledWith("/provider-applications/a1/submit", {}));
  });

  it("going back from the confirmation sends nothing", async () => {
    state.status = summary({ status: "documents_needed", items_done: 1, items_total: 1, ready_to_submit: true });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "pending")] };
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Send for review" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Go back" }));

    expect(state.post).not.toHaveBeenCalled();
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
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "id.pdf", { type: "application/pdf" })] } });

    await vi.waitFor(() => expect(state.post).toHaveBeenCalledWith("/provider-applications/a1/items/1/upload", expect.any(FormData), expect.anything()));
  });

  it("lets a phone take a photo from its camera", async () => {
    state.status = summary({ status: "documents_needed", items_done: 0, items_total: 1 });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add National ID" }));
    const camera = screen.getByTestId("camera-input");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(camera).toHaveAttribute("accept", "image/jpeg,image/png");
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

    const file = screen.getByTestId("file-input") as HTMLInputElement;
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    expect(screen.getByText("Enter the date first, then choose the file.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Expiry date"), { target: { value: "2027-03-31" } });
    expect(screen.getByRole("button", { name: "Upload" })).not.toBeDisabled();
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

describe("taking a document back", () => {
  it("offers Replace and Remove once something is uploaded, and removes it after a confirmation", async () => {
    state.status = summary({ status: "documents_needed", items_done: 1, items_total: 1 });
    state.application = {
      id: "a1",
      status: "draft",
      items: [appItem("1", "Practising licence", "pending", { file_url: "/x", download_url: "/x" })]
    };
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Other documents/ }));
    fireEvent.click(screen.getByRole("button", { name: "Replace Practising licence" }));
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(screen.getByText(/Uploaded, not sent yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove" }));
    await vi.waitFor(() => expect(state.del).toHaveBeenCalledWith("/provider-applications/a1/items/1/document"));
  });

  it("calls it waiting for review only once the application has been sent", async () => {
    state.status = summary({ status: "in_review", items_done: 1, items_total: 1 });
    state.application = { id: "a1", status: "submitted", items: [appItem("1", "National ID", "pending")] };
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Other documents/ }));
    expect(screen.getByText("Waiting for review")).toBeInTheDocument();
    expect(screen.queryByText("Uploaded")).not.toBeInTheDocument();
  });
});

describe("which files are accepted", () => {
  const openUploadFor = async () => {
    state.status = summary({ status: "documents_needed", items_done: 0, items_total: 1 });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add National ID" }));
  };

  it("says which files are allowed, and offers only those in the file picker", async () => {
    await openUploadFor();

    expect(screen.getByText("PDF, JPG or PNG, up to 10 MB")).toBeInTheDocument();
    const accept = screen.getByTestId("file-input").getAttribute("accept") ?? "";
    expect(accept).toContain(".pdf");
    expect(accept).toContain("image/png");
    expect(accept).not.toMatch(/doc|image\/\*/);
  });

  it("refuses a file of the wrong type before sending anything, and says why", async () => {
    await openUploadFor();

    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File(["x"], "cv.docx", { type: "application/msword" })] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("PDF, JPG or PNG");
    expect(state.post).not.toHaveBeenCalled();
  });

  it("refuses a file over 10 MB", async () => {
    await openUploadFor();
    const big = new File(["x"], "scan.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });

    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [big] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("10 MB");
    expect(state.post).not.toHaveBeenCalled();
  });

  it("accepts a PDF and a photo", async () => {
    await openUploadFor();

    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File(["x"], "id.pdf", { type: "application/pdf" })] } });
    await vi.waitFor(() => expect(state.post).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByTestId("camera-input"), { target: { files: [new File(["x"], "photo.jpg", { type: "image/jpeg" })] } });
    await vi.waitFor(() => expect(state.post).toHaveBeenCalledTimes(2));
  });
});

describe("taking a photo on a computer", () => {
  const stopTrack = vi.fn();
  const getUserMedia = vi.fn();

  const openMenu = async () => {
    state.status = summary({ status: "documents_needed", items_done: 0, items_total: 1 });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add National ID" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  };

  beforeEach(() => {
    stopTrack.mockReset();
    getUserMedia.mockReset();
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  });

  it("asks the browser for the camera and shows a preview instead of the file list", async () => {
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    await openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Take a photo" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    expect(screen.getByLabelText("Camera preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await vi.waitFor(() => expect(stopTrack).toHaveBeenCalled());
  });

  it("says how to fix a blocked camera, and points to choosing a file", async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    await openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Take a photo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/camera is blocked/i);
    expect(screen.queryByRole("button", { name: "Take photo" })).not.toBeInTheDocument();
  });
});

describe("after the application is sent", () => {
  const sent = () => {
    state.status = summary({ status: "in_review", items_done: 3, items_total: 3 });
    state.application = {
      id: "a1",
      status: "submitted",
      items: [
        appItem("1", "KRA PIN number", "pending", { value_text: "A123456789B" }, { key: "kra-pin", input_type: "text" }),
        appItem("2", "Academic certificates", "pending", { file_url: "/x", download_url: "/x" }, { key: "academic-certificates" }),
        appItem("3", "Curriculum vitae", "pending", { file_url: "/y", download_url: "/y" }, { key: "cv", editable_after_submission: true })
      ]
    };
  };

  it("makes documents that do not change view-only, and keeps the CV editable", async () => {
    sent();
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Your identity/ }));
    fireEvent.click(screen.getByRole("button", { name: /Your professional standing/ }));

    expect(screen.getByRole("button", { name: "View Academic certificates" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace Academic certificates" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /KRA PIN number/ })).not.toBeInTheDocument();
    expect(screen.getByText("A123456789B")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replace Curriculum vitae" }));
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("no longer shows how much work a provider can take: that is for a super admin", async () => {
    state.status = summary({ status: "documents_needed", items_done: 0, items_total: 1 });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    await renderPage();

    expect(screen.queryByText("How much work you can take")).not.toBeInTheDocument();
    expect(screen.queryByText(/Most requests you can take/)).not.toBeInTheDocument();
  });
});

describe("the flow reads in the right order", () => {
  it("puts the documents before the process steps and folds the steps while there is work to do", async () => {
    state.status = summary({ status: "documents_needed", items_done: 0, items_total: 1 });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    await renderPage();

    const documents = screen.getByRole("region", { name: "Your documents" });
    const process = screen.getByRole("region", { name: "Where you are" });
    expect(documents.compareDocumentPosition(process) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(process).getByText("You are at: Add your documents")).toBeInTheDocument();
    expect(within(process).queryByText("We check them")).not.toBeInTheDocument();

    fireEvent.click(within(process).getByRole("button", { name: /How the process works/ }));
    expect(within(process).getByText("We check them")).toBeInTheDocument();
  });

  it("keeps the steps open once the application is with a reviewer", async () => {
    state.status = summary({ status: "in_review", items_done: 1, items_total: 1 });
    state.application = { id: "a1", status: "submitted", items: [appItem("1", "National ID", "pending")] };
    await renderPage();

    const process = screen.getByRole("region", { name: "Where you are" });
    expect(within(process).getByText("We check them")).toBeInTheDocument();
  });

  it("offers a button that takes you to the next document", async () => {
    state.status = summary({
      status: "documents_needed",
      items_done: 0,
      items_total: 1,
      next_item: { requirement_key: "national-id", label: "National ID", input_type: "file", status: "missing", reviewer_note: null }
    });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Go to National ID" }));
    expect(scroll).toHaveBeenCalled();
  });

  it("tells a provider who is already verified that they keep working, and words the last step to match", async () => {
    state.status = summary({
      status: "documents_needed",
      items_done: 0,
      items_total: 1,
      provider_verified: true,
      documents_in_order: false,
      documents_days_left: 20
    });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    await renderPage();

    const process = screen.getByRole("region", { name: "Where you are" });
    fireEvent.click(within(process).getByRole("button", { name: /How the process works/ }));
    expect(within(process).getByText("Your documents are confirmed")).toBeInTheDocument();
    expect(within(process).queryByText("You are verified")).not.toBeInTheDocument();
  });

  it("makes you send again after something was handed back", async () => {
    state.status = summary({ status: "documents_needed", items_done: 1, items_total: 1, ready_to_submit: true });
    state.application = { id: "a1", status: "under_review", items: [appItem("1", "National ID", "pending")] };
    await renderPage();

    expect(screen.getByRole("button", { name: "Send for review" })).toBeInTheDocument();
    expect(state.post).not.toHaveBeenCalled();
  });

  it("moves between upload options with the arrow keys", async () => {
    state.status = summary({ status: "documents_needed", items_done: 0, items_total: 1 });
    state.application = { id: "a1", status: "draft", items: [appItem("1", "National ID", "missing")] };
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add National ID" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    const first = screen.getByRole("menuitem", { name: "Choose a file" });
    const second = screen.getByRole("menuitem", { name: "Take a photo" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "ArrowDown" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "ArrowUp" });
    expect(document.activeElement).toBe(second);
  });
});
