import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Modal } from "../../../shared/components/Modal";
import { Button } from "../../../shared/components/Button";
import { Input } from "../../../shared/components/Input";
import { Stepper } from "../../../shared/components/Stepper";
import { Loading } from "../../../shared/components/Loading";
import { Skeleton } from "../../../shared/components/Skeleton";
import type { ProviderPreference } from "../../../shared/libs/telemedicineOps";
import {
  fetchTelemedicineCatalogServices,
  fetchTelemedicineCategories,
  fetchTelemedicineSubcategories
} from "../../../shared/libs/telemedicineCatalog";
import {
  getTelemedicineCategoryAsset,
  getTelemedicineServiceAsset,
  TELEMEDICINE_ALL_SERVICES_ASSET,
  type TelemedicineServiceAssetKeys
} from "../../../shared/libs/telemedicineCategoryAssets";
import { TelemedicineServiceVisual } from "../../../shared/components/TelemedicineServiceVisual";
import { ProviderPreferenceFields } from "./ProviderPreferenceFields";
import { BookingAccountStep } from "./BookingAccountStep";
import { useFastestFacility } from "../../../shared/hooks/useFastestFacility";
import { MpesaPaymentInstructions } from "../../../shared/components/MpesaPaymentInstructions";
import { RemoteCareRegionNotice } from "../../../shared/components/RemoteCareRegionNotice";
import { ApiErrorBanner } from "../../../shared/components/ApiErrorBanner";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useToast } from "../../../shared/components/ToastProvider";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, svcCard } from "../../../shared/libs/fieldInclude";
import type { RemoteFacility } from "../../../shared/libs/telemedicine";
import type { TelemedicineHold, TelemedicineSlot } from "../../../shared/schemas/telemedicine";
import { classifyApiError, type ClassifiedApiError } from "../../../shared/utils/errors";
import { mpesaPhoneValidationError } from "../../../shared/utils/mpesaPhone";
import { sortSpecialistFirst } from "../../../shared/utils/telemedicineCatalogOrdering";
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
import { bookingReference } from "../../../shared/utils/bookingReference";

type TelemedicineRequestDialogProps = {
  open: boolean;
  onClose: () => void;
  serviceId?: string | null;
  onCreated?: (bookingId: string) => void;
  /**
   * "dialog" (the default) shows the booking in a popup over the screen it was opened from, which suits a client who is
   * already inside the app. "page" lays the same steps out as the page itself, for the public booking page, where there is
   * nothing underneath to go back to. Everything inside is the same in both.
   */
  layout?: "dialog" | "page";
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

// "details" only happens for someone who is not signed in. It comes after the time is chosen, so a person sees what is on
// offer, at what price and when, before they are asked who they are; the account made there is what the time is held for.
const TM_STEP_INDEX = { service: 0, facility: 1, slot: 2, details: 3, confirm: 4 } as const;

const TM_STEPS = [
  { title: "Service", description: "What kind of consultation?" },
  { title: "Facility", description: "Choose a care site" },
  { title: "Slot", description: "Pick a time" },
  { title: "Confirm", description: "Review & pay" }
];

const TM_STEPS_WITH_DETAILS = [
  TM_STEPS[0],
  TM_STEPS[1],
  TM_STEPS[2],
  { title: "Details", description: "Your name and number" },
  TM_STEPS[3]
];

// The page names its steps in a visitor's words, and each step says what to do in a heading of its own, so there are no
// descriptions here. The popup keeps the titles and descriptions above.
const PAGE_STEPS = [{ title: "Consultation" }, { title: "Clinic" }, { title: "Time" }, { title: "Pay" }];
const PAGE_STEPS_WITH_DETAILS = [
  PAGE_STEPS[0],
  PAGE_STEPS[1],
  PAGE_STEPS[2],
  { title: "Details" },
  PAGE_STEPS[3]
];

const PageStepHeading = ({ children, hint }: { children: ReactNode; hint?: string }) => (
  <div>
    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{children}</h2>
    {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
  </div>
);

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

// Shared by the hold query's refetchInterval (which only sees query.state.data) and the
// component's own derived state below, so the two can never drift out of sync.
const isHoldPaymentConfirmed = (hold: Pick<TelemedicineHold, "bookingStatus"> | null | undefined): boolean =>
  Boolean(hold?.bookingStatus && hold.bookingStatus !== "telemedicine_payment_pending");

const isHoldExpired = (hold: Pick<TelemedicineHold, "isActive" | "bookingStatus"> | null | undefined): boolean =>
  Boolean(hold) && !hold?.isActive && hold?.bookingStatus !== "telemedicine_paid_pending_assignment";

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

type BookingShellProps = {
  open: boolean;
  onClose: () => void;
  /** The service step shows a wide catalogue; every later step is a single column. */
  wide: boolean;
  regionLabel: string;
  regionRef: Ref<HTMLDivElement>;
  children: ReactNode;
};

const DialogShell = ({ open, onClose, wide, children }: BookingShellProps) => (
  <Modal open={open} onClose={onClose} title="Book a remote consultation" maxWidth={wide ? "lg" : "md"}>
    {children}
  </Modal>
);

// The booking as the page itself. The region is what gets focus when the step changes, so a screen reader is told where
// the person now is; it has no outline because it is not something to operate.
const PageShell = ({ wide, regionLabel, regionRef, children }: BookingShellProps) => (
  <div className={wide ? "w-full" : "mx-auto w-full max-w-2xl"}>
    <h1 className="mb-3 text-xl font-bold tracking-tight text-slate-950 sm:mb-5 sm:text-3xl">Talk to a doctor online</h1>
    <div ref={regionRef} role="region" aria-label={regionLabel} tabIndex={-1} className="outline-none">
      {children}
    </div>
  </div>
);

// Shaped like what replaces it (search, care areas, a grid of cards), so the page does not jump when the catalogue arrives.
const CatalogSkeleton = ({ gridClass }: { gridClass: string }) => (
  <div className="space-y-4" role="status" aria-live="polite">
    <span className="sr-only">Loading consultations</span>
    <Skeleton height={48} />
    <div className="flex gap-2 overflow-hidden">
      {[110, 130, 140, 150].map((width) => (
        <Skeleton key={width} height={44} width={width} rounded="pill" className="shrink-0" />
      ))}
    </div>
    <div className={`grid gap-3 ${gridClass}`}>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} height={112} />
      ))}
    </div>
  </div>
);

