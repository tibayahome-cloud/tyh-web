import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Modal } from "../../../shared/components/Modal";
import { Button } from "../../../shared/components/Button";
import { Input } from "../../../shared/components/Input";
import { Stepper } from "../../../shared/components/Stepper";
import { Loading } from "../../../shared/components/Loading";
import { useMutation } from "@tanstack/react-query";

import { saveProviderPreference } from "../../../shared/libs/telemedicineOps";
import type { ProviderPreference } from "../../../shared/libs/telemedicineOps";
import { ProviderPreferenceFields } from "./ProviderPreferenceFields";
import { MpesaPaymentInstructions } from "../../../shared/components/MpesaPaymentInstructions";
import { CountryRequiredBanner } from "../../../shared/components/CountryRequiredBanner";
import { ApiErrorBanner } from "../../../shared/components/ApiErrorBanner";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useToast } from "../../../shared/components/ToastProvider";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, svcCard } from "../../../shared/libs/fieldInclude";
import type { RemoteFacility } from "../../../shared/libs/telemedicine";
import type { TelemedicineSlot } from "../../../shared/schemas/telemedicine";
import { classifyApiError, type ClassifiedApiError } from "../../../shared/utils/errors";
import { mpesaPhoneValidationError } from "../../../shared/utils/mpesaPhone";
import {
  useAvailableSlots,
  useCreateHoldMutation,
  useHoldQuery,
  useInitiateHoldPaymentMutation,
  useReleaseHoldMutation,
  useRemoteFacilities,
  useTelemedicinePolicy
} from "../../../shared/hooks/useTelemedicine";
import { bookingKeys } from "../../../shared/hooks/useBookings";
import { formatTelemedicineDateTime } from "../../../shared/utils/telemedicine";

type TelemedicineRequestDialogProps = {
  open: boolean;
  onClose: () => void;
  serviceId?: string | null;
  onCreated?: (bookingId: string) => void;
};

type RemoteServiceOption = {
  id: string;
  name: string;
  description?: string | null;
  base_price_cents: number;
  default_estimate_minutes: number;
  remote_capable: boolean;
  active?: boolean;
};

const TM_STEP_INDEX = { service: 0, facility: 1, slot: 2, confirm: 3 } as const;

const TM_STEPS = [
  { title: "Service", description: "What kind of consultation?" },
  { title: "Facility", description: "Choose a care site" },
  { title: "Slot", description: "Pick a time" },
  { title: "Confirm", description: "Review & pay" }
];

const formatCurrency = (cents: number, currency = "KES") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);

// A slot is a real appointment at the facility's location, not wherever the client's device
// happens to be set to -- these must show the same instant the backend actually reserved.
const formatSlotTime = (iso: string, timezone: string | undefined) =>
  formatTelemedicineDateTime(iso, timezone, { hour: "2-digit", minute: "2-digit" });

const formatSlotDate = (iso: string, timezone: string | undefined) =>
  formatTelemedicineDateTime(iso, timezone, { weekday: "short", month: "short", day: "numeric" });

const todayISODate = () => new Date().toISOString().slice(0, 10);

const useRemoteServiceOptions = (enabled: boolean) =>
  useQuery({
    queryKey: ["client", "services", "telemedicine-booking-form"],
    queryFn: async () => {
      const response = await api.get<{ data: RemoteServiceOption[] }>("/services", {
        params: {
          ...buildFieldParams(svcCard),
          "filter[active]": "true",
          "filter[has_active_offering]": "true"
        }
      });
      return response.data.data.filter((service) => (service.active ?? true) && service.remote_capable);
    },
    enabled
  });

