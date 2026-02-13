import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Heart,
  Baby,
  Activity as VitalsIcon,
  Search,
  Crosshair
} from "lucide-react";

import { Modal } from "../../../shared/components/Modal";
import { Button } from "../../../shared/components/Button";
import { Input } from "../../../shared/components/Input";
import { FormField } from "../../../shared/components/FormField";
import { useCreateBookingMutation } from "../../../shared/hooks/useBookings";
import { useToast } from "../../../shared/components/ToastProvider";
import { Loading } from "../../../shared/components/Loading";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, svcCard } from "../../../shared/libs/fieldInclude";
import { LocationPickerMap } from "../../../shared/components/LocationPickerMap";
import { loadRecentLocations, saveRecentLocation, type StoredLocation } from "../../../shared/utils/recentLocations";
import { Stepper } from "../../../shared/components/Stepper";
import { formatDecimalLocation } from "../../../shared/utils/location";
import { SlideToBook } from "../../../shared/components/SlideToBook";

type BookingRequestDialogProps = {
  open: boolean;
  onClose: () => void;
  serviceId?: string | null;
  onCreated?: (bookingId: string) => void;
};

type ServiceOption = {
  id: string;
  name: string;
  description?: string | null;
  base_price_cents: number;
  default_estimate_minutes: number;
  is_emergency_capable: boolean;
  active?: boolean;
};

type LocationSource = "none" | "map" | "current" | "saved" | "manual";

const LOCATION_SOURCE_LABEL: Record<LocationSource, string> = {
  none: "Not set",
  map: "Map pin",
  current: "Live location",
  saved: "Recent location",
  manual: "Manual coordinates"
};

const BOOKING_STEPS = [
  {
    title: "Service",
    description: "What do you need?"
  },
  {
    title: "Location",
    description: "Where are you?"
  },
  {
    title: "Timing",
    description: "Now or later?"
  },
  {
    title: "Confirm",
    description: "Review & book"
  }
];

const coordinateRegex =
  /^\s*(-?\d+(?:\.\d+)?)\s*(?:,|\s)\s*(-?\d+(?:\.\d+)?)/;

const bookingRequestSchema = z.object({
  serviceId: z.string().min(1, "Select a service to continue"),
  addressText: z.string().optional(),
  homeAddress: z.string().optional(),
  houseNumber: z.string().optional(),
  apartment: z.string().optional(),
  estimateDurationMinutes: z.string().optional(),
  lat: z
    .string()
    .min(1, "Location required")
    .refine((value) => !Number.isNaN(Number(value)), "Latitude must be numeric"),
  lng: z
    .string()
    .min(1, "Location required")
    .refine((value) => !Number.isNaN(Number(value)), "Longitude must be numeric"),
  emergency: z.boolean().optional(),
  scheduleForLater: z.boolean().optional(),
  scheduledAt: z.string().optional()
});

type BookingRequestFormValues = z.infer<typeof bookingRequestSchema>;

const DEFAULT_VALUES: BookingRequestFormValues = {
  serviceId: "",
  addressText: "",
  homeAddress: "",
  houseNumber: "",
  apartment: "",
  estimateDurationMinutes: "",
  lat: "",
  lng: "",
  emergency: false,
  scheduleForLater: false,
  scheduledAt: ""
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "KES" }).format(value / 100);

const useServiceOptions = (enabled: boolean) =>
  useQuery({
    queryKey: ["client", "services", "booking-form"],
    queryFn: async () => {
      const response = await api.get<{ data: ServiceOption[] }>("/services", {
        params: buildFieldParams(svcCard)
      });
      return response.data.data.filter((service) => service.active ?? true);
    },
    enabled
  });

const toLatLng = (lat?: string | null, lng?: string | null) => {
  const latNum = lat ? Number(lat) : Number.NaN;
  const lngNum = lng ? Number(lng) : Number.NaN;
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    return null;
  }
  return { lat: latNum, lng: lngNum };
};