export const TelemedicineRequestDialog = ({
  open,
  onClose,
  serviceId,
  onCreated,
  layout = "dialog"
}: TelemedicineRequestDialogProps) => {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<number>(serviceId ? TM_STEP_INDEX.facility : TM_STEP_INDEX.service);
  const isSignedIn = Boolean(user);
  // Whether this booking began without an account. Decided when the dialog opens and then kept, so the steps do not
  // change from five to four in the middle of the journey when the account is made at the details step.
  const [startedSignedOut, setStartedSignedOut] = useState(!user);
  useEffect(() => {
    if (open) {
      setStartedSignedOut(!user);
    }
    // Only when the dialog opens: making the account must not flip this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const [holdingAfterAccount, setHoldingAfterAccount] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(serviceId ?? null);
  const [selectedFacility, setSelectedFacility] = useState<RemoteFacility | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TelemedicineSlot | null>(null);
  // Set only when the facility was chosen with "Fastest available": which facility, and the
  // start of the earliest appointment it reported. Choosing a facility by hand clears it.
  const [fastestPick, setFastestPick] = useState<{ facilityId: string; startAt: string } | null>(null);
  const [noFastestFound, setNoFastestFound] = useState(false);
  const fastestFacility = useFastestFacility();
  const [holdId, setHoldId] = useState<string | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? "");
  // The M-Pesa number follows whoever is signed in, until the person types one of their own. It follows them back to blank
  // too: a staff account that was signed in and out again during this booking must not leave its number on the pay screen of
  // the patient account made next.
  const phoneTypedRef = useRef(false);
  useEffect(() => {
    if (!phoneTypedRef.current) {
      setPhone(user?.phone ?? "");
    }
  }, [user?.phone]);
  const [preference, setPreference] = useState<Partial<ProviderPreference>>({});
  // Guards against a double-tap sending two M-Pesa prompts; see handlePay.
  const payInFlightRef = useRef(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitError, setSubmitError] = useState<ClassifiedApiError | null>(null);
  const [remainingHoldSeconds, setRemainingHoldSeconds] = useState(0);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("all");

  const policyQuery = useTelemedicinePolicy();
  const servicesQuery = useRemoteServiceOptions(open && Boolean(serviceId));
  // Matches useTelemedicinePolicy's own staleTime convention: this catalog (categories,
  // subcategories, services) changes about as rarely as the policy does, but previously had no
  // staleTime at all (default 0), so every dialog reopen within the same session silently
  // refetched all three in the background even though nothing had changed.
  const TELEMEDICINE_CATALOG_STALE_TIME = 5 * 60_000;
  const categoriesQuery = useQuery({
    queryKey: ["client", "telemedicine", "categories"],
    queryFn: fetchTelemedicineCategories,
    enabled: open && step === TM_STEP_INDEX.service && !serviceId,
    staleTime: TELEMEDICINE_CATALOG_STALE_TIME
  });
  const subcategoriesQuery = useQuery({
    queryKey: ["client", "telemedicine", "subcategories"],
    queryFn: () => fetchTelemedicineSubcategories(),
    enabled: open && step === TM_STEP_INDEX.service && !serviceId,
    staleTime: TELEMEDICINE_CATALOG_STALE_TIME
  });
  const catalogServicesQuery = useQuery({
    queryKey: ["client", "telemedicine", "services"],
    queryFn: () => fetchTelemedicineCatalogServices(),
    enabled: open && step === TM_STEP_INDEX.service && !serviceId,
    staleTime: TELEMEDICINE_CATALOG_STALE_TIME
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
  // The slot the earliest-time lookup pointed at, found again in the freshly loaded list so a
  // time that has since been taken is never offered.
  const earliestSlot = useMemo(() => {
    if (!fastestPick || fastestPick.facilityId !== selectedFacility?.id) {
      return null;
    }
    const target = new Date(fastestPick.startAt).getTime();
    return (slotsQuery.data?.slots ?? []).find((slot) => new Date(slot.startAt).getTime() === target) ?? null;
  }, [fastestPick, selectedFacility?.id, slotsQuery.data]);
  // Open on the day that has the earliest time, so it is visible in the list as well as in the banner.
  useEffect(() => {
    if (!earliestSlot || selectedDate) {
      return;
    }
    for (const [date, daySlots] of slotsByDate) {
      if (daySlots.some((slot) => slot.startAt === earliestSlot.startAt)) {
        setSelectedDate(date);
        return;
      }
    }
  }, [earliestSlot, selectedDate, slotsByDate]);
  const holdQuery = useHoldQuery(holdId, {
    enabled: Boolean(holdId),
    // Once payment is confirmed or the hold has reached a terminal state, nothing will change
    // again -- keep polling only while payment is genuinely still pending.
    refetchInterval: (query) => {
      if (!holdId) {
        return false;
      }
      const data = query.state.data;
      if (isHoldPaymentConfirmed(data) || isHoldExpired(data)) {
        return false;
      }
      return 4000;
    }
  });

  const createHoldMutation = useCreateHoldMutation();
  const releaseHoldMutation = useReleaseHoldMutation();
  const initiatePaymentMutation = useInitiateHoldPaymentMutation();

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
  // Stable catalog keys per service id, derived from the three catalog queries already loaded --
  // lets the confirm summary reuse the resolver without another request or an API change.
  const catalogServiceAssetKeys = useMemo(() => {
    const categoriesById = new Map((categoriesQuery.data ?? []).map((category) => [category.id, category]));
    const subcategoriesById = new Map((subcategoriesQuery.data ?? []).map((subcategory) => [subcategory.id, subcategory]));
    const keysByServiceId = new Map<string, TelemedicineServiceAssetKeys>();
    (catalogServicesQuery.data ?? []).forEach((service) => {
      const subcategory = subcategoriesById.get(service.subcategoryId);
      const category = subcategory ? categoriesById.get(subcategory.categoryId) : undefined;
      keysByServiceId.set(service.id, {
        serviceKey: service.key,
        subcategoryKey: subcategory?.key,
        categoryKey: category?.key
      });
    });
    return keysByServiceId;
  }, [categoriesQuery.data, catalogServicesQuery.data, subcategoriesQuery.data]);
  const selectedServiceAssetKeys =
    selectedService && !serviceId ? catalogServiceAssetKeys.get(selectedService.id) : undefined;
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
    return sortSpecialistFirst(categoriesQuery.data ?? []).map((category) => ({
      category,
      specialties: (subcategoriesByCategory.get(category.id) ?? []).map((subcategory) => ({
        subcategory,
        services: servicesBySubcategory.get(subcategory.id) ?? []
      }))
    }));
  }, [categoriesQuery.data, catalogServicesQuery.data, subcategoriesQuery.data]);
  const visibleCategoryCards = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();

    return categoryCards
      .filter(({ category }) => catalogCategoryFilter === "all" || category.id === catalogCategoryFilter)
      .map(({ category, specialties }) => {
        const categoryText = `${category.name} ${category.key} ${category.description ?? ""}`.toLowerCase();
        const categoryMatches = !query || categoryText.includes(query);
        const visibleSpecialties = specialties
          .map(({ subcategory, services }) => {
            const subcategoryText = `${subcategory.name} ${subcategory.key} ${subcategory.description ?? ""}`.toLowerCase();
            const subcategoryMatches = categoryMatches || subcategoryText.includes(query);
            const visibleServices = subcategoryMatches
              ? services
              : services.filter((service) =>
                  `${service.name} ${service.key} ${service.description ?? ""}`.toLowerCase().includes(query)
                );

            return { subcategory, services: visibleServices };
          })
          .filter(({ services }) => services.length > 0);

        return { category, specialties: visibleSpecialties };
      })
      .filter(({ specialties }) => specialties.length > 0);
  }, [catalogCategoryFilter, catalogSearch, categoryCards]);

  const catalogLoading = categoriesQuery.isLoading || subcategoriesQuery.isLoading || catalogServicesQuery.isLoading;
  const catalogFailed =
    !catalogLoading && (categoriesQuery.isError || subcategoriesQuery.isError || catalogServicesQuery.isError);
  // A failed load must not read as "nothing is available": say what failed and offer to try again.
  const catalogError = catalogFailed
    ? classifyApiError(
        categoriesQuery.error ?? subcategoriesQuery.error ?? catalogServicesQuery.error,
        "We could not load the consultations."
      )
    : null;
  const retryCatalog = () => {
    [categoriesQuery, subcategoriesQuery, catalogServicesQuery]
      .filter((query) => query.isError)
      .forEach((query) => {
        query.refetch().catch(() => undefined);
      });
  };

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

  const holdExpired = isHoldExpired(hold);

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

  // Also what Back does on the pay step: the slot was held the moment it was tapped, so going back gives it up at once
  // instead of leaving it reserved for ten minutes.
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
    setFastestPick(null);
    setNoFastestFound(false);
    fastestFacility.reset();
    setSelectedDate(null);
    setSelectedSlot(null);
    setHoldId(null);
    setPreference({});
    setSubmitError(null);
    setCatalogSearch("");
    setCatalogCategoryFilter("all");
    onClose();
  };

  const handleChooseFastest = () => {
    if (!selectedServiceId) return;
    setNoFastestFound(false);
    fastestFacility.mutate(
      { serviceId: selectedServiceId, countryCode: user?.countryCode ?? undefined },
      {
        onSuccess: ({ facility, earliestAvailableAt }) => {
          if (!facility || !earliestAvailableAt) {
            setNoFastestFound(true);
            return;
          }
          setSelectedFacility(facility);
          setFastestPick({ facilityId: facility.id, startAt: earliestAvailableAt });
          // Same reset as choosing a facility by hand: another facility may keep a different calendar.
          setSelectedDate(null);
          setPreference({});
          setStep(TM_STEP_INDEX.slot);
        }
      }
    );
  };

  // Holds the chosen time for the signed-in person and moves on to pay. Done straight away for someone who is signed in,
  // and right after the account is made for someone who was not. A time that has just been taken sends them back to the
  // list with the reason.
  const holdSlot = async (slot: TelemedicineSlot) => {
    if (!selectedFacility) return;
    try {
      const newHold = await createHoldMutation.mutateAsync({
        facilityId: selectedFacility.id,
        facilityServiceId: selectedFacility.facilityServiceId,
        startAt: slot.startAt,
        // This key identifies one hold attempt, not the appointment slot forever. Reusing a
        // slot-derived key would make a later selection return the same expired hold.
        idempotencyKey: crypto.randomUUID()
      });
      queryClient.setQueryData(["telemedicine", "hold", newHold.id], newHold);
      setHoldId(newHold.id);
      setStep(TM_STEP_INDEX.confirm);
    } catch (error) {
      setSubmitError(classifyApiError(error, "Please try a different slot."));
      setSelectedSlot(null);
      setStep(TM_STEP_INDEX.slot);
    }
  };

  const handleSelectSlot = async (slot: TelemedicineSlot) => {
    if (!selectedFacility) return;
    setSubmitError(null);
    setSelectedSlot(slot);
    if (!isSignedIn) {
      // Nothing is held for someone with no account yet: they give their details first, then the time is held.
      setStep(TM_STEP_INDEX.details);
      return;
    }
    await holdSlot(slot);
  };

  // The account now exists and the person is signed in: hold the time they chose and go on to pay.
  const handleAccountReady = async () => {
    if (!selectedSlot) {
      setStep(TM_STEP_INDEX.slot);
      return;
    }
    setHoldingAfterAccount(true);
    try {
      await holdSlot(selectedSlot);
    } finally {
      setHoldingAfterAccount(false);
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
    // A ref, not the mutation's isPending: that only turns true after React re-renders, so
    // two clicks in the same tick would both get through and send two M-Pesa prompts. The
    // disabled button is the visible half of this; the ref is the half that actually holds.
    if (payInFlightRef.current || paymentInitiated) {
      return;
    }
    payInFlightRef.current = true;

    try {
      const hasPreference = Object.values(preference).some(Boolean);
      await initiatePaymentMutation.mutateAsync({
        holdId,
        phone: phone.trim() || undefined,
        ...(hasPreference ? { preference } : {})
      });
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
  const paymentInFlight = initiatePaymentMutation.isPending;
  const paymentConfirmed = isHoldPaymentConfirmed(hold);

  // Only the service picker benefits from extra width -- category tiles and richer service
  // cards need room to breathe; every later step is still a single-column form/list that "md"
  // already fits. One Modal, one DOM tree; this is a prop value, not a second layout branch.
  const isServiceStep = step === TM_STEP_INDEX.service && !serviceId;
  // A person who began without an account sees five steps; a signed-in client sees four, and Confirm is the fourth.
  const isPage = layout === "page";
  const stepperSteps = isPage
    ? startedSignedOut
      ? PAGE_STEPS_WITH_DETAILS
      : PAGE_STEPS
    : startedSignedOut
      ? TM_STEPS_WITH_DETAILS
      : TM_STEPS;
  const stepperCurrent = !startedSignedOut && step === TM_STEP_INDEX.confirm ? 3 : step;
  // A person who is signed in but whose number gives no country is told so. Someone who has not signed in is simply
  // shown Kenya's consultations: their country is read from the number they give at the details step.
  const countryUnknown = isSignedIn && !user?.countryCode;
  // Room for three cards across on the page; the popup is narrower and keeps two.
  const serviceGridClass = layout === "page" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";

  // On the page a new step replaces the content in place. Take the person back to the top of it and tell a screen reader
  // where they now are. A popup scrolls itself and keeps focus inside, so it needs neither.
  const stepRegionRef = useRef<HTMLDivElement | null>(null);
  const lastStepRef = useRef(step);
  useEffect(() => {
    if (lastStepRef.current === step) {
      return;
    }
    lastStepRef.current = step;
    if (layout === "page") {
      window.scrollTo({ top: 0 });
      stepRegionRef.current?.focus({ preventScroll: true });
    }
  }, [step, layout]);
  const stepRegionLabel = `Step ${stepperCurrent + 1} of ${stepperSteps.length}: ${stepperSteps[stepperCurrent]?.title ?? ""}`;
  const Shell = layout === "page" ? PageShell : DialogShell;

  return (
    <Shell open={open} onClose={handleClose} wide={isServiceStep} regionLabel={stepRegionLabel} regionRef={stepRegionRef}>
      <div className="space-y-6">
        <Stepper steps={stepperSteps} current={stepperCurrent} compactOnMobile showDescriptions={!isPage} />

        {step === TM_STEP_INDEX.service && (
          <div className="space-y-4">
            {countryUnknown && <RemoteCareRegionNotice actionLabel="Close" onAction={handleClose} />}
            {serviceId && servicesQuery.isLoading && <Loading />}
            {!serviceId && catalogLoading && <CatalogSkeleton gridClass={serviceGridClass} />}
            {!serviceId && catalogError && (
              <ApiErrorBanner category={catalogError.category} message={catalogError.message} onRetry={retryCatalog} />
            )}
            {!serviceId && !catalogLoading && !catalogFailed && categoryCards.length === 0 && (
              <p className="text-sm text-slate-500">No remote consultations are available right now.</p>
            )}
            {serviceId && !servicesQuery.isLoading && serviceOptions.length === 0 && (
              <p className="text-sm text-slate-500">No remote-consultation services are available right now.</p>
            )}
            {!serviceId && !catalogLoading && !catalogFailed && categoryCards.length > 0 && (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                  <PageStepHeading
                    hint={
                      startedSignedOut
                        ? "Next you pick a clinic and a time. You give your details only after choosing a time."
                        : "Next you pick a clinic and a time, then pay with M-Pesa."
                    }
                  >
                    Choose a consultation
                  </PageStepHeading>
                  {/* The heading says what this is for, so the field needs no label of its own, only a name for assistive technology. */}
                  <div className="w-full sm:max-w-xs">
                    <Input
                      type="search"
                      aria-label="Search consultations"
                      value={catalogSearch}
                      onChange={(event) => setCatalogSearch(event.target.value)}
                      placeholder="Search services or specialties"
                    />
                  </div>
                </div>
                {/* One row of care areas: it scrolls sideways on a phone instead of using four rows of the first screen.
                    Same catalogCategoryFilter state as before, same values ("all" or a category id). */}
                <div
                  className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
                  role="group"
                  aria-label="Filter by care area"
                >
                  {[
                    { id: "all", name: TELEMEDICINE_ALL_SERVICES_ASSET.label, asset: TELEMEDICINE_ALL_SERVICES_ASSET },
                    ...categoryCards.map(({ category }) => ({
                      id: category.id,
                      name: category.name,
                      asset: getTelemedicineCategoryAsset(category.key)
                    }))
                  ].map(({ id, name, asset }) => {
                    const isActive = catalogCategoryFilter === id;
                    const Icon = asset.Icon;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setCatalogCategoryFilter(id)}
                        className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border py-1.5 pl-2 pr-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue ${
                          isActive
                            ? "border-tiba-blue bg-tiba-blue/5 text-tiba-blue"
                            : "border-slate-200 bg-white text-slate-800 hover:border-tiba-blue"
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${asset.bgClass}`}>
                          <Icon className={`h-4 w-4 ${asset.iconClass}`} aria-hidden="true" />
                        </span>
                        <span className="whitespace-nowrap">{name}</span>
                      </button>
                    );
                  })}
                </div>
                {visibleCategoryCards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center">
                    <p className="text-sm text-slate-600">No consultations match your search or filter.</p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => {
                        setCatalogSearch("");
                        setCatalogCategoryFilter("all");
                      }}
                    >
                      Show all consultations
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {visibleCategoryCards.map(({ category, specialties }) => (
                      <section key={category.id} aria-labelledby={`care-area-${category.id}`} className="space-y-4">
                        <div>
                          <h3 id={`care-area-${category.id}`} className="text-lg font-bold text-slate-900">
                            {category.name}
                          </h3>
                          {category.description && (
                            <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 sm:line-clamp-none">{category.description}</p>
                          )}
                        </div>
                        {specialties.length === 0 ? (
                          <p className="text-sm text-slate-500">No consultations are available in this area yet.</p>
                        ) : (
                          <div className="space-y-5">
                            {specialties.map(({ subcategory, services }) => (
                              <div key={subcategory.id}>
                                <h4 className="text-sm font-semibold text-slate-700">{subcategory.name}</h4>
                                {subcategory.description && (
                                  <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">{subcategory.description}</p>
                                )}
                                {services.length === 0 ? (
                                  <p className="mt-2 text-xs text-slate-500">No bookable services available yet.</p>
                                ) : (
                                  <div className={`mt-2 grid gap-3 ${serviceGridClass}`}>
                                    {services.map((service) => {
                                      const serviceAsset = getTelemedicineServiceAsset({
                                        serviceKey: service.key,
                                        subcategoryKey: subcategory.key,
                                        categoryKey: category.key
                                      });
                                      return (
                                        <button
                                          key={service.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedServiceId(service.id);
                                            setStep(TM_STEP_INDEX.facility);
                                          }}
                                          className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-tiba-blue hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
                                        >
                                          <TelemedicineServiceVisual asset={serviceAsset} />
                                          <span className="min-w-0 flex-1">
                                            <span className="flex items-start justify-between gap-2">
                                              <span className="text-sm font-semibold text-slate-900">{service.name}</span>
                                              {service.isEmergencyCapable && (
                                                <span className="shrink-0 rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-bold uppercase text-danger-600">
                                                  Urgent care
                                                </span>
                                              )}
                                            </span>
                                            {service.description && (
                                              <span className="mt-1 block text-xs text-slate-500">{service.description}</span>
                                            )}
                                            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                              <span className="text-sm font-medium text-tiba-blue">
                                                From {formatCurrency(service.basePriceCents, service.currency)}
                                              </span>
                                              <span className="text-xs text-slate-500">{service.defaultEstimateMinutes} min</span>
                                            </span>
                                            {service.tags.length > 0 && (
                                              <span className="mt-2 flex flex-wrap gap-1">
                                                {service.tags.map((tag) => (
                                                  <span
                                                    key={tag}
                                                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                                  >
                                                    {tag}
                                                  </span>
                                                ))}
                                              </span>
                                            )}
                                          </span>
                                        </button>
                                      );
                                    })}
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
          </div>
        )}

        {step === TM_STEP_INDEX.facility && (
          <div className="space-y-3">
            {isPage && !countryUnknown && <PageStepHeading>Choose a clinic</PageStepHeading>}
            {countryUnknown ? (
              <RemoteCareRegionNotice actionLabel="Close" onAction={handleClose} />
            ) : (
              <>
                {facilitiesQuery.isLoading && <Loading />}
                {!facilitiesQuery.isLoading && (facilitiesQuery.data ?? []).length === 0 && (
                  <p className="text-sm text-slate-500">
                    No facilities currently offer this service remotely in your country.
                  </p>
                )}
                {(facilitiesQuery.data ?? []).length > 0 && (
                  <section
                    className="rounded-2xl border border-tiba-blue/30 bg-tiba-blue/5 p-4"
                    aria-labelledby="fastest-available-heading"
                  >
                    <h3 id="fastest-available-heading" className="text-base font-semibold text-slate-900">
                      Fastest available
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      We check every facility that offers this consultation and pick the one with the earliest open
                      time. You can still choose a facility yourself below.
                    </p>
                    <Button
                      type="button"
                      className="mt-3 w-full sm:w-auto"
                      loading={fastestFacility.isPending}
                      onClick={handleChooseFastest}
                    >
                      {fastestFacility.isError ? "Try again" : "Find the earliest time"}
                    </Button>
                    {fastestFacility.isError && (
                      <p className="mt-2 text-sm text-red-600" role="alert">
                        We could not check availability just now. Try again, or choose a facility below.
                      </p>
                    )}
                    {noFastestFound && (
                      <p className="mt-2 text-sm text-slate-700" role="status">
                        These facilities offer this consultation, but none currently has an open appointment in the
                        next {WEEK_LENGTH} days. Choose a facility below to inspect its calendar, or try again later.
                      </p>
                    )}
                  </section>
                )}
                {(facilitiesQuery.data ?? []).length > 0 && (
                  <div className="pt-1">
                    <p className="text-sm font-medium text-slate-600">Facilities offering this consultation</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Open times for the clinic you choose are shown on the next step.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {(facilitiesQuery.data ?? []).map((facility) => (
                    <button
                      key={facility.id}
                      type="button"
                      onClick={() => {
                        setSelectedFacility(facility);
                        setFastestPick(null);
                        // Clear the day: another facility may keep a different calendar, so
                        // the same date string would not mean the same window.
                        setSelectedDate(null);
                        setPreference({});
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
            {isPage && <PageStepHeading>Pick a time</PageStepHeading>}
            {/* Asked here, before a time is chosen and so before the ten-minute hold starts: nothing optional is ever
                left to do on the pay screen while the reserved time runs down. Collapsed unless the person opens it. */}
            <ProviderPreferenceFields value={preference} onChange={(next) => setPreference(next)} />
            {fastestPick && fastestPick.facilityId === selectedFacility.id && !slotsQuery.isLoading && !slotsQuery.isError && (
              earliestSlot ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-tiba-blue/30 bg-tiba-blue/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Earliest available:</span>{" "}
                    {formatSlotDate(earliestSlot.startAt, slotTimezone)} at {formatSlotTime(earliestSlot.startAt, slotTimezone)}{" "}
                    at {selectedFacility.name}
                  </p>
                  <Button
                    type="button"
                    disabled={createHoldMutation.isPending}
                    loading={createHoldMutation.isPending && selectedSlot?.startAt === earliestSlot.startAt}
                    onClick={() => handleSelectSlot(earliestSlot)}
                  >
                    Book this time
                  </Button>
                </div>
              ) : (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
                  The earliest time we found at {selectedFacility.name} has just been taken. Pick another time below.
                </p>
              )
            )}
            {/* Week navigation, separate from day selection: choosing a day must not move
                the window the client is looking at. */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setWeekOffset((current) => Math.max(0, current - 1))}
                disabled={!canGoBack}
                aria-label="Previous week"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-xl text-slate-600 transition hover:border-tiba-blue disabled:cursor-not-allowed disabled:opacity-40"
              >
                &lsaquo;
              </button>
              <span className="text-xs font-medium text-slate-600">{weekRangeLabel}</span>
              <button
                type="button"
                onClick={() => setWeekOffset((current) => current + 1)}
                disabled={!canGoForward}
                aria-label="Next week"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-xl text-slate-600 transition hover:border-tiba-blue disabled:cursor-not-allowed disabled:opacity-40"
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
                No open appointments in the next {WEEK_LENGTH} days at this facility. Try another facility, or check
                back later.
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
                  className="min-h-[44px] rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-tiba-blue hover:text-tiba-blue disabled:opacity-50"
                >
                  {formatSlotTime(slot.startAt, slotTimezone)} &ndash;{" "}
                  {formatSlotTime(slot.endAt, slotTimezone)}
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

        {step === TM_STEP_INDEX.details && (
          <BookingAccountStep
            busy={holdingAfterAccount}
            onReady={handleAccountReady}
            onBack={() => {
              setSubmitError(null);
              setStep(TM_STEP_INDEX.slot);
            }}
          />
        )}

        {step === TM_STEP_INDEX.confirm && selectedFacility && selectedSlot && (
          <div className="space-y-4">
            {isPage && <PageStepHeading>Review and pay</PageStepHeading>}
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                {selectedServiceAssetKeys && (
                  <TelemedicineServiceVisual asset={getTelemedicineServiceAsset(selectedServiceAssetKeys)} size="sm" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{selectedService?.name ?? "Consultation"}</p>
                  <p className="text-sm text-slate-500">{selectedFacility.name}</p>
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {formatSlotDate(selectedSlot.startAt, slotTimezone)} at{" "}
                {formatSlotTime(selectedSlot.startAt, slotTimezone)}
              </p>
              <p className="mt-2 text-lg font-semibold text-tiba-blue">
                {formatCurrency(selectedFacility.priceCents, selectedFacility.currency)}
              </p>
            </div>

            {!holdExpired && !paymentConfirmed && (
              <p className="text-sm font-medium text-amber-800">
                Holding this slot for{" "}
                <span className="tabular-nums">
                  {Math.floor(remainingHoldSeconds / 60)}:{String(remainingHoldSeconds % 60).padStart(2, "0")}
                </span>
                . Complete payment before it expires.
              </p>
            )}

            {holdExpired && !paymentConfirmed && (
              <div className="space-y-3">
                <p className="text-sm text-danger-600">
                  Your payment reservation expired before it was completed. The appointment date has not passed; choose a new time to continue.
                </p>
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
                  onChange={(event) => {
                    phoneTypedRef.current = true;
                    setPhone(event.target.value);
                  }}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="+254 700 000000"
                  error={phoneError ?? undefined}
                  hint={phoneError ? undefined : "The STK push to approve payment goes to this number."}
                />
                {/* What happens if plans change or the appointment cannot be confirmed. The cancellation window is the
                    server's (GET /telemedicine/policy), never typed here; the second sentence promises review and
                    contact, not money back, exactly as the notification a client would receive does. */}
                <p className="text-xs text-slate-600">
                  {(policyQuery.data?.cancellationCutoffMinutes ?? 0) > 0
                    ? `You can cancel until ${policyQuery.data?.cancellationCutoffMinutes} minutes before your appointment. `
                    : ""}
                  If we cannot confirm your appointment after you pay, we review the payment and contact you.
                </p>
                {paymentInFlight && (
                  <p role="status" className="text-sm text-slate-600">
                    Preparing payment...
                  </p>
                )}
                {!paymentInitiated ? (
                  <Button
                    type="button"
                    loading={paymentInFlight}
                    disabled={paymentInFlight}
                    onClick={handlePay}
                  >
                    Confirm &amp; pay
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">Waiting for M-Pesa confirmation...</p>
                    <MpesaPaymentInstructions
                      amountCents={selectedFacility.priceCents}
                      accountNumber={(hold?.bookingId ? bookingReference(hold.bookingId) : "TELEMED")}
                    />
                  </div>
                )}
                {submitError && <ApiErrorBanner category={submitError.category} message={submitError.message} />}
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
                <Button type="button" variant="secondary" onClick={resetToStart} disabled={paymentInitiated}>
                  Back
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
};

export default TelemedicineRequestDialog;
