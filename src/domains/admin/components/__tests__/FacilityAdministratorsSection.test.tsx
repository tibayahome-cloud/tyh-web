/**
 * The super admin's recovery panel for a facility administrator: Pending, Expired and
 * Account active states, the one action that fits each, confirmation before a reset link (it
 * signs the admin out), and clear results and errors.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAccessMock = vi.fn();
const resendMock = vi.fn();
const resetMock = vi.fn();
const inviteMock = vi.fn();
const assignMock = vi.fn();
const statusMock = vi.fn();

vi.mock("../../../../shared/libs/facilities", () => ({
  inviteFacilityAdmin: (...args: unknown[]) => inviteMock(...args),
  assignFacilityAdmin: (...args: unknown[]) => assignMock(...args),
  setFacilityAdminStatus: (...args: unknown[]) => statusMock(...args),
  fetchFacilityAdminAccess: (...args: unknown[]) => fetchAccessMock(...args),
  resendFacilityAdminInvitation: (...args: unknown[]) => resendMock(...args),
  sendFacilityAdminPasswordReset: (...args: unknown[]) => resetMock(...args)
}));

import { FacilityAdministratorsSection } from "../FacilityAdministratorsSection";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "a-1",
  facilityId: "f-1",
  userId: "u-1",
  fullName: "",
  email: "ops@clinic.test",
  phone: null,
  userStatus: "pending",
  emailVerifiedAt: null,
  phoneVerifiedAt: null,
  roleKey: "admin.ops",
  active: true,
  assignmentStatus: "active",
  suspendedAt: null,
  suspensionReason: null,
  removedAt: null,
  pendingEmail: null,
  invitation: { status: "pending", resetId: "r-1", expiresAt: "2099-01-01T10:00:00Z", redeemedAt: null },
  ...overrides
});

const httpError = (status: number, message = "boom") =>
  new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { error: { code: "x", name: "y", message } }
  });

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FacilityAdministratorsSection facilityId="f-1" />
    </QueryClientProvider>
  );

const RESEND = { name: /^Resend setup invitation/ };
const RESET = { name: /^Send password reset link/ };

describe("facility administrator access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAccessMock.mockResolvedValue([row()]);
  });

  describe("states", () => {
    it("shows Setup pending with the expiry and only the resend action", async () => {
      renderCard();

      expect(await screen.findByText("Setup pending")).toBeInTheDocument();
      expect(screen.getByText(/Invitation expires/)).toBeInTheDocument();
      expect(screen.getByRole("button", RESEND)).toBeEnabled();
      expect(screen.queryByRole("button", RESET)).not.toBeInTheDocument();
    });

    it.each(["expired", "revoked"])("shows Invitation expired for a %s invitation and offers a new one", async (status) => {
      fetchAccessMock.mockResolvedValue([row({ invitation: { status, resetId: "r-1", expiresAt: "2020-01-01T00:00:00Z", redeemedAt: null } })]);
      renderCard();

      expect(await screen.findByText("Invitation expired")).toBeInTheDocument();
      expect(screen.getByText(/can no longer be used/)).toBeInTheDocument();
      expect(screen.getByRole("button", RESEND)).toBeInTheDocument();
      expect(screen.queryByRole("button", RESET)).not.toBeInTheDocument();
    });

    it("shows Account active and only the reset action once setup is complete", async () => {
      fetchAccessMock.mockResolvedValue([
        row({ userStatus: "active", invitation: { status: "completed", resetId: "r-1", expiresAt: null, redeemedAt: "2026-09-01T00:00:00Z" } })
      ]);
      renderCard();

      expect(await screen.findByText("Account active")).toBeInTheDocument();
      expect(screen.getByRole("button", RESET)).toBeEnabled();
      expect(screen.queryByRole("button", RESEND)).not.toBeInTheDocument();
      expect(screen.queryByText(/Invitation expires/)).not.toBeInTheDocument();
    });

    it("shows a suspended facility assignment, with the reason, and only Reactivate", async () => {
      fetchAccessMock.mockResolvedValue([
        row({ userStatus: "active", active: false, assignmentStatus: "suspended", suspendedAt: "2026-10-01T00:00:00Z", suspensionReason: "Left the clinic" })
      ]);
      renderCard();

      expect(await screen.findByText("Access suspended")).toBeInTheDocument();
      expect(screen.getByText("Account active")).toBeInTheDocument();
      expect(screen.getByText(/Reason: Left the clinic/)).toBeInTheDocument();
      expect(screen.getByText(/account and other access are unchanged/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Reactivate facility access/ })).toBeEnabled();
      for (const name of [RESEND, RESET, { name: /^Suspend facility access/ }, { name: /edit details/i }]) {
        expect(screen.queryByRole("button", name)).not.toBeInTheDocument();
      }
    });

    it("does not read an inactive assignment as suspended unless the API says so", async () => {
      fetchAccessMock.mockResolvedValue([row({ userStatus: "active", active: false, assignmentStatus: "removed" })]);
      renderCard();

      expect(await screen.findByText("Access removed")).toBeInTheDocument();
      expect(screen.queryByText("Access suspended")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /reactivate/i })).not.toBeInTheDocument();
    });

    it("keeps the account's own suspension separate from facility access", async () => {
      fetchAccessMock.mockResolvedValue([row({ userStatus: "suspended" })]);
      renderCard();

      expect(await screen.findByText("Access active")).toBeInTheDocument();
      expect(screen.getByText("Account suspended")).toBeInTheDocument();
      expect(screen.queryByRole("button", RESEND)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", RESET)).not.toBeInTheDocument();
    });

    it("shows name, phone, a pending email change and removed history, with Edit only for current admins", async () => {
      fetchAccessMock.mockResolvedValue([
        row({ userStatus: "active", fullName: "Amina Ops", phone: "+254700000001", phoneVerifiedAt: null, pendingEmail: "new@clinic.test", invitation: { status: "completed", resetId: null, expiresAt: null, redeemedAt: null } }),
        row({ id: "a-2", userId: "u-2", email: "old@clinic.test", fullName: "Old Admin", active: false, assignmentStatus: "removed", removedAt: "2026-08-01T00:00:00Z" })
      ]);
      renderCard();

      expect(await screen.findByText("Amina Ops")).toBeInTheDocument();
      expect(screen.getByText("+254700000001")).toBeInTheDocument();
      expect(screen.getByText("Not verified")).toBeInTheDocument();
      expect(screen.getByText(/Waiting for new@clinic.test to be verified/)).toBeInTheDocument();
      expect(screen.getByText("Access removed")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /edit details/i })).toHaveLength(1);
    });

    it("opens the editor for an admin and closes it again on Cancel", async () => {
      fetchAccessMock.mockResolvedValue([row({ userStatus: "active", fullName: "Amina Ops" })]);
      renderCard();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: /edit details/i }));
      expect(screen.getByRole("form", { name: /edit details for ops@clinic.test/i })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });

    it("says so when no administrator is assigned", async () => {
      fetchAccessMock.mockResolvedValue([]);
      renderCard();

      expect(await screen.findByText(/No administrators yet/)).toBeInTheDocument();
    });

    it("shows a loading state, then an error with a retry that recovers", async () => {
      const user = userEvent.setup();
      fetchAccessMock.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
      renderCard();

      expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the server/i);
      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByText("Setup pending")).toBeInTheDocument();
    });
  });

  describe("resend setup invitation", () => {
    it("sends a new invitation, confirms it by email address, and refreshes the state", async () => {
      const user = userEvent.setup();
      resendMock.mockResolvedValue({ invitationSent: true, invitationExpiresAt: "2099-01-02T10:00:00Z" });
      renderCard();

      await user.click(await screen.findByRole("button", RESEND));

      expect(resendMock).toHaveBeenCalledWith("f-1", "u-1");
      expect(await screen.findByRole("status")).toHaveTextContent("A new setup invitation was sent to ops@clinic.test.");
      await waitFor(() => expect(fetchAccessMock).toHaveBeenCalledTimes(2));
    });

    it("locks both actions and shows progress while it is being sent", async () => {
      const user = userEvent.setup();
      let finish: (value: unknown) => void = () => undefined;
      resendMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      renderCard();

      await user.click(await screen.findByRole("button", RESEND));

      const button = screen.getByRole("button", RESEND);
      await waitFor(() => expect(button).toBeDisabled());
      expect(button).toHaveAttribute("aria-busy", "true");
      finish({ invitationSent: true, invitationExpiresAt: null });
      await screen.findByRole("status");
    });

    it.each([
      [429, /Too many requests/],
      [500, /something went wrong on our side/i],
      [403, /Only a super admin/]
    ])("explains a %s and lets the person try again", async (status, expected) => {
      const user = userEvent.setup();
      resendMock.mockRejectedValueOnce(httpError(status));
      resendMock.mockResolvedValueOnce({ invitationSent: true, invitationExpiresAt: null });
      renderCard();

      await user.click(await screen.findByRole("button", RESEND));

      expect(await screen.findByRole("alert")).toHaveTextContent(expected);
      await user.click(screen.getByRole("button", RESEND));

      expect(await screen.findByRole("status")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("send password reset link", () => {
    const activeRow = () =>
      row({ userStatus: "active", invitation: { status: "completed", resetId: "r-1", expiresAt: null, redeemedAt: "2026-09-01T00:00:00Z" } });

    beforeEach(() => {
      fetchAccessMock.mockResolvedValue([activeRow()]);
    });

    it("asks first, saying it signs the admin out and the link works once for an hour", async () => {
      const user = userEvent.setup();
      renderCard();

      await user.click(await screen.findByRole("button", RESET));

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Send password reset link?")).toBeInTheDocument();
      expect(dialog).toHaveTextContent("ops@clinic.test");
      expect(dialog).toHaveTextContent(/works once and expires in one hour/);
      expect(dialog).toHaveTextContent(/signs them out everywhere/);
      expect(resetMock).not.toHaveBeenCalled();
    });

    it("does nothing when the dialog is cancelled", async () => {
      const user = userEvent.setup();
      renderCard();

      await user.click(await screen.findByRole("button", RESET));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));

      expect(resetMock).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("sends the link once confirmed and reports who it went to", async () => {
      const user = userEvent.setup();
      resetMock.mockResolvedValue({ resetSent: true, resetExpiresAt: "2099-01-01T11:00:00Z" });
      renderCard();

      await user.click(await screen.findByRole("button", RESET));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Send reset link" }));

      expect(resetMock).toHaveBeenCalledTimes(1);
      expect(resetMock).toHaveBeenCalledWith("f-1", "u-1");
      expect(await screen.findByRole("status")).toHaveTextContent(
        "A password reset link was sent to ops@clinic.test. It works once and expires in one hour."
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("never calls the setup-invitation endpoint for an active account", async () => {
      const user = userEvent.setup();
      resetMock.mockResolvedValue({ resetSent: true, resetExpiresAt: null });
      renderCard();

      await user.click(await screen.findByRole("button", RESET));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Send reset link" }));
      await screen.findByRole("status");

      expect(resendMock).not.toHaveBeenCalled();
    });

    it("shows the rate limit as a clear message and keeps the panel usable", async () => {
      const user = userEvent.setup();
      resetMock.mockRejectedValue(httpError(429, "Rate limit exceeded"));
      renderCard();

      await user.click(await screen.findByRole("button", RESET));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Send reset link" }));

      expect((await screen.findAllByText(/Too many requests/)).length).toBeGreaterThan(0);
      expect(screen.getByText("Account active")).toBeInTheDocument();
    });

    it("explains a server rejection for an account that is not ready", async () => {
      const user = userEvent.setup();
      resetMock.mockRejectedValue(
        httpError(400, "Facility admin has not completed account setup; resend the setup invitation instead")
      );
      renderCard();

      await user.click(await screen.findByRole("button", RESET));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Send reset link" }));

      expect((await screen.findAllByText(/resend the setup invitation instead/)).length).toBeGreaterThan(0);
    });
  });

  describe("invite and assign", () => {
    const open = async (name: RegExp) => {
      const user = userEvent.setup();
      renderCard();
      await user.click(await screen.findByRole("button", { name }));
      return { user, dialog: await screen.findByRole("dialog") };
    };

    it("labels the two ways of adding an administrator distinctly", async () => {
      renderCard();
      expect(await screen.findByRole("button", { name: "Invite administrator" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Assign existing account" })).toBeInTheDocument();
    });

    it("invites a new email through the invitation endpoint and says an invitation was sent", async () => {
      inviteMock.mockResolvedValue({ facilityAdminId: "a-9", userId: "u-9", email: "new@clinic.test", invitationSent: true, invitationExpiresAt: null });
      const { user, dialog } = await open(/^Invite administrator$/);
      expect(dialog).toHaveTextContent(/one-time link to set a password/i);
      await user.type(within(dialog).getByLabelText(/email address/i), "new@clinic.test");
      await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));

      await waitFor(() => expect(inviteMock).toHaveBeenCalledWith("f-1", "new@clinic.test"));
      expect(assignMock).not.toHaveBeenCalled();
      expect(await screen.findByRole("status")).toHaveTextContent("A setup invitation was sent to new@clinic.test.");
      await waitFor(() => expect(fetchAccessMock).toHaveBeenCalledTimes(2));
    });

    it("points to Assign existing account when the invited email already has an account (409)", async () => {
      inviteMock.mockRejectedValue(httpError(409, "This email already has an account. Assign the existing account instead."));
      const { user, dialog } = await open(/^Invite administrator$/);
      await user.type(within(dialog).getByLabelText(/email address/i), "known@clinic.test");
      await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));

      expect(await within(dialog).findByText(/Use "Assign existing account" instead/)).toBeInTheDocument();
      expect(dialog).toBeInTheDocument();
    });

    it("assigns an existing account through the assignment endpoint, with no invitation", async () => {
      assignMock.mockResolvedValue({ id: "a-9", facilityId: "f-1", userId: "u-9", roleKey: "admin.ops", active: true });
      const { user, dialog } = await open(/^Assign existing account$/);
      expect(dialog).toHaveTextContent(/no invitation is sent/i);
      await user.type(within(dialog).getByLabelText(/email address/i), "known@clinic.test");
      await user.click(within(dialog).getByRole("button", { name: "Assign account" }));

      await waitFor(() => expect(assignMock).toHaveBeenCalledWith("f-1", "known@clinic.test"));
      expect(inviteMock).not.toHaveBeenCalled();
      expect(await screen.findByRole("status")).toHaveTextContent("known@clinic.test now has admin access to this facility.");
    });

    it("validates the email before calling the API, and shows the rate limit", async () => {
      const { user, dialog } = await open(/^Invite administrator$/);
      await user.type(within(dialog).getByLabelText(/email address/i), "nope");
      await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));
      expect(await within(dialog).findByText("Enter a valid email address.")).toBeInTheDocument();
      expect(inviteMock).not.toHaveBeenCalled();

      inviteMock.mockRejectedValue(httpError(429, "Rate limit"));
      await user.clear(within(dialog).getByLabelText(/email address/i));
      await user.type(within(dialog).getByLabelText(/email address/i), "new@clinic.test");
      await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));
      expect(await within(dialog).findByText(/Too many requests/)).toBeInTheDocument();
    });
  });

  describe("suspend and reactivate facility access", () => {
    const activeRow = () => row({ userStatus: "active", invitation: { status: "completed", resetId: null, expiresAt: null, redeemedAt: null } });
    const SUSPEND = { name: /^Suspend facility access for ops@clinic.test/ };

    beforeEach(() => fetchAccessMock.mockResolvedValue([activeRow()]));

    it("asks for a reason, explains only this facility is affected, and will not confirm without one", async () => {
      const user = userEvent.setup();
      renderCard();
      await user.click(await screen.findByRole("button", SUSPEND));

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent(/this facility only/i);
      expect(dialog).toHaveTextContent(/account, other access and sign-in are not changed/i);
      const confirm = within(dialog).getByRole("button", { name: "Suspend access" });
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByLabelText(/reason/i), "   ");
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByLabelText(/reason/i), "Left the clinic");
      expect(confirm).toBeEnabled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("suspends this assignment with the reason via the status endpoint and reports it", async () => {
      statusMock.mockResolvedValue({ userId: "u-1", assignmentStatus: "suspended", suspendedAt: "2026-10-08T00:00:00Z", suspensionReason: "Left the clinic" });
      const user = userEvent.setup();
      renderCard();
      await user.click(await screen.findByRole("button", SUSPEND));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/reason/i), " Left the clinic ");
      await user.click(within(dialog).getByRole("button", { name: "Suspend access" }));

      await waitFor(() => expect(statusMock).toHaveBeenCalledWith("f-1", "u-1", { status: "suspended", reason: "Left the clinic" }));
      expect(await screen.findByRole("status")).toHaveTextContent("Facility access for ops@clinic.test is suspended. Their account and other access are unchanged.");
      await waitFor(() => expect(fetchAccessMock).toHaveBeenCalledTimes(2));
    });

    it("cancelling the suspend dialog sends nothing", async () => {
      const user = userEvent.setup();
      renderCard();
      await user.click(await screen.findByRole("button", SUSPEND));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("confirms before reactivating, then reactivates only this assignment", async () => {
      fetchAccessMock.mockResolvedValue([row({ userStatus: "active", active: false, assignmentStatus: "suspended", suspensionReason: "x", suspendedAt: "2026-10-01T00:00:00Z" })]);
      statusMock.mockResolvedValue({ userId: "u-1", assignmentStatus: "active", suspendedAt: null, suspensionReason: null });
      const user = userEvent.setup();
      renderCard();
      await user.click(await screen.findByRole("button", { name: /^Reactivate facility access/ }));

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent(/manage this facility again/i);
      expect(statusMock).not.toHaveBeenCalled();
      await user.click(within(dialog).getByRole("button", { name: "Reactivate access" }));
      await waitFor(() => expect(statusMock).toHaveBeenCalledWith("f-1", "u-1", { status: "active" }));
      expect(await screen.findByRole("status")).toHaveTextContent("Facility access for ops@clinic.test is active again.");
    });

    it("shows a conflict from the API (for example an active assignment elsewhere) and stays usable", async () => {
      fetchAccessMock.mockResolvedValue([row({ userStatus: "active", active: false, assignmentStatus: "suspended" })]);
      statusMock.mockRejectedValue(httpError(409, "This administrator has an active assignment at another facility."));
      const user = userEvent.setup();
      renderCard();
      await user.click(await screen.findByRole("button", { name: /^Reactivate facility access/ }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reactivate access" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("active assignment at another facility");
      expect(screen.getByRole("button", { name: /^Reactivate facility access/ })).toBeEnabled();
    });

    it("never offers to suspend or reactivate a removed assignment", async () => {
      fetchAccessMock.mockResolvedValue([row({ active: false, assignmentStatus: "removed" })]);
      renderCard();
      await screen.findByText("Access removed");
      expect(screen.queryByRole("button", { name: /suspend|reactivate/i })).not.toBeInTheDocument();
    });
  });

  describe("permission and loading", () => {
    it("shows a permission message, and no add buttons, when the API answers 403", async () => {
      fetchAccessMock.mockRejectedValue(httpError(403, "Forbidden"));
      renderCard();

      expect(await screen.findByRole("alert")).toHaveTextContent(/Only a super admin can/);
      expect(screen.queryByRole("button", { name: "Invite administrator" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Assign existing account" })).not.toBeInTheDocument();
    });

    it("shows a loading state before the list arrives", () => {
      fetchAccessMock.mockReturnValue(new Promise(() => {}));
      renderCard();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("exposes the list and every row action with an accessible name that includes the person", async () => {
      renderCard();
      expect(await screen.findByRole("list", { name: "Facility administrators" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit details for ops@clinic.test" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Resend setup invitation to ops@clinic.test" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Suspend facility access for ops@clinic.test" })).toBeInTheDocument();
    });
  });
});
