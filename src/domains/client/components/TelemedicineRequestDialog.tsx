import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Modal } from "../../../shared/components/Modal";
import { Button } from "../../../shared/components/Button";
import { Input } from "../../../shared/components/Input";
import { Stepper } from "../../../shared/components/Stepper";
import { Loading } from "../../../shared/components/Loading";
import { useMutation } from "@tanstack/react-query";

import { saveProviderPreference } from "../../../shared/libs/telemedicineOps";
import type { ProviderPreference } from "../../../shared/libs/telemedicineOps";
import {
  fetchTelemedicineCatalogServices,
  fetchTelemedicineCategories,
  fetchTelemedicineSubcategories
} from "../../../shared/libs/telemedicineCatalog";
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
import {
  facilityLocalDateRange,
  facilityLocalDayLabel,
  facilityToday,
  formatTelemedicineDateTime,
  groupSlotsByFacilityLocalDate,
  TELEMEDICINE_DEFAULT_TIMEZONE
} from "../../../shared/utils/telemedicine";

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

const TM_STEP_INDEX = { service: 0, facility: 1, preferences: 2, slot: 3, confirm: 4 } as const;

const TM_STEPS = [
  { title: "Service", description: "What kind of consultation?" },
  { title: "Facility", description: "Choose a care site" },
  { title: "Preferences", description: "Optional requests" },
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

// Deliberately not new Date().toISOString(), which yields the UTC date: between 21:00 and
// midnight in Nairobi that already names tomorrow, so the picker opened on the wrong day and
// the "min" bound blocked a date that was still today for the client.
const WEEK_LENGTH = 7;

// Mirrors MAX_SLOT_LOOKAHEAD_DAYS in app/services/telemedicine_service.py. Asking beyond it
// is refused, so the picker stops offering weeks it knows the API will reject.
const MAX_LOOKAHEAD_DAYS = 30;

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TelemedicineSlot | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [preference, setPreference] = useState<Partial<ProviderPreference>>({});
  const [preferenceSaved, setPreferenceSaved] = useState(false);
  const [preferenceSaveError, setPreferenceSaveError] = useState<string | null>(null);
  // Guards against a double-tap sending two M-Pesa prompts; see handlePay.
  const payInFlightRef = useRef(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitError, setSubmitError] = useState<ClassifiedApiError | null>(null);
  const [remainingHoldSeconds, setRemainingHoldSeconds] = useState(0);

  const policyQuery = useTelemedicinePolicy();
  const servicesQuery = useRemoteServiceOptions(open && Boolean(serviceId));
  const categoriesQuery = useQuery({
    queryKey: ["client", "telemedicine", "categories"],
    queryFn: fetchTelemedicineCategories,
    enabled: open && step === TM_STEP_INDEX.service && !serviceId
  });
  const subcategoriesQuery = useQuery({
    queryKey: ["client", "telemedicine", "subcategories"],
    queryFn: () => fetchTelemedicineSubcategories(),
    enabled: open && step === TM_STEP_INDEX.service && !serviceId
  });
  const catalogServicesQuery = useQuery({
    queryKey: ["client", "telemedicine", "services"],
    queryFn: () => fetchTelemedicineCatalogServices(),
    enabled: open && step === TM_STEP_INDEX.service && !serviceId
  });
  const facilitiesQuery = useRemoteFacilities(selectedServiceId, user?.countryCode ?? undefined, {
    enabled: open && step === TM_STEP_INDEX.facility && Boolean(selectedServiceId)
  });
  // The facility's own zone decides which calendar the client is picking from. The policy
  // default is a fallback for a facility the API sent no timezone for -- it is one value for
  // the whole platform, so it is only correct while every facility shares it.
  const facilityTimezone =
    selectedFacility?.timezone ?? policyQuery.data?.defaultTimezone ?? TELEMEDICINE_DEFAULT_TIMEZONE;

  // The first day the client may pick, in the facility's calendar rather than the device's.
  const earliestDate = facilityToday(facilityTimezone);

  // Which week is on screen, kept separate from which day is chosen. Deriving the week from
  // the selection made the strip slide forward on every click, so picking the last day threw
  // away the earlier ones and there was no way back.
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(
    () => facilityLocalDateRange(earliestDate, weekOffset * WEEK_LENGTH + 1).at(-1) ?? earliestDate,
    [earliestDate, weekOffset]
  );
  const weekDates = useMemo(() => facilityLocalDateRange(weekStart, WEEK_LENGTH), [weekStart]);
  const canGoBack = weekOffset > 0;
  // The API refuses a range wider than its lookahead, so the last week we may show is the one
  // that still ends inside it.
  const canGoForward = (weekOffset + 1) * WEEK_LENGTH < MAX_LOOKAHEAD_DAYS;

  // One request for the whole visible week. The backend cost is the same as a single day --
  // the fan-out was per provider, not per date -- so a week of counts is effectively free,
  // and the client stops guessing dates blind.
  const slotsQuery = useAvailableSlots(
    selectedFacility?.id ?? null,
    selectedFacility?.facilityServiceId ?? null,
    weekStart,
    weekDates[weekDates.length - 1],
    { enabled: open && step === TM_STEP_INDEX.slot && Boolean(selectedFacility) }
  );

  // Prefer the zone the slots themselves arrived with: it travels with the instants it
  // explains, so it cannot drift from them the way a separately-fetched value can.
  const slotTimezone = slotsQuery.data?.timezone ?? facilityTimezone;
  const slotsByDate = useMemo(
    () => groupSlotsByFacilityLocalDate(slotsQuery.data?.slots ?? [], slotTimezone),
    [slotsQuery.data, slotTimezone]
  );
  const activeDate = selectedDate ?? weekStart;
  const weekRangeLabel = useMemo(() => {
    const first = facilityLocalDayLabel(weekDates[0] ?? weekStart);
    const last = facilityLocalDayLabel(weekDates[weekDates.length - 1] ?? weekStart);
    return `${first.weekday} ${first.day} \u2013 ${last.weekday} ${last.day}`;
  }, [weekDates, weekStart]);
  const slotsForActiveDate = slotsByDate.get(activeDate) ?? [];
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

  const catalogServiceOptions = (catalogServicesQuery.data ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    base_price_cents: service.basePriceCents,
    default_estimate_minutes: service.defaultEstimateMinutes,
    remote_capable: true,
    active: true
  }));
  const serviceOptions = serviceId ? servicesQuery.data ?? [] : catalogServiceOptions;
  const selectedService = serviceOptions.find((service) => service.id === selectedServiceId) ?? null;
  const hold = holdQuery.data ?? null;
  const categoryCards = useMemo(() => {
    const subcategoriesByCategory = new Map<string, typeof subcategoriesQuery.data>();
    (subcategoriesQuery.data ?? []).forEach((subcategory) => {
      const items = subcategoriesByCategory.get(subcategory.categoryId) ?? [];
      items.push(subcategory);
      subcategoriesByCategory.set(subcategory.categoryId, items);
    });
    const servicesBySubcategory = new Map<string, typeof catalogServicesQuery.data>();
    (catalogServicesQuery.data ?? []).forEach((service) => {
      const items = servicesBySubcategory.get(service.subcategoryId) ?? [];
      items.push(service);
      servicesBySubcategory.set(service.subcategoryId, items);
    });
    return (categoriesQuery.data ?? []).map((category) => ({
      category,
      specialties: (subcategoriesByCategory.get(category.id) ?? []).map((subcategory) => ({
        subcategory,
        services: servicesBySubcategory.get(subcategory.id) ?? []
      }))
    }));
  }, [categoriesQuery.data, catalogServicesQuery.data, subcategoriesQuery.data]);

  useEffect(() => {
    if (!hold) {
      setRemainingHoldSeconds(0);
      return;
    }
    setRemainingHoldSeconds(hold.remainingSeconds);
    const timer = window.setInterval(() => {
      setRemainingHoldSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hold?.id, hold?.remainingSeconds]);

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
    setSelectedDate(null);
    setSelectedSlot(null);
    setHoldId(null);
    setPreference({});
    setPreferenceSaved(false);
    setPreferenceSaveError(null);
    setSubmitError(null);
    onClose();
  };

  const handleSelectSlot = async (slot: TelemedicineSlot) => {
    if (!selectedFacility) return;
    setSubmitError(null);
    setPreferenceSaveError(null);
    setPreferenceSaved(false);
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
      if (Object.values(preference).some(Boolean)) {
        try {
          if (!newHold.bookingId) {
            throw new Error("The appointment was created without a booking reference.");
          }
          await savePreference.mutateAsync({ bookingId: newHold.bookingId, preference });
          setPreferenceSaved(true);
        } catch (error) {
          const detail = classifyApiError(error, "").message;
          setPreferenceSaveError(
            `Your provider preference could not be saved.${detail ? ` ${detail}` : ""}`
          );
        }
      }
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
    setPreferenceSaveError(null);
    // Catch an unusable number here, before the STK push is even requested, rather than letting
    // the client find out only after the backend rejects it.
    if (mpesaPhoneValidationError(phone)) {
      return;
    }
    // A ref, not the mutation's isPending: that only turns true after React re-renders, so
    // two clicks in the same tick would both get through and send two M-Pesa prompts. The
    // disabled button is the visible half of this; the ref is the half that actually holds.
    if (payInFlightRef.current || paymentInitiated) {
      return;
    }
    payInFlightRef.current = true;

    try {
      // Saved before payment is requested, and payment does not proceed without it. Taking
      // money for a preference we failed to record means the client pays for a consultation
      // chosen on criteria the facility never sees, and finds out at the appointment. Better
      // to stop here, where they can retry or clear the preference and continue deliberately.
      if (hold?.bookingId && Object.values(preference).some(Boolean) && !preferenceSaved) {
        try {
          await savePreference.mutateAsync({ bookingId: hold.bookingId, preference });
          setPreferenceSaved(true);
        } catch (error) {
          // A fixed lead sentence, then whatever the server said. The raw message alone is
          // often "Network Error", which does not tell a client what it means for them.
          const detail = classifyApiError(error, "").message;
          setPreferenceSaveError(
            `Your provider preference could not be saved.${detail ? ` ${detail}` : ""}`
          );
          return;
        }
      }
      await initiatePaymentMutation.mutateAsync({ holdId, phone: phone.trim() || undefined });
      toast.showToast({
        title: "Payment initiated",
        description: "Check your phone to approve the M-Pesa prompt."
      });
    } catch (error) {
      setSubmitError(classifyApiError(error, "Unable to start payment."));
    } finally {
      payInFlightRef.current = false;
    }
  };

  /** Continue without the preference, once the client has been told it could not be saved. */
  const handlePayWithoutPreference = async () => {
    if (!holdId || payInFlightRef.current || paymentInitiated) return;
    payInFlightRef.current = true;
    setPreferenceSaveError(null);
    // Cleared so a later retry does not silently reattach it: the client has chosen to go
    // ahead without one, and the form still shows what they had entered.
    try {
      await initiatePaymentMutation.mutateAsync({ holdId, phone: phone.trim() || undefined });
      toast.showToast({
        title: "Payment initiated",
        description: "Check your phone to approve the M-Pesa prompt."
      });
    } catch (error) {
      setSubmitError(classifyApiError(error, "Unable to start payment."));
    } finally {
      payInFlightRef.current = false;
    }
  };

  const phoneError = phoneTouched ? mpesaPhoneValidationError(phone) : null;
  // Derived from the server, not only from this page's mutation state: a reload, or coming
  // back to a tab, must still show the prompt as outstanding rather than offering to send a
  // second one. The local flag is kept as well so the UI reacts immediately, before the hold
  // query refetches.
  const paymentInitiated =
    Boolean(hold?.bookingId) && (initiatePaymentMutation.isSuccess || Boolean(hold?.paymentPending));
  // Any work in flight that a second click would duplicate.
  const paymentInFlight = initiatePaymentMutation.isPending || savePreference.isPending;
  const paymentConfirmed = Boolean(hold?.bookingStatus && hold.bookingStatus !== "telemedicine_payment_pending");

  return (
    <Modal open={open} onClose={handleClose} title="Book a remote consultation" maxWidth="md">
      <div className="space-y-6">
        <Stepper steps={TM_STEPS} current={step} />

        {step === TM_STEP_INDEX.service && (
          <div className="space-y-3">
            {!user?.countryCode && <CountryRequiredBanner onComplete={handleClose} />}
            {serviceId ? (
              servicesQuery.isLoading && <Loading />
            ) : (
              <>
                {(categoriesQuery.isLoading || subcategoriesQuery.isLoading || catalogServicesQuery.isLoading) && <Loading />}
              </>
            )}
            {!serviceId && !categoriesQuery.isLoading && !subcategoriesQuery.isLoading && !catalogServicesQuery.isLoading && categoryCards.length === 0 && (
              <p className="text-sm text-slate-500">No remote consultations are available right now.</p>
            )}
            {serviceId && !servicesQuery.isLoading && serviceOptions.length === 0 && (
              <p className="text-sm text-slate-500">No remote-consultation services are available right now.</p>
            )}
            {!serviceId && !categoriesQuery.isLoading && !subcategoriesQuery.isLoading && !catalogServicesQuery.isLoading && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">Choose a consultation below to see available facilities and times.</p>
                {categoryCards.map(({ category, specialties }) => (
                  <section key={category.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3">
                      <h3 className="text-base font-bold text-slate-900">{category.name}</h3>
                      {category.description && <p className="mt-1 text-sm text-slate-500">{category.description}</p>}
                    </div>
                    {specialties.length === 0 ? (
                      <p className="text-sm text-slate-500">No consultations are available in this area yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {specialties.map(({ subcategory, services }) => (
                          <div key={subcategory.id} className="rounded-xl bg-slate-50 p-3">
                            <p className="text-sm font-semibold text-slate-800">{subcategory.name}</p>
                            {subcategory.description && <p className="mt-1 text-xs text-slate-500">{subcategory.description}</p>}
                            {services.length === 0 ? (
                              <p className="mt-2 text-xs text-slate-500">No bookable services available yet.</p>
                            ) : (
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {services.map((service) => (
                                  <button
                                    key={service.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedServiceId(service.id);
                                      setStep(TM_STEP_INDEX.facility);
                                    }}
                                    className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-tiba-blue hover:shadow-sm"
                                  >
                                    <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                                    {service.description && <p className="mt-1 text-xs text-slate-500">{service.description}</p>}
                                    <p className="mt-2 text-sm font-medium text-tiba-blue">From {formatCurrency(service.basePriceCents, service.currency)}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}
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
                        // Clear the day: another facility may keep a different calendar, so
                        // the same date string would not mean the same window.
                        setSelectedDate(null);
                        setPreference({});
                        setPreferenceSaved(false);
                        setPreferenceSaveError(null);
                        setStep(TM_STEP_INDEX.preferences);
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

        {step === TM_STEP_INDEX.preferences && selectedFacility && (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
            <div>
              <p className="text-lg font-semibold text-slate-900">Preferences <span className="font-normal text-slate-500">(optional)</span></p>
              <p className="mt-1 text-sm text-slate-500">Tell us what matters to you before you choose a time.</p>
            </div>
            <ProviderPreferenceFields
              value={preference}
              alwaysExpanded
              onChange={(next) => {
                setPreference(next);
                setPreferenceSaved(false);
                setPreferenceSaveError(null);
              }}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="button" onClick={() => setStep(TM_STEP_INDEX.slot)}>
                Continue to choose a time
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(TM_STEP_INDEX.slot)}>
                Skip for now
              </Button>
            </div>
            <div className="flex justify-start border-t border-slate-200 pt-3">
              <Button type="button" variant="secondary" onClick={() => setStep(TM_STEP_INDEX.facility)}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === TM_STEP_INDEX.slot && selectedFacility && (
          <div className="space-y-3">
            {/* Week navigation, separate from day selection: choosing a day must not move
                the window the client is looking at. */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setWeekOffset((current) => Math.max(0, current - 1))}
                disabled={!canGoBack}
                aria-label="Previous week"
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600 transition hover:border-tiba-blue disabled:cursor-not-allowed disabled:opacity-40"
              >
                &lsaquo;
              </button>
              <span className="text-xs font-medium text-slate-600">{weekRangeLabel}</span>
              <button
                type="button"
                onClick={() => setWeekOffset((current) => current + 1)}
                disabled={!canGoForward}
                aria-label="Next week"
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600 transition hover:border-tiba-blue disabled:cursor-not-allowed disabled:opacity-40"
              >
                &rsaquo;
              </button>
            </div>
            {/* A week of days with their counts, so the client can see where the openings are
                instead of picking dates one at a time and being told there are none. */}
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Choose a day">
              {weekDates.map((date) => {
                const label = facilityLocalDayLabel(date);
                const count = (slotsByDate.get(date) ?? []).length;
                const isActive = date === activeDate;
                const isEmpty = !slotsQuery.isLoading && count === 0;
                return (
                  <button
                    key={date}
                    type="button"
                    aria-pressed={isActive}
                    disabled={isEmpty}
                    onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center rounded-xl border px-1 py-2 transition ${
                      isActive
                        ? "border-tiba-blue bg-tiba-blue/5 text-tiba-blue"
                        : "border-slate-200 text-slate-700 hover:border-tiba-blue"
                    } ${isEmpty ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <span className="text-[10px] uppercase tracking-wide">{label.weekday}</span>
                    <span className="text-base font-semibold">{label.day}</span>
                    <span className="text-[10px] text-slate-500">
                      {slotsQuery.isLoading ? "\u00a0" : count > 0 ? `${count} open` : "\u2014"}
                    </span>
                  </button>
                );
              })}
            </div>
            {slotsQuery.isLoading && <Loading />}
            {slotsQuery.isError && (
              <p className="text-sm text-slate-500">
                We could not load appointment times. Close this and try again.
              </p>
            )}
            {submitError && <ApiErrorBanner category={submitError.category} message={submitError.message} />}
            {!slotsQuery.isLoading && !slotsQuery.isError && (slotsQuery.data?.slots ?? []).length === 0 && (
              <p className="text-sm text-slate-500">
                No open appointments in the next {WEEK_LENGTH} days at this facility.
              </p>
            )}
            {!slotsQuery.isLoading && !slotsQuery.isError && slotsForActiveDate.length === 0 &&
              (slotsQuery.data?.slots ?? []).length > 0 && (
                <p className="text-sm text-slate-500">
                  Nothing open on this day. Pick a day above with times available.
                </p>
              )}
            <div className="grid gap-2 sm:grid-cols-3">
              {slotsForActiveDate.map((slot) => (
                <button
                  key={slot.startAt}
                  type="button"
                  disabled={createHoldMutation.isPending}
                  onClick={() => handleSelectSlot(slot)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-tiba-blue hover:text-tiba-blue disabled:opacity-50"
                >
                  {formatSlotTime(slot.startAt, slotTimezone)} &ndash;{" "}
                  {formatSlotTime(slot.endAt, slotTimezone)}
                </button>
              ))}
            </div>
            <div className="flex justify-start">
              <Button type="button" variant="secondary" onClick={() => setStep(TM_STEP_INDEX.preferences)}>
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
                {formatSlotDate(selectedSlot.startAt, slotTimezone)} at{" "}
                {formatSlotTime(selectedSlot.startAt, slotTimezone)}
              </p>
              <p className="mt-2 text-lg font-semibold text-tiba-blue">
                {formatCurrency(selectedFacility.priceCents, selectedFacility.currency)}
              </p>
            </div>

            {!holdExpired && !paymentConfirmed && hold?.bookingId && preferenceSaveError && (
                  <div
                    role="alert"
                    className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3"
                  >
                    <p className="text-sm text-amber-800">
                      {preferenceSaveError} Payment has not been taken, so nothing has been
                      charged yet.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handlePay}
                        loading={savePreference.isPending}
                        disabled={paymentInFlight}
                      >
                        Try again
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handlePayWithoutPreference}
                        disabled={paymentInFlight}
                      >
                        Continue without a preference
                      </Button>
                    </div>
                  </div>
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
                  <Button
                    type="button"
                    loading={paymentInFlight}
                    disabled={paymentInFlight || Boolean(preferenceSaveError)}
                    onClick={handlePay}
                  >
                    Confirm &amp; pay
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
