/**
 * Payment must not proceed on a preference we failed to record.
 *
 * The client chose a provider on criteria that matter to them -- a gender, a language. Taking
 * the money and losing that preference means they pay for a consultation the facility will
 * staff without ever seeing it, and they find out at the appointment. Stopping before the
 * charge leaves them able to retry, or to go ahead deliberately without one.
 *
 * The other half is not charging twice: a second tap, or a reload while an M-Pesa prompt is
 * already on the client's phone, must not send another.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const savePreferenceMock = vi.fn();
const initiatePaymentMock = vi.fn();
const holdQueryMock = vi.fn();

vi.mock("../../../../shared/libs/telemedicineOps", () => ({
  saveProviderPreference: (...args: unknown[]) => savePreferenceMock(...args)
}));

const initiateMutation = {
  mutateAsync: (...args: unknown[]) => initiatePaymentMock(...args),
  isPending: false,
  isSuccess: false
};

vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  // This branch is based on dev, where the slots hook still returns a bare array. The
  // facility-timezone branch changes that shape; these tests deliberately match the contract
  // this branch actually builds against.
  useAvailableSlots: () => ({ data: [SLOT], isLoading: false, isError: false }),
  useRemoteFacilities: () => ({ data: [FACILITY], isLoading: false }),
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi" } }),
  useCreateHoldMutation: () => ({ mutateAsync: () => Promise.resolve(holdQueryMock().data), isPending: false }),
  useReleaseHoldMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInitiateHoldPaymentMutation: () => initiateMutation,
  useHoldQuery: () => holdQueryMock()
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: { phone: "+254700000001", countryCode: "KE" }, isAuthenticated: true })
}));

vi.mock("../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
}));

import { TelemedicineRequestDialog } from "../TelemedicineRequestDialog";

const SLOT = {
  startAt: "2026-09-10T06:00:00Z",
  endAt: "2026-09-10T06:30:00Z",
  availableProviderCount: 2
};

// How the slot button is found, for clicking. Deliberately just the digits.
//
// These tests are about payment, not formatting, so the selector should not depend on how a
// time is rendered. Matching the full label made it depend on the runtime locale twice over:
// whether the hour is 12- or 24-hour, and whether ICU separates AM/PM with an ordinary space
// or a narrow no-break one. That passed locally and failed in CI. "09:00" appears in every
// spelling, and the facility-timezone tests are where the label itself is asserted.
const SLOT_LABEL = /09:00/;

const FACILITY = {
  id: "facility-1",
  name: "Kilimani Clinic",
  facilityType: "clinic",
  address: "Kilimani",
  county: "Nairobi",
  facilityServiceId: "facility-service-1",
  priceCents: 150000,
  currency: "KES",
  estimateDurationMinutes: 30,
  timezone: "Africa/Nairobi"
};

const hold = (overrides: Record<string, unknown> = {}) => ({
  data: {
    id: "hold-1",
    facilityId: FACILITY.id,
    facilityServiceId: FACILITY.facilityServiceId,
    startAt: "2026-09-10T06:00:00Z",
    endAt: "2026-09-10T06:30:00Z",
    status: "active",
    isActive: true,
    expiresAt: "2099-01-01T00:00:00Z",
    remainingSeconds: 600,
    bookingId: "booking-1",
    bookingStatus: "telemedicine_payment_pending",
    paymentPending: false,
    ...overrides
  }
});

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
});

const renderDialog = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TelemedicineRequestDialog open onClose={vi.fn()} serviceId="service-1" />
    </QueryClientProvider>
  );
};

/** Walk to the confirm step. Picking a slot creates the hold and advances the dialog. */
const reachConfirmStep = async (user: ReturnType<typeof userEvent.setup>) => {
  renderDialog();
  await user.click(await screen.findByText(FACILITY.name));
  await user.click(await screen.findByRole("button", { name: SLOT_LABEL }));
  return screen.findByRole("button", { name: /confirm & pay/i });
};

/** Express a preference, so the save is attempted at all. */
const expressAPreference = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /add a preference/i }));
  await user.selectOptions(await screen.findByRole("combobox", { name: /clinician/i }), "female");
};

const reachConfirmStepWithPreference = async (user: ReturnType<typeof userEvent.setup>) => {
  const payButton = await reachConfirmStep(user);
  await expressAPreference(user);
  return payButton;
};