export const BookingRequestDialog = ({ open, onClose, serviceId, onCreated }: BookingRequestDialogProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: services, isLoading: loadingServices } = useServiceOptions(open);
  const { showToast } = useToast();
  const createBooking = useCreateBookingMutation("detail");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
    getValues
  } = useForm<BookingRequestFormValues>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: DEFAULT_VALUES
  });
  const [geoLoading, setGeoLoading] = useState(false);
  const [recentLocations, setRecentLocations] = useState<StoredLocation[]>([]);
  const [locationSource, setLocationSource] = useState<LocationSource>("none");

  const selectedServiceId = watch("serviceId");
  const latField = watch("lat");
  const lngField = watch("lng");
  const addressField = watch("addressText");
  const homeAddressField = watch("homeAddress");
  const houseNumberField = watch("houseNumber");
  const apartmentField = watch("apartment");
  const estimateField = watch("estimateDurationMinutes");
  const mapLocation = useMemo(() => toLatLng(latField, lngField), [latField, lngField]);
  const selectedService = useMemo(
    () => (services ?? []).find((service) => service.id === selectedServiceId),
    [services, selectedServiceId]
  );
  const locationComplete = useMemo(() => {
    const hasText =
      (homeAddressField?.trim().length ?? 0) > 0 ||
      (addressField?.trim().length ?? 0) > 0 ||
      (houseNumberField?.trim().length ?? 0) > 0 ||
      (apartmentField?.trim().length ?? 0) > 0;
    return Boolean(mapLocation && hasText);
  }, [mapLocation, homeAddressField, addressField, houseNumberField, apartmentField]);
  const derivedStep = useMemo(() => {
    if (!selectedService) {
      return 0;
    }
    if (!locationComplete) {
      return 1;
    }
    return 2;
  }, [selectedService, locationComplete]);
  const [currentStep, setCurrentStep] = useState(0);
  const derivedEstimateMinutes = useMemo(() => {
    if (estimateField && estimateField.trim().length) {
      const value = Number(estimateField);
      return Number.isNaN(value) ? null : value;
    }
    return selectedService?.default_estimate_minutes ?? null;
  }, [estimateField, selectedService?.default_estimate_minutes]);
  const derivedPriceCents = selectedService?.base_price_cents ?? null;
  const locationSummaryLabel = useMemo(() => {
    const summaryParts: string[] = [];
    if (homeAddressField?.trim()) {
      summaryParts.push(homeAddressField.trim());
    }
    if (houseNumberField?.trim()) {
      summaryParts.push(`House ${houseNumberField.trim()}`);
    }
    if (apartmentField?.trim()) {
      summaryParts.push(`Unit ${apartmentField.trim()}`);
    }
    if (addressField?.trim()) {
      summaryParts.push(addressField.trim());
    }
    if (summaryParts.length) {
      return summaryParts.join(" • ");
    }
    if (mapLocation) {
      return formatDecimalLocation(mapLocation.lat, mapLocation.lng);
    }
    return "Add detailed directions for your provider";
  }, [homeAddressField, houseNumberField, apartmentField, addressField, mapLocation]);
  const defaultLocationAppliedRef = useRef(false);
  const lastParsedAddressRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      reset({
        ...DEFAULT_VALUES,
        serviceId: serviceId ?? ""
      });
      setLocationSource("none");
      setRecentLocations(loadRecentLocations());
      setSubmitError(null);
      defaultLocationAppliedRef.current = false;
    }
  }, [open, reset, serviceId]);

  useEffect(() => {
    if (serviceId) {
      setValue("serviceId", serviceId);
    }
  }, [serviceId, setValue]);

  const applyLocation = useCallback(
    (coords: { lat: number; lng: number }, source: LocationSource) => {
      setValue("lat", coords.lat.toFixed(6), { shouldDirty: true, shouldTouch: true });
      setValue("lng", coords.lng.toFixed(6), { shouldDirty: true, shouldTouch: true });
      setLocationSource(source);
      const currentAddress = getValues("addressText");

      // Update address text if it's empty OR if it currently looks like a coordinate pair
      // This prevents "mismatches" where the text shows old coordinates while the map shows new ones
      const shouldUpdateAddress = !currentAddress || !currentAddress.trim() || coordinateRegex.test(currentAddress);

      if (shouldUpdateAddress) {
        setValue("addressText", `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`, {
          shouldDirty: true,
          shouldTouch: true
        });
      }
    },
    [getValues, setValue]
  );

  const handleMapSelect = (coords: { lat: number; lng: number }) => applyLocation(coords, "map");

  const handleAddressResolved = useCallback(
    (address: string) => {
      // Update home address field with resolved address
      const currentHomeAddress = getValues("homeAddress");
      if (!currentHomeAddress || !currentHomeAddress.trim()) {
        setValue("homeAddress", address, { shouldDirty: true, shouldTouch: true });
      }
    },
    [getValues, setValue]
  );

  const handleApplyRecent = (entry: StoredLocation) =>
    applyLocation(
      {
        lat: entry.lat,
        lng: entry.lng
      },
      "saved"
    );

  const handleClearLocation = () => {
    setValue("lat", "", { shouldDirty: true, shouldTouch: true });
    setValue("lng", "", { shouldDirty: true, shouldTouch: true });

    // Also clear address text if it looks like a raw coordinate pair
    const currentAddress = getValues("addressText");
    if (currentAddress && coordinateRegex.test(currentAddress)) {
      setValue("addressText", "", { shouldDirty: true, shouldTouch: true });
    }

    setLocationSource("none");
  };

  const handleUseCurrentLocation = () => {
    if (geoLoading) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      showToast({
        title: "Location unsupported",
        description: "Your device does not expose geolocation. Drop a pin on the map instead.",
        variant: "error"
      });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6))
        };
        applyLocation(coords, "current");
        setGeoLoading(false);
        showToast({
          title: "Location captured",
          description: "We are using your live location for this booking.",
          variant: "success"
        });
      },
      (error) => {
        setGeoLoading(false);
        const message = error.message || "We could not read your location. Allow permissions and try again.";
        setSubmitError(message);
        showToast({
          title: "Location unavailable",
          description: message,
          variant: "error"
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (!open || defaultLocationAppliedRef.current || mapLocation) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    defaultLocationAppliedRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyLocation(
          {
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6))
          },
          "current"
        );
      },
      () => {
        defaultLocationAppliedRef.current = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  }, [applyLocation, mapLocation, open]);

  useEffect(() => {
    if (!addressField || addressField === lastParsedAddressRef.current) {
      return;
    }
    const match = addressField.match(coordinateRegex);
    if (!match) {
      lastParsedAddressRef.current = null;
      return;
    }
    const [, latRaw, lngRaw] = match;
    const latParsed = Number(latRaw);
    const lngParsed = Number(lngRaw);
    if (Number.isNaN(latParsed) || Number.isNaN(lngParsed)) {
      return;
    }
    const latString = latParsed.toFixed(6);
    const lngString = lngParsed.toFixed(6);
    if (getValues("lat") === latString && getValues("lng") === lngString) {
      lastParsedAddressRef.current = addressField;
      return;
    }
    setValue("lat", latString, { shouldDirty: true, shouldTouch: true });
    setValue("lng", lngString, { shouldDirty: true, shouldTouch: true });
    setLocationSource("manual");
    lastParsedAddressRef.current = addressField;
  }, [addressField, getValues, setValue]);

  const closeAndReset = () => {
    reset(DEFAULT_VALUES);
    setLocationSource("none");
    setSubmitError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const estimate =
      values.estimateDurationMinutes && values.estimateDurationMinutes.trim().length
        ? Number(values.estimateDurationMinutes)
        : undefined;
    if (estimate !== undefined && (Number.isNaN(estimate) || estimate <= 0)) {
      setSubmitError("Estimated duration must be a positive number of minutes.");
      return;
    }
    const lat = Number(values.lat);
    const lng = Number(values.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setSubmitError("Select a valid location before submitting.");
      return;
    }
    const trimmedAddress = values.addressText?.trim();

    // Validate scheduled time if scheduling for later
    let scheduledAt: string | undefined;
    if (values.scheduleForLater && values.scheduledAt) {
      const scheduledDate = new Date(values.scheduledAt);
      if (scheduledDate <= new Date()) {
        setSubmitError("Scheduled time must be in the future.");
        return;
      }
      scheduledAt = scheduledDate.toISOString();
    }

    try {
      const result = await createBooking.mutateAsync({
        serviceId: values.serviceId,
        addressText: trimmedAddress && trimmedAddress.length ? trimmedAddress : undefined,
        locationDetails: (() => {
          const details: Record<string, string> = {};
          if (values.homeAddress?.trim()) {
            details.home_address = values.homeAddress.trim();
          }
          if (values.houseNumber?.trim()) {
            details.house_number = values.houseNumber.trim();
          }
          if (values.apartment?.trim()) {
            details.apartment = values.apartment.trim();
          }
          return Object.keys(details).length ? details : undefined;
        })(),
        estimateDurationMinutes: estimate,
        lat,
        lng,
        emergency: values.emergency ?? false,
        scheduledAt
      });
      const locationHistoryLabel =
        locationSummaryLabel === "Add detailed directions for your provider"
          ? `Pin at ${formatDecimalLocation(lat, lng)}`
          : locationSummaryLabel;
      setRecentLocations(saveRecentLocation({ lat, lng, addressText: locationHistoryLabel }));
      showToast({
        title: scheduledAt ? "Booking scheduled" : "Booking created",
        description: scheduledAt
          ? "Your booking has been scheduled for the selected time."
          : "We are finding the best provider for you.",
        variant: "success"
      });
      if (onCreated) {
        onCreated(result.booking.id);
      }
      closeAndReset();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not create the booking. Please try again.";
      setSubmitError(message);
      showToast({
        title: "Booking failed",
        description: message,
        variant: "error"
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={closeAndReset}
      title="Create Booking"
      description="Tell us what you need and we'll match you with a provider."
      maxWidth="md"
    >
      {loadingServices ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loading label="Fetching care services..." />
        </div>
      ) : (
        <form className="relative overflow-hidden" onSubmit={onSubmit} noValidate>
          <div className="mb-6">
            <Stepper steps={BOOKING_STEPS} current={currentStep} />
          </div>

          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              {/* STEP 1: SERVICE SELECTION */}
              {currentStep === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {(services ?? []).map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          setValue("serviceId", service.id);
                          setCurrentStep(1);
                        }}
                        className={classNames(
                          "group relative flex flex-col rounded-3xl border-2 p-5 text-left transition-all duration-300",
                          selectedServiceId === service.id
                            ? "border-brand-500 bg-brand-50/40 shadow-lg shadow-brand-500/10"
                            : "border-neutral-100 bg-white hover:border-brand-200 hover:shadow-md"
                        )}
                      >
                        <div className={classNames(
                          "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl transition-colors duration-300",
                          selectedServiceId === service.id ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600 group-hover:bg-brand-100"
                        )}>
                          {service.name.toLowerCase().includes("nurse") ? <Stethoscope /> :
                            service.name.toLowerCase().includes("baby") ? <Baby /> :
                              service.name.toLowerCase().includes("heart") ? <Heart /> : <Activity />}
                        </div>
                        <h3 className="text-lg font-bold text-neutral-900">{service.name}</h3>
                        <p className="mt-1 text-xs text-neutral-500 line-clamp-2">
                          {service.description ?? "Reliable professional healthcare at your doorstep."}
                        </p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-sm font-black text-brand-600">{formatCurrency(service.base_price_cents)}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{service.default_estimate_minutes} MINS</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* STEP 2: LOCATION */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="relative overflow-hidden rounded-[32px] border border-neutral-100 shadow-xl">
                    <LocationPickerMap
                      value={mapLocation ?? undefined}
                      onChange={handleMapSelect}
                      onAddressChange={handleAddressResolved}
                    />

                    <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
                      <div className="flex-1 rounded-2xl bg-white/90 p-1 shadow-2xl backdrop-blur-md ring-1 ring-black/5">
                        <div className="flex items-center px-3">
                          <Search className="h-4 w-4 text-neutral-400" />
                          <input
                            type="text"
                            className="w-full border-none bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-0"
                            placeholder="Find your location..."
                            {...control.register("addressText")}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg active:scale-95 transition-transform"
                      >
                        {geoLoading ? <Loading /> : <Crosshair className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={control}
                      name="homeAddress"
                      render={({ field, fieldState }) => (
                        <Input
                          {...field}
                          label="Address Line"
                          placeholder="Estate, Street name"
                          error={fieldState.error?.message}
                          className="rounded-2xl"
                        />
                      )}
                    />
                    <FormField
                      control={control}
                      name="apartment"
                      render={({ field, fieldState }) => (
                        <Input
                          {...field}
                          label="House / Unit"
                          placeholder="Apt 4B, Floor 2"
                          error={fieldState.error?.message}
                          className="rounded-2xl"
                        />
                      )}
                    />
                  </div>

                  {recentLocations.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Recents</p>
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {recentLocations.slice(0, 3).map((loc) => (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => handleApplyRecent(loc)}
                            className="flex shrink-0 items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-3 text-left transition hover:border-brand-200"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-neutral-900">{loc.label}</p>
                              <p className="text-[10px] text-neutral-400">{loc.lat.toFixed(2)}, {loc.lng.toFixed(2)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Button variant="ghost" type="button" onClick={() => setCurrentStep(0)} className="rounded-2xl">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button
                      variant="primary"
                      type="button"
                      disabled={!locationComplete}
                      onClick={() => setCurrentStep(2)}
                      className="rounded-2xl px-8 shadow-lg shadow-brand-100"
                    >
                      Next Step <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: TIMING */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8 py-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setValue("scheduleForLater", false)}
                      className={classNames(
                        "flex flex-col items-center justify-center rounded-[32px] border-2 p-8 text-center transition-all duration-300",
                        !watch("scheduleForLater")
                          ? "border-brand-500 bg-brand-50/40 shadow-lg shadow-brand-500/10"
                          : "border-neutral-100 bg-white hover:border-brand-200"
                      )}
                    >
                      <div className={classNames(
                        "mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] shadow-sm transition-colors",
                        !watch("scheduleForLater") ? "bg-brand-600 text-white" : "bg-slate-50 text-slate-400"
                      )}>
                        <VitalsIcon className="h-8 w-8" />
                      </div>
                      <h3 className="text-xl font-black text-neutral-900">Request Now</h3>
                      <p className="mt-2 text-xs font-medium text-neutral-500">Immediate response from the nearest available provider.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setValue("scheduleForLater", true)}
                      className={classNames(
                        "flex flex-col items-center justify-center rounded-[32px] border-2 p-8 text-center transition-all duration-300",
                        watch("scheduleForLater")
                          ? "border-violet-500 bg-violet-50/40 shadow-lg shadow-violet-500/10"
                          : "border-neutral-100 bg-white hover:border-violet-200"
                      )}
                    >
                      <div className={classNames(
                        "mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] shadow-sm transition-colors",
                        watch("scheduleForLater") ? "bg-violet-600 text-white" : "bg-slate-50 text-slate-400"
                      )}>
                        <Clock className="h-8 w-8" />
                      </div>
                      <h3 className="text-xl font-black text-neutral-900">Schedule</h3>
                      <p className="mt-2 text-xs font-medium text-neutral-500">Pick a specific time that works best for your routine.</p>
                    </button>
                  </div>

                  {watch("scheduleForLater") && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-[32px] bg-violet-50 p-6"
                    >
                      <FormField
                        control={control}
                        name="scheduledAt"
                        render={({ field, fieldState }) => (
                          <div className="flex flex-col gap-3">
                            <label className="text-sm font-black uppercase tracking-widest text-violet-700">Appointment Date & Time</label>
                            <input
                              type="datetime-local"
                              {...field}
                              min={new Date().toISOString().slice(0, 16)}
                              className="w-full rounded-2xl border-none bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm ring-1 ring-black/5 focus:ring-2 focus:ring-violet-500"
                            />
                            {fieldState.error && (
                              <span className="text-xs font-bold text-danger-600">{fieldState.error.message}</span>
                            )}
                          </div>
                        )}
                      />
                    </motion.div>
                  )}

                  <div className="flex items-center justify-between">
                    <Button variant="ghost" type="button" onClick={() => setCurrentStep(1)} className="rounded-2xl">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button
                      variant="primary"
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="rounded-2xl px-12 shadow-lg shadow-brand-100"
                    >
                      Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: CONFIRMATION */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-8"
                >
                  <div className="relative overflow-hidden rounded-[40px] border border-white/60 bg-white/40 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
                    <div className="relative">
                      <div className="mb-8 flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-black text-slate-900 leading-none">Confirm Booking</h2>
                          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Review Summary</p>
                        </div>
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-linear text-white shadow-lg shadow-brand-100">
                          <CheckCircle2 className="h-7 w-7" />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-brand-600">
                            <ShieldCheck className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Service</p>
                            <p className="text-sm font-bold text-slate-900">{selectedService?.name}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-indigo-600">
                            <MapPin className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</p>
                            <p className="text-sm font-bold text-slate-900 line-clamp-1">{locationSummaryLabel}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-violet-600">
                            <Clock className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Timing</p>
                            <p className="text-sm font-bold text-slate-900">
                              {watch("scheduleForLater") ? `Scheduled: ${new Date(watch("scheduledAt")!).toLocaleString()}` : "Ready for ASAP Dispatch"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-10 border-t border-dashed border-slate-200 pt-6">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Base Estimate</p>
                            <p className="text-3xl font-black text-brand-600 leading-none">{formatCurrency(derivedPriceCents ?? 0)}</p>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 italic mb-1">*Excl. extra consumables</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <SlideToBook
                      onConfirm={onSubmit}
                      isLoading={isSubmitting || createBooking.isPending}
                      label="Slide to Book Now"
                    />

                    <Button
                      variant="ghost"
                      type="button"
                      fullWidth
                      className="rounded-2xl h-12"
                      onClick={() => setCurrentStep(2)}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Change timing
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {submitError && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-center text-sm font-bold text-danger-600"
            >
              {submitError}
            </motion.p>
          )}
        </form>
      )}
    </Modal>
  );
};

export default BookingRequestDialog;
