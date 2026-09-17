import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const showToastMock = vi.fn();
const fetchTrustedMethodsMock = vi.fn();
const fetchPendingChangeMock = vi.fn();
const startChangeMock = vi.fn();
const authorizeChangeMock = vi.fn();
const verifyNewMock = vi.fn();
const resendCodeMock = vi.fn();

vi.mock("../../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: showToastMock })
}));

vi.mock("../../../../../shared/libs/wallet", () => ({
  fetchFacilityPayoutTrustedMethods: (...args: unknown[]) => fetchTrustedMethodsMock(...args),
  fetchPendingFacilityPayoutDestinationChange: (...args: unknown[]) => fetchPendingChangeMock(...args),
  startFacilityPayoutDestinationChange: (...args: unknown[]) => startChangeMock(...args),
  authorizeFacilityPayoutDestinationChange: (...args: unknown[]) => authorizeChangeMock(...args),
  verifyNewFacilityPayoutDestination: (...args: unknown[]) => verifyNewMock(...args),
  resendFacilityPayoutDestinationCode: (...args: unknown[]) => resendCodeMock(...args)
}));

import { FacilityPayoutDestinationChangeVerifier } from "../FacilityPayoutDestinationChangeVerifier";

const renderVerifier = (onCompleted = vi.fn()) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { onCompleted, ...render(
    <QueryClientProvider client={queryClient}>
      <FacilityPayoutDestinationChangeVerifier facilityId="facility-1" open onCompleted={onCompleted} />
    </QueryClientProvider>
  ) };
};

const challenge = (overrides: Record<string, unknown> = {}) => ({
  changeId: "change-1",
  changeType: "change",
  status: "pending_authorization",
  authorizationOptionId: "method-1",
  authorizationChannel: "admin_phone",
  authorizationTargetMasked: "+254 *** 123",
  newPhoneMasked: "+254 *** 456",
  authorized: false,
  completed: false,
  failureReason: null,
  resendAvailableAt: null,
  ...overrides
});

describe("FacilityPayoutDestinationChangeVerifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchTrustedMethodsMock.mockResolvedValue([
      { optionId: "method-1", channel: "admin_phone", label: "Trusted phone ending 123" },
      { optionId: "method-2", channel: "admin_email", label: "Trusted email s***@example.com" }
    ]);
    fetchPendingChangeMock.mockResolvedValue(null);
  });

  it("starts a change with the selected trusted method and an idempotency key", async () => {
    startChangeMock.mockResolvedValue(challenge());
    const user = userEvent.setup();
    renderVerifier();

    await user.type(await screen.findByLabelText(/new m-pesa payout number/i), "0712345678");
    await user.click(screen.getByRole("button", { name: /send authorization code/i }));

    await waitFor(() => expect(startChangeMock).toHaveBeenCalledWith("facility-1", expect.objectContaining({
      newPhoneNumber: "0712345678",
      optionId: "method-1",
      idempotencyKey: expect.any(String)
    })));
    expect(await screen.findByText(/enter the authorization code/i)).toBeInTheDocument();
  });

  it("requires authorization before verifying the new number and completes the two-code flow", async () => {
    startChangeMock.mockResolvedValue(challenge());
    authorizeChangeMock.mockResolvedValue(challenge({ status: "authorized", authorized: true }));
    verifyNewMock.mockResolvedValue(challenge({ status: "completed", authorized: true, completed: true }));
    const onCompleted = vi.fn();
    const user = userEvent.setup();
    renderVerifier(onCompleted);

    await user.type(await screen.findByLabelText(/new m-pesa payout number/i), "0712345678");
    await user.click(screen.getByRole("button", { name: /send authorization code/i }));
    await user.type(await screen.findByLabelText(/authorization code/i), "111111");
    await user.click(screen.getByRole("button", { name: /authorize change/i }));

    expect(await screen.findByText(/possession code was sent/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/new-number verification code/i), "222222");
    await user.click(screen.getByRole("button", { name: /verify new number/i }));

    await waitFor(() => expect(verifyNewMock).toHaveBeenCalledWith("facility-1", "change-1", "222222"));
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("shows an explicit recovery instruction when no trusted method is available", async () => {
    fetchTrustedMethodsMock.mockResolvedValue([]);
    renderVerifier();

    expect(await screen.findByText(/ask a super-admin to recover the destination/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send authorization code/i })).toBeDisabled();
  });

  it("disables alternate delivery during the server-provided resend cooldown", async () => {
    startChangeMock.mockResolvedValue(challenge({
      resendAvailableAt: new Date(Date.now() + 45_000).toISOString()
    }));
    const user = userEvent.setup();
    renderVerifier();

    await user.type(await screen.findByLabelText(/new m-pesa payout number/i), "0712345678");
    await user.click(screen.getByRole("button", { name: /send authorization code/i }));

    const alternate = await screen.findByRole("button", { name: /try another contact \(00:[0-5][0-9]\)/i });
    expect(alternate).toBeDisabled();
  });
});
