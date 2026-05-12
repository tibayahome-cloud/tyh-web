import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { Loader2, MapPin, User, Phone, Search } from "lucide-react";

import { api } from "../../../shared/libs/api";
import { Input } from "../../../shared/components/Input";
import { FormField } from "../../../shared/components/FormField";
import { Button } from "../../../shared/components/Button";
import { LocationPickerMap } from "../../../shared/components/LocationPickerMap";
import { useToast } from "../../../shared/components/ToastProvider";

type AdminCreateBookingDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (bookingId: string) => void;
};

type ServiceOption = {
  id: string;
  name: string;
  key: string;
};

type UserSearchResult = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
};

const bookingSchema = z.object({
  clientMode: z.enum(["existing", "new"]),
  clientUserId: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  serviceId: z.string().min(1, "Select a service"),
  addressText: z.string().min(3, "Address is required"),
  lat: z.number().optional(),
  lng: z.number().optional(),
}).refine((data) => {
  if (data.clientMode === "existing") {
    return !!data.clientUserId;
  }
  return !!data.clientPhone && !!data.clientName;
}, {
  message: "Client details are required",
  path: ["clientUserId"]
});

type BookingFormValues = z.infer<typeof bookingSchema>;

const DEFAULT_VALUES: Partial<BookingFormValues> = {
  clientMode: "new",
  clientUserId: "",
  clientName: "",
  clientPhone: "",
  serviceId: "",
  addressText: "",
};

export const AdminCreateBookingDialog = ({
  open,
  onClose,
  onSuccess,
}: AdminCreateBookingDialogProps) => {
  const toast = useToast();
  const [showMap, setShowMap] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const clientMode = watch("clientMode");
  const lat = watch("lat");
  const lng = watch("lng");
  const hasLocation = typeof lat === "number" && typeof lng === "number";

  const servicesQuery = useQuery({
    queryKey: ["admin", "services", "active"],
    queryFn: async () => {
      const res = await api.get<{ data: ServiceOption[] }>("/services", {
        params: { "filter[active]": "true" }
      });
      return res.data.data;
    },
    enabled: open,
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", "search", userSearch],
    queryFn: async () => {
      const res = await api.get<{ data: UserSearchResult[] }>("/users", {
        params: { "filter[search]": userSearch, "page[size]": 10 }
      });
      return res.data.data;
    },
    enabled: open && clientMode === "existing" && userSearch.length >= 2,
  });

  const createBooking = useMutation({
    mutationFn: async (values: BookingFormValues) => {
      const payload: Record<string, unknown> = {
        service_id: values.serviceId,
        address_text: values.addressText,
        lat: values.lat,
        lng: values.lng,
      };

      if (values.clientMode === "existing" && values.clientUserId) {
        payload.client_user_id = values.clientUserId;
      } else {
        payload.client_phone = values.clientPhone;
        payload.client_name = values.clientName;
      }

      const res = await api.post<{ data: { id: string } }>("/bookings/admin", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success("Booking created successfully");
      onSuccess?.(data.id);
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create booking");
    },
  });

  const handleLocationSelect = (location: { lat: number; lng: number; address?: string }) => {
    setValue("lat", location.lat);
    setValue("lng", location.lng);
    if (location.address) {
      setValue("addressText", location.address);
    }
    setShowMap(false);
  };

  const handleUserSelect = (user: UserSearchResult) => {
    setSelectedUser(user);
    setValue("clientUserId", user.id);
    setUserSearch("");
  };

  const onSubmit = handleSubmit((values) => {
    createBooking.mutate(values);
  });

  const handleClose = () => {
    reset(DEFAULT_VALUES);
    setSelectedUser(null);
    setUserSearch("");
    setShowMap(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Create Booking for Client</DialogTitle>
      <DialogContent dividers>
        {showMap ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Tap to set client location</p>
            <div className="h-80 rounded-xl overflow-hidden border">
              <LocationPickerMap
                onLocationSelect={handleLocationSelect}
                initialLocation={hasLocation ? { lat, lng } : undefined}
              />
            </div>
            <Button variant="outline" onClick={() => setShowMap(false)} className="w-full">
              Back to form
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5 pt-2">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setValue("clientMode", "new"); setSelectedUser(null); }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                  clientMode === "new"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                New Client
              </button>
              <button
                type="button"
                onClick={() => setValue("clientMode", "existing")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                  clientMode === "existing"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Existing Client
              </button>
            </div>

            {clientMode === "new" ? (
              <>
                <FormField
                  control={control}
                  name="clientName"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="Client Name"
                      placeholder="Jane Doe"
                      error={fieldState.error?.message}
                      icon={<User className="w-4 h-4 text-slate-400" />}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name="clientPhone"
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      label="Client Phone"
                      placeholder="+254 712 345 678"
                      type="tel"
                      error={fieldState.error?.message}
                      icon={<Phone className="w-4 h-4 text-slate-400" />}
                    />
                  )}
                />
              </>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Search Client</label>
                <div className="relative">
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name, phone, or email..."
                    icon={<Search className="w-4 h-4 text-slate-400" />}
                  />
                  {usersQuery.data && usersQuery.data.length > 0 && userSearch.length >= 2 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {usersQuery.data.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleUserSelect(user)}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 border-b last:border-b-0"
                        >
                          <p className="font-medium text-slate-900">{user.full_name}</p>
                          <p className="text-sm text-slate-500">{user.phone || user.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedUser && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="font-medium text-blue-900">{selectedUser.full_name}</p>
                    <p className="text-sm text-blue-700">{selectedUser.phone || selectedUser.email}</p>
                  </div>
                )}
                {errors.clientUserId && (
                  <p className="text-sm text-red-600">{errors.clientUserId.message}</p>
                )}
              </div>
            )}

            <FormField
              control={control}
              name="serviceId"
              render={({ field, fieldState }) => (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Service</label>
                  <select
                    {...field}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a service</option>
                    {servicesQuery.data?.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                  {fieldState.error && (
                    <p className="text-sm text-red-600 mt-1">{fieldState.error.message}</p>
                  )}
                </div>
              )}
            />

            <div>
              <FormField
                control={control}
                name="addressText"
                render={({ field, fieldState }) => (
                  <Input
                    {...field}
                    label="Service Address"
                    placeholder="e.g., Westlands, Nairobi"
                    error={fieldState.error?.message}
                    icon={<MapPin className="w-4 h-4 text-slate-400" />}
                  />
                )}
              />
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" />
                {hasLocation ? "Change location on map" : "Pick location on map"}
              </button>
              {hasLocation && (
                <p className="text-xs text-slate-500 mt-1">
                  GPS: {lat?.toFixed(4)}, {lng?.toFixed(4)}
                </p>
              )}
            </div>

            {createBooking.error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-sm text-red-700">
                  {(createBooking.error as Error).message || "Failed to create booking"}
                </p>
              </div>
            )}
          </form>
        )}
      </DialogContent>
      {!showMap && (
        <DialogActions>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={createBooking.isPending}
          >
            {createBooking.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create Booking"
            )}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
