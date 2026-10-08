import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
vi.mock("../../../../shared/libs/facilities", () => ({
  updateFacilityAdminProfile: (...args: unknown[]) => updateMock(...args)
}));

import type { FacilityAdminAccess } from "../../../../shared/libs/facilities";
import { FacilityAdminProfileEditor, buildAdminProfileChanges } from "../FacilityAdminProfileEditor";

const admin: FacilityAdminAccess = {
  id: "a-1", facilityId: "f-1", userId: "u-1", fullName: "Amina Ops", email: "amina@clinic.test",
  phone: "+254700000001", userStatus: "active", emailVerifiedAt: null, phoneVerifiedAt: "2026-09-01T00:00:00Z",
  roleKey: "admin.ops", active: true, assignmentStatus: "active", suspendedAt: null, suspensionReason: null, removedAt: null, pendingEmail: null,
  invitation: { status: "completed", resetId: null, expiresAt: null, redeemedAt: null }
};

const apiError = (status: number, message: string, details?: Record<string, string[]>) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status, statusText: "", headers: {}, config: {} as never,
    data: { error: { code: status, name: "x", message, ...(details ? { details } : {}) } }
  });

const setup = (override: Partial<FacilityAdminAccess> = {}) => {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <FacilityAdminProfileEditor facilityId="f-1" admin={{ ...admin, ...override }} onSaved={onSaved} onCancel={onCancel} />
    </QueryClientProvider>
  );
  return { onSaved, onCancel };
};

describe("buildAdminProfileChanges", () => {
  it("sends nothing when unchanged and only what differs otherwise", () => {
    expect(buildAdminProfileChanges(admin, { fullName: "Amina Ops", email: "AMINA@clinic.test", phone: "+254700000001" })).toEqual({});
    expect(buildAdminProfileChanges(admin, { fullName: " Amina K ", email: "amina@clinic.test", phone: "" })).toEqual({ fullName: "Amina K", phone: null });
  });
});

describe("FacilityAdminProfileEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue({ admin: { ...admin }, emailChange: null });
  });

  it("saves a name change straight away with no email confirmation", async () => {
    const user = userEvent.setup();
    const { onSaved } = setup();
    const name = screen.getByLabelText(/^Full name/);
    await user.clear(name);
    await user.type(name, "Amina Kamau");
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith("f-1", "u-1", { fullName: "Amina Kamau" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledWith("Details saved.");
  });

  it("warns that a phone change needs verifying again", async () => {
    const user = userEvent.setup();
    const { onSaved } = setup();
    const phone = screen.getByLabelText(/^Phone/);
    await user.clear(phone);
    await user.type(phone, "+254711111111");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Details saved. The phone number needs to be verified again."));
  });

  it("confirms an email change first, explaining sign-in, sessions and nothing sent until confirmed", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue({ admin: { ...admin }, emailChange: { status: "pending_verification", email: "new@clinic.test", expiresInSeconds: 3600 } });
    const { onSaved } = setup();
    const email = screen.getByLabelText(/^Email/);
    await user.clear(email);
    await user.type(email, "new@clinic.test");
    await user.click(screen.getByRole("button", { name: "Save details" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("verification link to new@clinic.test");
    expect(dialog).toHaveTextContent("amina@clinic.test stays the sign-in address until the new one is verified");
    expect(dialog).toHaveTextContent(/signed out everywhere/i);
    expect(dialog).not.toHaveTextContent(/setup invitation/i);
    expect(updateMock).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Send verification link" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith("f-1", "u-1", { email: "new@clinic.test" }));
    expect(onSaved).toHaveBeenCalledWith(expect.stringContaining("A verification link was sent to new@clinic.test. amina@clinic.test stays the sign-in address"));
  });

  it("mentions the setup invitation for an account that has not finished setup", async () => {
    const user = userEvent.setup();
    setup({ userStatus: "pending" });
    const email = screen.getByLabelText(/^Email/);
    await user.clear(email);
    await user.type(email, "new@clinic.test");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(/new setup invitation is sent to the verified address/i);
  });

  it("cancelling the confirmation sends nothing", async () => {
    const user = userEvent.setup();
    setup();
    const email = screen.getByLabelText(/^Email/);
    await user.clear(email);
    await user.type(email, "new@clinic.test");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /cancel/i }));
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("validates name and email before calling the API", async () => {
    const user = userEvent.setup();
    setup();
    await user.clear(screen.getByLabelText(/^Full name/));
    await user.clear(screen.getByLabelText(/^Email/));
    await user.type(screen.getByLabelText(/^Email/), "nope");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByText("Enter the administrator's name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("shows the API's field-keyed errors beside the matching inputs", async () => {
    const user = userEvent.setup();
    updateMock.mockRejectedValue(apiError(400, "One or more fields are invalid", { phone: ["Phone number is already in use."], email: ["Email is already in use."] }));
    setup();
    const phone = screen.getByLabelText(/^Phone/);
    await user.clear(phone);
    await user.type(phone, "+254722222222");
    await user.click(screen.getByRole("button", { name: "Save details" }));

    expect(await screen.findByText("Phone number is already in use.")).toBeInTheDocument();
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    [429, /too many changes/i],
    [404, /no longer assigned/i]
  ])("explains a %s response", async (status, pattern) => {
    const user = userEvent.setup();
    updateMock.mockRejectedValue(apiError(status, "x"));
    setup();
    await user.type(screen.getByLabelText(/^Full name/), "!");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(pattern);
  });

  it("closes without saving on Cancel and on Escape", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
