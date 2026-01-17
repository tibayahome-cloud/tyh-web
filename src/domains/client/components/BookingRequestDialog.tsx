import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";

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
    description: "Choose the care you need"
  },
  {
    title: "Location",
    description: "Pin your address & notes"
  },
  {
    title: "Confirm",
    description: "Review duration & submit"
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
  const [currentStep, setCurrentStep] = useState(derivedStep);
  useEffect(() => {
    setCurrentStep(derivedStep);
  }, [derivedStep]);
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
      title="New booking request"
      description="Tell us what you need and drop your location—we'll take care of matching."
      maxWidth="md"
    >
      {loadingServices ? (
        <div className="py-6">
          <Loading label="Loading services..." />
        </div>
      ) : (
        <form className="py-1" onSubmit={onSubmit} noValidate>
          <div className="space-y-4">
            <Stepper steps={BOOKING_STEPS} current={currentStep} />

            <section className="space-y-3 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-card sm:rounded-3xl sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-500 sm:text-xs sm:tracking-[0.3em]">Step 1 · Service</p>
                  <p className="text-xs text-neutral-500 sm:text-sm">Pick the care type you need.</p>
                </div>
              </div>
              <FormField
                control={control}
                name="serviceId"
                render={({ field, fieldState }) => (
                  <label className="flex w-full flex-col gap-2 text-sm font-semibold text-neutral-700">
                    <span>Service</span>
                    <select
                      {...field}
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-inner transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    >
                      <option value="">Select a service</option>
                      {(services ?? []).map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                    {fieldState.error && <span className="text-xs text-danger-600">{fieldState.error.message}</span>}
                  </label>
                )}
              />
              {selectedService && (
                <div className="rounded-2xl border border-white/60 bg-brand-50/60 p-4 text-sm text-neutral-600">
                  <p className="text-base font-semibold text-neutral-900">{selectedService.name}</p>
                  <p className="text-xs text-neutral-500">
                    {selectedService.description ?? "No additional description available."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] uppercase tracking-wide text-brand-600">
                    <span>{formatCurrency(selectedService.base_price_cents)}</span>
                    <span>{selectedService.default_estimate_minutes} mins</span>
                    {selectedService.is_emergency_capable && (
                      <span className="text-emerald-600">Emergency ready</span>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-card sm:space-y-4 sm:rounded-3xl sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-500 sm:text-xs sm:tracking-[0.3em]">Step 2 · Location</p>
                  <p className="text-xs text-neutral-500 sm:text-sm">
                    Drop pin and add directions.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={handleUseCurrentLocation} loading={geoLoading}>
                    Current location
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleClearLocation} disabled={!mapLocation}>
                    Clear
                  </Button>
                </div>
              </div>
              <FormField
                control={control}
                name="addressText"
                render={({ field, fieldState }) => (
                  <label className="flex w-full flex-col gap-2 text-sm font-semibold text-neutral-700">
                    <span>Directions & notes</span>
                    <textarea
                      {...field}
                      rows={3}
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-inner transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                      placeholder="Estate, apartment, gate code, preferred contact..."
                    />
                    {fieldState.error && <span className="text-xs text-danger-600">{fieldState.error.message}</span>}
                  </label>
                )}
              />
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={control}
                  name="homeAddress"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="Home or estate address"
                      placeholder="E.g. Riverside Estate, Block A"
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name="houseNumber"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="House number"
                      placeholder="e.g. 12B"
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name="apartment"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="House/Apartment"
                      placeholder="Apartment name, floor, etc."
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </div>
              <LocationPickerMap value={mapLocation ?? undefined} onChange={handleMapSelect} onAddressChange={handleAddressResolved} />
              <div className="text-xs text-neutral-500">
                Source: <span className="font-semibold text-neutral-800">{LOCATION_SOURCE_LABEL[locationSource]}</span>
              </div>
              {recentLocations.length > 0 && (
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent locations</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {recentLocations.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleApplyRecent(loc)}
                        className="flex min-w-[160px] flex-col rounded-xl border border-white/80 bg-white px-3 py-2 text-left text-xs text-neutral-600 transition hover:border-brand-200"
                      >
                        <span className="font-semibold text-neutral-900">{loc.label}</span>
                        <span className="text-[11px] text-neutral-500">
                          {loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-3xl border border-white/70 bg-white/90 p-5 shadow-card">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name="lat"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="Latitude"
                      placeholder="-1.2854"
                      error={fieldState.error?.message}
                      inputMode="decimal"
                      onChange={(event) => {
                        setLocationSource("manual");
                        field.onChange(event);
                      }}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name="lng"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="Longitude"
                      placeholder="36.8219"
                      error={fieldState.error?.message}
                      inputMode="decimal"
                      onChange={(event) => {
                        setLocationSource("manual");
                        field.onChange(event);
                      }}
                    />
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name="estimateDurationMinutes"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="Estimated duration (minutes)"
                      placeholder={selectedService?.default_estimate_minutes?.toString() ?? "e.g. 60"}
                      inputMode="numeric"
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name="emergency"
                  render={({ field }) => (
                    <label className="flex h-full items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                        checked={Boolean(field.value)}
                        onChange={(event) => field.onChange(event.target.checked)}
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-900">Emergency-capable only</span>
                        <span className="text-xs text-neutral-500">
                          We'll prioritize teams flagged for rapid response.
                        </span>
                      </div>
                    </label>
                  )}
                />
              </div>

              {/* Scheduling Section */}
              <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 space-y-3">
                <FormField
                  control={control}
                  name="scheduleForLater"
                  render={({ field }) => (
                    <label className="flex items-center gap-3 text-sm text-neutral-700 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-violet-600 focus:ring-violet-500"
                        checked={Boolean(field.value)}
                        onChange={(event) => field.onChange(event.target.checked)}
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-900">Schedule for later</span>
                        <span className="text-xs text-neutral-500">
                          Book in advance instead of requesting a provider now.
                        </span>
                      </div>
                    </label>
                  )}
                />

                {watch("scheduleForLater") && (
                  <FormField
                    control={control}
                    name="scheduledAt"
                    render={({ field, fieldState }) => (
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-neutral-700">
                          When do you need the service?
                        </label>
                        <input
                          type="datetime-local"
                          name={field.name}
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          min={new Date().toISOString().slice(0, 16)}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-inner transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        />
                        {fieldState.error && (
                          <span className="text-xs text-danger-600">{fieldState.error.message}</span>
                        )}
                      </div>
                    )}
                  />
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">Review</p>
                  <p className="text-sm text-neutral-500">Double-check the summary before sending.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-pill bg-brand-50 px-3 py-1 text-brand-600">
                    {selectedService?.name ?? "Select service"}
                  </span>
                  {derivedEstimateMinutes && (
                    <span className="rounded-pill bg-neutral-100 px-3 py-1 text-neutral-600">
                      ~{derivedEstimateMinutes} mins
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-4 text-sm text-neutral-600 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Estimated total</p>
                  <p className="text-base font-semibold text-neutral-900">
                    {derivedPriceCents ? formatCurrency(derivedPriceCents) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Location</p>
                  <p className="font-semibold text-neutral-900 line-clamp-2">{locationSummaryLabel}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Status</p>
                  <p className="font-semibold text-neutral-900">
                    {locationComplete ? "Ready to submit" : "Add location details"}
                  </p>
                </div>
              </div>
            </section>

            {(submitError || errors.root?.message) && (
              <p className="text-sm text-danger-600">{submitError ?? errors.root?.message}</p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="ghost" onClick={closeAndReset} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || createBooking.isPending}>
                Send booking request
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default BookingRequestDialog;