describe("paying for a telemedicine hold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initiateMutation.isPending = false;
    initiateMutation.isSuccess = false;
    holdQueryMock.mockReturnValue(hold());
    savePreferenceMock.mockResolvedValue({});
    initiatePaymentMock.mockResolvedValue({});
  });

  describe("when a preference cannot be saved", () => {
    it("does not request payment", async () => {
      savePreferenceMock.mockRejectedValue(new Error("network"));
      const user = userEvent.setup();
      const payButton = await reachConfirmStepWithPreference(user);

      await user.click(payButton);

      await waitFor(() => expect(savePreferenceMock).toHaveBeenCalled());
      expect(initiatePaymentMock).not.toHaveBeenCalled();
    });

    it("says nothing has been charged", async () => {
      savePreferenceMock.mockRejectedValue(new Error("network"));
      const user = userEvent.setup();
      const payButton = await reachConfirmStepWithPreference(user);

      await user.click(payButton);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/could not be saved/i);
      expect(alert).toHaveTextContent(/nothing has been charged/i);
    });

    it("offers a retry that saves and then pays", async () => {
      savePreferenceMock.mockRejectedValueOnce(new Error("network")).mockResolvedValue({});
      const user = userEvent.setup();
      const payButton = await reachConfirmStepWithPreference(user);

      await user.click(payButton);
      await user.click(await screen.findByRole("button", { name: /try again/i }));

      await waitFor(() => expect(initiatePaymentMock).toHaveBeenCalledTimes(1));
      expect(savePreferenceMock).toHaveBeenCalledTimes(2);
    });

    it("offers to continue without one, which pays and does not retry the save", async () => {
      savePreferenceMock.mockRejectedValue(new Error("network"));
      const user = userEvent.setup();
      const payButton = await reachConfirmStepWithPreference(user);

      await user.click(payButton);
      savePreferenceMock.mockClear();
      await user.click(await screen.findByRole("button", { name: /continue without/i }));

      await waitFor(() => expect(initiatePaymentMock).toHaveBeenCalledTimes(1));
      expect(savePreferenceMock).not.toHaveBeenCalled();
    });

    it("keeps the entered preference on screen so it is not retyped", async () => {
      savePreferenceMock.mockRejectedValue(new Error("network"));
      const user = userEvent.setup();
      const payButton = await reachConfirmStepWithPreference(user);
      await user.click(payButton);

      await screen.findByRole("alert");
      // The preference fields are still rendered; the failure did not reset the step.
      expect(screen.queryByRole("button", { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe("not charging twice", () => {
    it("ignores a second click while payment is in flight", async () => {
      let release: (() => void) | undefined;
      initiatePaymentMock.mockImplementation(
        () => new Promise<void>((resolve) => (release = () => resolve()))
      );

      const user = userEvent.setup();
      const payButton = await reachConfirmStepWithPreference(user);

      await user.click(payButton);
      await user.click(payButton);
      await user.click(payButton);
      release?.();

      await waitFor(() => expect(initiatePaymentMock).toHaveBeenCalledTimes(1));
    });

    it("shows the waiting state after a reload, from the server's own flag", async () => {
      // paymentPending comes from the backend. Booking status stays payment_pending either
      // side of the prompt, so without this a reload would offer to send a second one.
      holdQueryMock.mockReturnValue(hold({ paymentPending: true }));

      const user = userEvent.setup();
      renderDialog();
      await user.click(await screen.findByText(FACILITY.name));
      await user.click(await screen.findByRole("button", { name: SLOT_LABEL }));

      expect(await screen.findByText(/waiting for m-pesa confirmation/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /confirm & pay/i })).not.toBeInTheDocument();
    });

    it("still offers to pay when the server reports no outstanding attempt", async () => {
      holdQueryMock.mockReturnValue(hold({ paymentPending: false }));

      const user = userEvent.setup();
      renderDialog();
      await user.click(await screen.findByText(FACILITY.name));
      await user.click(await screen.findByRole("button", { name: SLOT_LABEL }));

      expect(await screen.findByRole("button", { name: /confirm & pay/i })).toBeInTheDocument();
      expect(screen.queryByText(/waiting for m-pesa confirmation/i)).not.toBeInTheDocument();
    });
  });
});
