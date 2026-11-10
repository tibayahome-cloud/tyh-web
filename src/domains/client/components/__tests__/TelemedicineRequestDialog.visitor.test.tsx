/**
 * Booking without an account.
 *
 * A visitor browses consultations, clinics and times first, and is asked who they are only after choosing a time. The
 * time is held for them once the account exists, not before: a hold belongs to a person, and a hold made for nobody
 * would sit on a slot for ten minutes with no way to release it. Someone who is already signed in sees none of this.
 *
 * The account step itself is replaced by a stub here; its own behaviour is covered in BookingAccountStep.test.tsx.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type TestUser = { phone: string; countryCode: string | null };

const { createHold, release, auth } = vi.hoisted(() => ({
  createHold: vi.fn(),
  release: vi.fn(),
  auth: { user: null as TestUser | null }
}));

const NAIROBI = "Africa/Nairobi";
const TODAY_IN_NAIROBI = new Intl.DateTimeFormat("en-CA", {
  timeZone: NAIROBI,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const SLOT = {
  startAt: `${TODAY_IN_NAIROBI}T06:00:00Z`,
  endAt: `${TODAY_IN_NAIROBI}T06:30:00Z`,
  availableProviderCount: 0
};
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

const HOLD = {
  id: "hold-1",
  facilityId: FACILITY.id,
  facilityServiceId: FACILITY.facilityServiceId,
  startAt: SLOT.startAt,
  endAt: SLOT.endAt,
  status: "active",
  isActive: true,
  expiresAt: "2099-01-01T00:00:00Z",
  remainingSeconds: 600,
  bookingId: null,
  bookingStatus: null,
  paymentPending: false
};

const NEW_ACCOUNT: TestUser = { phone: "+254712345678", countryCode: "KE" };

vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useAvailableSlots: () => ({ data: { slots: [SLOT], timezone: "Africa/Nairobi" }, isLoading: false, isError: false }),
  useRemoteFacilities: () => ({ data: [FACILITY], isLoading: false }),
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi", cancellationCutoffMinutes: 10 } }),
  useCreateHoldMutation: () => ({ mutateAsync: createHold, isPending: false }),
  useReleaseHoldMutation: () => ({ mutate: release, mutateAsync: vi.fn() }),
  useInitiateHoldPaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false, isSuccess: false }),
  useHoldQuery: () => ({ data: HOLD, isLoading: false })
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: auth.user, isAuthenticated: Boolean(auth.user) })
}));

vi.mock("../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
}));

// Stands in for the real account step. "Account made" does what the real one does on success: the person is signed in
// by the time it reports back.
vi.mock("../BookingAccountStep", () => ({
  BookingAccountStep: ({ onReady, onBack, busy }: { onReady: () => void; onBack: () => void; busy?: boolean }) => (
    <div>
      <p>{busy ? "account step is holding the time" : "account step"}</p>
      <button
        type="button"
        onClick={() => {
          auth.user = NEW_ACCOUNT;
          onReady();
        }}
      >
        Account made
      </button>
      <button type="button" onClick={onBack}>
        Back from details
      </button>
    </div>
  )
}));

import { TelemedicineRequestDialog } from "../TelemedicineRequestDialog";

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

beforeEach(() => {
  auth.user = null;
  createHold.mockReset();
  createHold.mockResolvedValue(HOLD);
  release.mockClear();
});

const renderDialog = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TelemedicineRequestDialog open onClose={vi.fn()} serviceId="service-1" />
    </QueryClientProvider>
  );
};

const stepTitles = async () => {
  const list = await screen.findByRole("list");
  return Array.from(list.querySelectorAll("li p.font-semibold")).map((node) => node.textContent);
};

const chooseClinicAndTime = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByText(FACILITY.name));
  await user.click(await screen.findByRole("button", { name: SLOT_LABEL }));
};

const conflict = (message: string) =>
  new AxiosError("Request failed with status code 409", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 409,
    statusText: "Conflict",
    headers: {},
    config: {} as never,
    data: { error: { code: "conflict", name: "Conflict", message } }
  });

describe("booking without an account", () => {
  it("shows five steps, with Details after the time and before Confirm", async () => {
    renderDialog();

    expect(await stepTitles()).toEqual(["Service", "Facility", "Slot", "Details", "Confirm"]);
    expect(screen.getByText("Step 2 of 5: Facility")).toBeInTheDocument();
  });

  it("lists clinics straight away, without asking for a country or showing the Kenya-only notice", async () => {
    renderDialog();

    expect(await screen.findByText(FACILITY.name)).toBeInTheDocument();
    expect(screen.queryByText(/available in Kenya for now/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /country/i })).not.toBeInTheDocument();
  });

  it("asks for details after a time is chosen and holds nothing yet", async () => {
    const user = userEvent.setup();
    renderDialog();
    await chooseClinicAndTime(user);

    expect(await screen.findByText("account step")).toBeInTheDocument();
    expect(screen.getByText("Step 4 of 5: Details")).toBeInTheDocument();
    expect(createHold).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /confirm & pay/i })).not.toBeInTheDocument();
  });

  it("holds the chosen time as soon as the account exists, then goes on to pay", async () => {
    const user = userEvent.setup();
    renderDialog();
    await chooseClinicAndTime(user);
    await user.click(await screen.findByRole("button", { name: "Account made" }));

    expect(await screen.findByRole("button", { name: /confirm & pay/i })).toBeInTheDocument();
    expect(createHold).toHaveBeenCalledTimes(1);
    expect(createHold).toHaveBeenCalledWith(
      expect.objectContaining({
        facilityId: FACILITY.id,
        facilityServiceId: FACILITY.facilityServiceId,
        startAt: SLOT.startAt
      })
    );
    // Still five steps after the account is made: the journey does not shrink in the middle.
    expect(screen.getByText("Step 5 of 5: Confirm")).toBeInTheDocument();
    expect(await stepTitles()).toEqual(["Service", "Facility", "Slot", "Details", "Confirm"]);
  });

  it("pays from the number on the new account without asking for it again", async () => {
    const user = userEvent.setup();
    renderDialog();
    await chooseClinicAndTime(user);
    await user.click(await screen.findByRole("button", { name: "Account made" }));

    // The hint sits inside the label, so the label's text is longer than its name.
    const phone = await screen.findByLabelText(/M-Pesa phone number/);
    expect(phone).toHaveValue(NEW_ACCOUNT.phone);
  });

  it("says the time is being held while the hold is made", async () => {
    let finishHold: (value: typeof HOLD) => void = () => undefined;
    createHold.mockReturnValue(
      new Promise<typeof HOLD>((resolve) => {
        finishHold = resolve;
      })
    );
    const user = userEvent.setup();
    renderDialog();
    await chooseClinicAndTime(user);
    await user.click(await screen.findByRole("button", { name: "Account made" }));

    expect(await screen.findByText("account step is holding the time")).toBeInTheDocument();

    finishHold(HOLD);
    expect(await screen.findByRole("button", { name: /confirm & pay/i })).toBeInTheDocument();
  });

  it("goes back to the times from the details step without holding or releasing anything", async () => {
    const user = userEvent.setup();
    renderDialog();
    await chooseClinicAndTime(user);
    await user.click(await screen.findByRole("button", { name: "Back from details" }));

    expect(await screen.findByRole("button", { name: SLOT_LABEL })).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 5: Slot")).toBeInTheDocument();
    expect(createHold).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("returns to the times with the reason when the time was taken while the person gave their details", async () => {
    createHold.mockRejectedValue(conflict("That time was just taken. Choose another time."));
    const user = userEvent.setup();
    renderDialog();
    await chooseClinicAndTime(user);
    await user.click(await screen.findByRole("button", { name: "Account made" }));

    expect(await screen.findByText("That time was just taken. Choose another time.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SLOT_LABEL })).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 5: Slot")).toBeInTheDocument();
    expect(screen.queryByText(/account step/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm & pay/i })).not.toBeInTheDocument();
  });

  it("lets the person pick another time after that, with no second account step", async () => {
    createHold.mockRejectedValueOnce(conflict("That time was just taken. Choose another time."));
    const user = userEvent.setup();
    renderDialog();
    await chooseClinicAndTime(user);
    await user.click(await screen.findByRole("button", { name: "Account made" }));
    await screen.findByText("That time was just taken. Choose another time.");

    // They are signed in now, so choosing a time holds it straight away.
    await user.click(screen.getByRole("button", { name: SLOT_LABEL }));

    expect(await screen.findByRole("button", { name: /confirm & pay/i })).toBeInTheDocument();
    expect(screen.queryByText("account step")).not.toBeInTheDocument();
    expect(createHold).toHaveBeenCalledTimes(2);
  });
});

describe("booking while signed in", () => {
  beforeEach(() => {
    auth.user = NEW_ACCOUNT;
  });

  it("shows four steps and no Details step", async () => {
    renderDialog();

    expect(await stepTitles()).toEqual(["Service", "Facility", "Slot", "Confirm"]);
    expect(screen.getByText("Step 2 of 4: Facility")).toBeInTheDocument();
  });

  it("holds the chosen time at once and goes straight to pay", async () => {
    const user = userEvent.setup();
    renderDialog();
    await chooseClinicAndTime(user);

    expect(await screen.findByRole("button", { name: /confirm & pay/i })).toBeInTheDocument();
    expect(createHold).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("account step")).not.toBeInTheDocument();
    expect(screen.getByText("Step 4 of 4: Confirm")).toBeInTheDocument();
  });
});