export const TelemedicineRequestDialog = ({ open, onClose, serviceId, onCreated }: TelemedicineRequestDialogProps) => {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<number>(serviceId ? TM_STEP_INDEX.facility : TM_STEP_INDEX.service);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(serviceId ?? null);
  const [selectedFacility, setSelectedFacility] = useState<RemoteFacility | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISODate());
  const [selectedSlot, setSelectedSlot] = useState<TelemedicineSlot | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [preference, setPreference] = useState<Partial<ProviderPreference>>({});
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitError, setSubmitError] = useState<ClassifiedApiError | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const policyQuery = useTelemedicinePolicy();
  const servicesQuery = useRemoteServiceOptions(open);
  const facilitiesQuery = useRemoteFacilities(selectedServiceId, user?.countryCode ?? undefined, {
    enabled: open && step === TM_STEP_INDEX.facility && Boolean(selectedServiceId)
  });
  const slotsQuery = useAvailableSlots(
    selectedFacility?.id ?? null,
    selectedFacility?.facilityServiceId ?? null,
    selectedDate,
    undefined,
    { enabled: open && step === TM_STEP_INDEX.slot && Boolean(selectedFacility) }
  );
  const holdQuery = useHoldQuery(holdId, {
    enabled: Boolean(holdId),
    refetchInterval: holdId ? 4000 : false
  });

  const createHoldMutation = useCreateHoldMutation();
  const releaseHoldMutation = useReleaseHoldMutation();
  const initiatePaymentMutation = useInitiateHoldPaymentMutation();
  const savePreference = useMutation({
    mutationFn: ({ bookingId, preference: next }: { bookingId: string; preference: Partial<ProviderPreference> }) =>
      saveProviderPreference(bookingId, next)
  });

  const selectedService = servicesQuery.data?.find((service) => service.id === selectedServiceId) ?? null;
  const hold = holdQuery.data ?? null;

  useEffect(() => {
    if (!hold) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
    // Only restart the ticking interval when the hold identity changes, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold?.id]);

  const remainingHoldSeconds = useMemo(() => {
    if (!hold) return 0;
    return Math.max(0, Math.floor((new Date(hold.expiresAt).getTime() - nowMs) / 1000));
  }, [hold, nowMs]);

  const holdExpired = Boolean(hold) && !hold?.isActive && hold?.bookingStatus !== "telemedicine_paid_pending_assignment";

  // Once payment succeeds and admin.ops hasn't assigned yet, the booking is created -- treat
  // that as done from the client's point of view; assignment happens asynchronously.
  useEffect(() => {
    if (hold?.bookingId && hold.bookingStatus && hold.bookingStatus !== "telemedicine_payment_pending") {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
      onCreated?.(hold.bookingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold?.bookingId, hold?.bookingStatus]);

  const releaseCurrentHold = () => {
    if (holdId && hold?.isActive) {
      releaseHoldMutation.mutate(holdId);
    }
  };

  const resetToStart = () => {
    releaseCurrentHold();
    setHoldId(null);
    setSelectedSlot(null);
    setStep(TM_STEP_INDEX.slot);
    setSubmitError(null);
  };

  const handleClose = () => {
    releaseCurrentHold();
    setStep(serviceId ? TM_STEP_INDEX.facility : TM_STEP_INDEX.service);
    setSelectedServiceId(serviceId ?? null);
    setSelectedFacility(null);
    setSelectedSlot(null);
    setHoldId(null);
    setSubmitError(null);
    onClose();
  };

  const handleSelectSlot = async (slot: TelemedicineSlot) => {
    if (!selectedFacility) return;
    setSubmitError(null);
    setSelectedSlot(slot);
    try {
      const newHold = await createHoldMutation.mutateAsync({
        facilityId: selectedFacility.id,
        facilityServiceId: selectedFacility.facilityServiceId,
        startAt: slot.startAt,
        idempotencyKey: `${selectedFacility.facilityServiceId}:${slot.startAt}`
      });
      queryClient.setQueryData(["telemedicine", "hold", newHold.id], newHold);
      setHoldId(newHold.id);
      setStep(TM_STEP_INDEX.confirm);
    } catch (error) {
      setSubmitError(classifyApiError(error, "Please try a different slot."));
      setSelectedSlot(null);
    }
  };

  const handlePay = async () => {
    if (!holdId) return;
    setPhoneTouched(true);
    setSubmitError(null);
    // Catch an unusable number here, before the STK push is even requested, rather than letting
    // the client find out only after the backend rejects it.
    if (mpesaPhoneValidationError(phone)) {
      return;
    }
    try {
      // Saved before payment is requested, so a preference the client took the trouble to
      // express is recorded even if the M-Pesa prompt is never approved. A failure here must
      // not block the payment: an unsaved preference is a disappointment, an unpaid booking is
      // a lost appointment.
      if (hold?.bookingId && Object.values(preference).some(Boolean)) {
        try {
          await savePreference.mutateAsync({ bookingId: hold.bookingId, preference });
        } catch {
          // Intentionally swallowed; see above.
        }
      }
      await initiatePaymentMutation.mutateAsync({ holdId, phone: phone.trim() || undefined });
      toast.showToast({
        title: "Payment initiated",
        description: "Check your phone to approve the M-Pesa prompt."
      });
    } catch (error) {
      setSubmitError(classifyApiError(error, "Unable to start payment."));
    }
  };

  const phoneError = phoneTouched ? mpesaPhoneValidationError(phone) : null;
  const paymentInitiated = Boolean(hold?.bookingId) && initiatePaymentMutation.isSuccess;
  const paymentConfirmed = Boolean(hold?.bookingStatus && hold.bookingStatus !== "telemedicine_payment_pending");

  return (
    <Modal open={open} onClose={handleClose} title="Book a remote consultation" maxWidth="md">
      <div className="space-y-6">
        <Stepper steps={TM_STEPS} current={step} />

        {step === TM_STEP_INDEX.service && (
          <div className="space-y-3">
            {!user?.countryCode && <CountryRequiredBanner onComplete={handleClose} />}
            {servicesQuery.isLoading && <Loading />}
            {!servicesQuery.isLoading && (servicesQuery.data ?? []).length === 0 && (
              <p className="text-sm text-slate-500">No remote-consultation services are available right now.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(servicesQuery.data ?? []).map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setStep(TM_STEP_INDEX.facility);
                  }}
                  className="rounded-2xl border border-slate-200 p-4 text-left shadow-sm transition hover:border-tiba-blue hover:shadow-md"
                >
                  <p className="font-semibold text-slate-900">{service.name}</p>
                  {service.description && <p className="mt-1 text-xs text-slate-500">{service.description}</p>}
                  <p className="mt-2 text-sm font-medium text-tiba-blue">From {formatCurrency(service.base_price_cents)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === TM_STEP_INDEX.facility && (
          <div className="space-y-3">
            {!user?.countryCode ? (
              <CountryRequiredBanner onComplete={handleClose} />
            ) : (
              <>
                {facilitiesQuery.isLoading && <Loading />}
                {!facilitiesQuery.isLoading && (facilitiesQuery.data ?? []).length === 0 && (
                  <p className="text-sm text-slate-500">
                    No facilities currently offer this service remotely in your country.
                  </p>
                )}
                <div className="space-y-2">
                  {(facilitiesQuery.data ?? []).map((facility) => (
                    <button
                      key={facility.id}
                      type="button"
                      onClick={() => {
                        setSelectedFacility(facility);
                        setStep(TM_STEP_INDEX.slot);
                      }}
                      className="w-full rounded-2xl border border-slate-200 p-4 text-left shadow-sm transition hover:border-tiba-blue hover:shadow-md"
                    >
                      <p className="font-semibold text-slate-900">{facility.name}</p>
                      <p className="text-xs text-slate-500">{[facility.address, facility.county].filter(Boolean).join(", ")}</p>
                      <p className="mt-1 text-sm font-medium text-tiba-blue">{formatCurrency(facility.priceCents, facility.currency)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="flex justify-start">
              <Button type="button" variant="secondary" onClick={() => setStep(TM_STEP_INDEX.service)}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === TM_STEP_INDEX.slot && selectedFacility && (
          <div className="space-y-3">
            <Input
              label="Date"
              type="date"
              min={todayISODate()}
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            {slotsQuery.isLoading && <Loading />}
            {submitError && <ApiErrorBanner category={submitError.category} message={submitError.message} />}
            {!slotsQuery.isLoading && (slotsQuery.data ?? []).length === 0 && (
              <p className="text-sm text-slate-500">No open slots on this date. Try another day.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              {(slotsQuery.data ?? []).map((slot) => (
                <button
                  key={slot.startAt}
                  type="button"
                  disabled={createHoldMutation.isPending}
                  onClick={() => handleSelectSlot(slot)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-tiba-blue hover:text-tiba-blue disabled:opacity-50"
                >
                  <span className="block text-xs text-slate-400">{formatSlotDate(slot.startAt, policyQuery.data?.defaultTimezone)}</span>
                  {formatSlotTime(slot.startAt, policyQuery.data?.defaultTimezone)}
                </button>
              ))}
            </div>
            <div className="flex justify-start">
              <Button type="button" variant="secondary" onClick={() => setStep(TM_STEP_INDEX.facility)}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === TM_STEP_INDEX.confirm && selectedFacility && selectedSlot && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">{selectedService?.name ?? "Consultation"}</p>
              <p className="text-sm text-slate-500">{selectedFacility.name}</p>
              <p className="mt-1 text-sm text-slate-700">
                {formatSlotDate(selectedSlot.startAt, policyQuery.data?.defaultTimezone)} at{" "}
                {formatSlotTime(selectedSlot.startAt, policyQuery.data?.defaultTimezone)}
              </p>
              <p className="mt-2 text-lg font-semibold text-tiba-blue">
                {formatCurrency(selectedFacility.priceCents, selectedFacility.currency)}
              </p>
            </div>

            {/* Offered here because the booking now exists but no provider is assigned yet,
                which is exactly the window the backend allows a preference to be set in. */}
            {!holdExpired && !paymentConfirmed && hold?.bookingId && (
              <ProviderPreferenceFields
                value={preference}
                onChange={setPreference}
                disabled={savePreference.isPending}
              />
            )}

            {!holdExpired && !paymentConfirmed && (
              <p className="text-xs text-amber-700">
                Holding this slot for {Math.floor(remainingHoldSeconds / 60)}:
                {String(remainingHoldSeconds % 60).padStart(2, "0")} -- complete payment before it expires.
              </p>
            )}

            {holdExpired && !paymentConfirmed && (
              <div className="space-y-3">
                <p className="text-sm text-danger-600">This hold expired. Pick a new time to continue.</p>
                <Button type="button" onClick={resetToStart}>
                  Choose another slot
                </Button>
              </div>
            )}

            {!holdExpired && !paymentConfirmed && (
              <>
                <Input
                  label="M-Pesa phone number"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="+254 700 000000"
                  error={phoneError ?? undefined}
                  hint={phoneError ? undefined : "The STK push to approve payment goes to this number."}
                />
                {submitError && <ApiErrorBanner category={submitError.category} message={submitError.message} />}
                {!paymentInitiated ? (
                  <Button type="button" loading={initiatePaymentMutation.isPending} onClick={handlePay}>
                    Confirm & pay
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">Waiting for M-Pesa confirmation...</p>
                    <MpesaPaymentInstructions
                      amountCents={selectedFacility.priceCents}
                      accountNumber={hold?.bookingId?.slice(0, 8).toUpperCase() ?? "TELEMED"}
                    />
                  </div>
                )}
              </>
            )}

            {paymentConfirmed && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <p className="font-semibold">Payment received</p>
                <p className="text-sm">
                  Your appointment is booked. The facility will assign a provider before your consultation.
                </p>
              </div>
            )}

            {!paymentConfirmed && (
              <div className="flex justify-start">
                <Button type="button" variant="secondary" onClick={() => setStep(TM_STEP_INDEX.slot)} disabled={paymentInitiated}>
                  Back
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TelemedicineRequestDialog;
