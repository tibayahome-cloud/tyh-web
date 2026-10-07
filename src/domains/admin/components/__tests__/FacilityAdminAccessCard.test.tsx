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

vi.mock("../../../../shared/libs/facilities", () => ({
  fetchFacilityAdminAccess: (...args: unknown[]) => fetchAccessMock(...args),
  resendFacilityAdminInvitation: (...args: unknown[]) => resendMock(...args),
  sendFacilityAdminPasswordReset: (...args: unknown[]) => resetMock(...args)
}));

import { FacilityAdminAccessCard } from "../FacilityAdminAccessCard";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "a-1",
  facilityId: "f-1",
  userId: "u-1",
  email: "ops@clinic.test",
  userStatus: "pending",
  roleKey: "admin.ops",
  active: true,
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
      <FacilityAdminAccessCard facilityId="f-1" />
    </QueryClientProvider>
  );

const RESEND = { name: "Resend setup invitation" };
const RESET = { name: "Send password reset link" };

describe("facility administrator access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAccessMock.mockResolvedValue([row()]);
  });

  describe("states", () => {
    it("shows Pending with the expiry and only the resend action", async () => {
      renderCard();

      expect(await screen.findByText("Pending")).toBeInTheDocument();
      expect(screen.getByText(/Invitation expires/)).toBeInTheDocument();
      expect(screen.getByRole("button", RESEND)).toBeEnabled();
      expect(screen.queryByRole("button", RESET)).not.toBeInTheDocument();
    });

    it.each(["expired", "revoked"])("shows Expired for a %s invitation and offers a new one", async (status) => {
      fetchAccessMock.mockResolvedValue([row({ invitation: { status, resetId: "r-1", expiresAt: "2020-01-01T00:00:00Z", redeemedAt: null } })]);
      renderCard();

      expect(await screen.findByText("Expired")).toBeInTheDocument();
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

    it("shows Suspended with an explanation and no recovery action", async () => {
      fetchAccessMock.mockResolvedValue([row({ userStatus: "suspended" })]);
      renderCard();

      expect(await screen.findByText("Suspended")).toBeInTheDocument();
      expect(screen.getByText(/Reactivate it before sending/)).toBeInTheDocument();
      expect(screen.queryByRole("button", RESEND)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", RESET)).not.toBeInTheDocument();
    });

    it("shows Removed for an inactive assignment and no recovery action", async () => {
      fetchAccessMock.mockResolvedValue([row({ active: false, userStatus: "active" })]);
      renderCard();

      expect(await screen.findByText("Removed")).toBeInTheDocument();
      expect(screen.queryByRole("button", RESEND)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", RESET)).not.toBeInTheDocument();
    });

    it("says so when no administrator is assigned", async () => {
      fetchAccessMock.mockResolvedValue([]);
      renderCard();

      expect(await screen.findByText("No active facility administrator is assigned.")).toBeInTheDocument();
    });

    it("shows a loading state, then an error with a retry that recovers", async () => {
      const user = userEvent.setup();
      fetchAccessMock.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
      renderCard();

      expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the server/i);
      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByText("Pending")).toBeInTheDocument();
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
});
