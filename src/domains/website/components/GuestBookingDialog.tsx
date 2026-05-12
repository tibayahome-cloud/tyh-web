import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { X, MapPin, User, Phone, CheckCircle2, Loader2 } from "lucide-react";

import { api } from "../../../shared/libs/api";
import { Input } from "../../../shared/components/Input";
import { FormField } from "../../../shared/components/FormField";
import { Button } from "../../../shared/components/Button";
import { LocationPickerMap } from "../../../shared/components/LocationPickerMap";

type GuestBookingDialogProps = {
  open: boolean;
  onClose: () => void;
  serviceKey: string;
  serviceName: string;
};

const guestBookingSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?[0-9\s-]+$/, "Enter a valid phone number"),
  addressText: z.string().min(5, "Please enter your address"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

type GuestBookingFormValues = z.infer<typeof guestBookingSchema>;

const DEFAULT_VALUES: Partial<GuestBookingFormValues> = {
  fullName: "",
  phone: "",
  addressText: "",
};

type BookingResponse = {
  data: {
    id: string;
    status: string;
  };
  meta: {
    guest_user_created: boolean;
  };
};

export const GuestBookingDialog = ({
  open,
  onClose,
  serviceKey,
  serviceName,
}: GuestBookingDialogProps) => {
  const [step, setStep] = useState<"form" | "location" | "success">("form");
  const [bookingId, setBookingId] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<GuestBookingFormValues>({
    resolver: zodResolver(guestBookingSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const lat = watch("lat");
  const lng = watch("lng");
  const hasLocation = typeof lat === "number" && typeof lng === "number";

  const createGuestBooking = useMutation({
    mutationFn: async (values: GuestBookingFormValues) => {
      const response = await api.post<BookingResponse>("/bookings/guest", {
        phone: values.phone.trim(),
        full_name: values.fullName.trim(),
        service_key: serviceKey,
        address_text: values.addressText,
        lat: values.lat,
        lng: values.lng,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setBookingId(data.data.id);
      setStep("success");
    },
  });

  const handleLocationSelect = (location: { lat: number; lng: number; address?: string }) => {
    setValue("lat", location.lat);
    setValue("lng", location.lng);
    if (location.address) {
      setValue("addressText", location.address);
    }
    setStep("form");
  };

  const onSubmit = handleSubmit((values) => {
    createGuestBooking.mutate(values);
  });

  const handleClose = () => {
    reset(DEFAULT_VALUES);
    setStep("form");
    setBookingId(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-slate-900">
            {step === "success" ? "Booking Confirmed" : `Book ${serviceName}`}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {step === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Booking Created!</h3>
              <p className="text-slate-600 mb-4">
                We're finding a provider for you. You'll receive an SMS confirmation shortly.
              </p>
              {bookingId && (
                <p className="text-sm text-slate-500">
                  Booking ID: <span className="font-mono">{bookingId.slice(0, 8)}</span>
                </p>
              )}
              <Button onClick={handleClose} className="mt-6">
                Done
              </Button>
            </div>
          )}

          {step === "location" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Tap on the map to set your location, or use GPS.
              </p>
              <div className="h-80 rounded-xl overflow-hidden border border-slate-200">
                <LocationPickerMap
                  onLocationSelect={handleLocationSelect}
                  initialLocation={hasLocation ? { lat, lng } : undefined}
                />
              </div>
              <Button variant="outline" onClick={() => setStep("form")} className="w-full">
                Back to form
              </Button>
            </div>
          )}

          {step === "form" && (
            <form onSubmit={onSubmit} className="space-y-5">
              <p className="text-sm text-slate-600 mb-4">
                Book without creating an account. We'll send booking updates to your phone.
              </p>

              <FormField
                control={control}
                name="fullName"
                render={({ field, fieldState }) => (
                  <Input
                    {...field}
                    label="Your Name"
                    placeholder="Jane Doe"
                    error={fieldState.error?.message}
                    icon={<User className="w-4 h-4 text-slate-400" />}
                  />
                )}
              />

              <FormField
                control={control}
                name="phone"
                render={({ field, fieldState }) => (
                  <Input
                    {...field}
                    label="Phone Number"
                    placeholder="+254 712 345 678"
                    type="tel"
                    error={fieldState.error?.message}
                    icon={<Phone className="w-4 h-4 text-slate-400" />}
                  />
                )}
              />

              <div>
                <FormField
                  control={control}
                  name="addressText"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="Address"
                      placeholder="e.g., Westlands, Nairobi"
                      error={fieldState.error?.message}
                      icon={<MapPin className="w-4 h-4 text-slate-400" />}
                    />
                  )}
                />
                <button
                  type="button"
                  onClick={() => setStep("location")}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" />
                  {hasLocation ? "Change location on map" : "Pick location on map"}
                </button>
                {hasLocation && (
                  <p className="text-xs text-slate-500 mt-1">
                    Location: {lat.toFixed(4)}, {lng.toFixed(4)}
                  </p>
                )}
              </div>

              {!hasLocation && errors.lat && (
                <p className="text-sm text-red-600">Please select your location on the map</p>
              )}

              {createGuestBooking.error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-sm text-red-700">
                    {(createGuestBooking.error as Error).message || "Failed to create booking"}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={createGuestBooking.isPending || !hasLocation}
                className="w-full"
              >
                {createGuestBooking.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating booking...
                  </>
                ) : (
                  "Book Now"
                )}
              </Button>

              <p className="text-xs text-center text-slate-500">
                By booking, you agree to our terms of service. Already have an account?{" "}
                <a href="/login" className="text-blue-600 hover:underline">
                  Sign in
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
