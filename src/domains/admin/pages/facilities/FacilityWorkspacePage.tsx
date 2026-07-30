import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link, useParams } from "react-router-dom";
import AddIcon from "@mui/icons-material/AddOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBackOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import SaveIcon from "@mui/icons-material/SaveOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOffOutlined";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import { api } from "../../../../shared/libs/api";
import {
  createFacilityService,
  deleteFacilityService,
  assignFacilityBookingProvider,
  fetchFacility,
  fetchFacilityBookings,
  fetchFacilityProviders,
  fetchFacilityServices,
  bootstrapFacilityProvider,
  updateFacility,
  updateFacilityProviderCompensation,
  updateFacilityService
} from "../../../../shared/libs/facilities";
import type {
  FacilityService,
  FacilityServiceInput,
  ProviderCompensation,
  ProviderCompensationMode
} from "../../../../shared/schemas/facility";
import {
  PROVIDER_COMPENSATION_MODES,
  formatOperatingHoursSummary,
  formatProviderCompensation
} from "../../../../shared/schemas/facility";
import type { Provider } from "../../../../shared/schemas/provider";
import type { Booking } from "../../../../shared/schemas/booking";
import { useRbac } from "../../../../shared/hooks/useRbac";

type Envelope<T> = {
  data: T;
};

type CatalogService = {
  id: string;
  key: string;
  name: string;
  base_price_cents: number;
  default_estimate_minutes: number;
  active: boolean;
};

type ServiceFormState = {
  serviceId: string;
  price: string;
  estimateDurationMinutes: string;
  active: boolean;
  isEmergencyCapable: boolean;
};

type ProviderCompensationFormState = {
  userId: string;
  mode: ProviderCompensationMode;
  fixedPayout: string;
  payoutPercentage: string;
};

type AssignmentFormState = {
  providerUserId: string;
  reason: string;
};

const initialServiceForm: ServiceFormState = {
  serviceId: "",
  price: "",
  estimateDurationMinutes: "60",
  active: true,
  isEmergencyCapable: false
};

const initialProviderForm: ProviderCompensationFormState = {
  userId: "",
  mode: "employee",
  fixedPayout: "",
  payoutPercentage: ""
};

export const priceToCents = (value: string): number => Math.round(Number(value) * 100);

const centsToPrice = (value: number): string => String(value / 100);

const formatMoney = (cents: number, currency = "KES") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);

export const formatFacilityResponseCountdown = (dueAt: string | null | undefined, nowMs = Date.now()): string => {
  if (!dueAt) {
    return "-";
  }
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) {
    return "-";
  }
  const remainingSeconds = Math.max(0, Math.ceil((dueMs - nowMs) / 1000));
  if (remainingSeconds === 0) {
    return "Expired";
  }
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

export const facilityResponseCountdownTone = (dueAt: string | null | undefined, nowMs = Date.now()): string => {
  if (!dueAt) {
    return "text-slate-800";
  }
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) {
    return "text-slate-800";
  }
  const remainingMs = dueMs - nowMs;
  if (remainingMs <= 0) {
    return "text-danger-600";
  }
  if (remainingMs <= 60_000) {
    return "text-warning-500";
  }
  return "text-slate-800";
};

const extractErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const data = error.response?.data as { data?: { message?: string }; meta?: { message?: string } } | undefined;
    return data?.meta?.message ?? data?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "Request failed";
};

const validateServiceForm = (form: ServiceFormState): string | null => {
  if (!form.serviceId) {
    return "Select a service.";
  }
  const price = Number(form.price);
  if (!Number.isFinite(price) || price < 0) {
    return "Price must be zero or greater.";
  }
  const duration = Number(form.estimateDurationMinutes);
  if (!Number.isInteger(duration) || duration < 1) {
    return "Duration must be at least 1 minute.";
  }
  return null;
};

export const buildFacilityServiceInput = (form: ServiceFormState): FacilityServiceInput => ({
  serviceId: form.serviceId,
  priceCents: priceToCents(form.price),
  currency: "KES",
  estimateDurationMinutes: Number(form.estimateDurationMinutes),
  active: form.active,
  isEmergencyCapable: form.isEmergencyCapable
});

export const buildProviderCompensationInput = (
  form: ProviderCompensationFormState
): {
  mode: ProviderCompensation["mode"];
  fixedPayoutCents: number | null;
  payoutPercentage: number | null;
} => ({
  mode: form.mode,
  fixedPayoutCents: form.mode === "fixed" ? priceToCents(form.fixedPayout) : null,
  payoutPercentage: form.mode === "percentage" ? Number(form.payoutPercentage) : null
});

const mapServiceForm = (service: FacilityService): ServiceFormState => ({
  serviceId: service.serviceId,
  price: centsToPrice(service.priceCents),
  estimateDurationMinutes: String(service.estimateDurationMinutes ?? 60),
  active: service.active,
  isEmergencyCapable: service.isEmergencyCapable
});

const mapProviderCompensationForm = (provider: Provider): ProviderCompensationFormState => ({
  userId: provider.userId,
  mode: provider.compensation.mode,
  fixedPayout: provider.compensation.fixedPayoutCents == null ? "" : centsToPrice(provider.compensation.fixedPayoutCents),
  payoutPercentage: provider.compensation.payoutPercentage == null ? "" : String(provider.compensation.payoutPercentage)
});

const validateProviderForm = (form: ProviderCompensationFormState): string | null => {
  if (!form.userId.trim()) {
    return "Provider user ID is required.";
  }
  if (form.mode === "fixed") {
    const amount = Number(form.fixedPayout);
    if (!Number.isFinite(amount) || amount < 0) {
      return "Fixed payout must be zero or greater.";
    }
  }
  if (form.mode === "percentage") {
    const percentage = Number(form.payoutPercentage);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      return "Payout percentage must be between 0 and 100.";
    }
  }
  return null;
};

export const filterAssignableProviders = (booking: Booking | null, providers: Provider[]): Provider[] => {
  if (!booking?.service?.id) {
    return providers.filter((provider) => provider.verified);
  }
  return providers.filter((provider) =>
    provider.verified &&
    provider.services.some((service) => service.active && service.serviceId === booking.service?.id)
  );
};

const fetchCatalogServices = async (): Promise<CatalogService[]> => {
  const response = await api.get<Envelope<CatalogService[]>>("/services", {
    params: { "filter[active]": "true" }
  });
  return response.data.data;
};

const providerName = (provider: Provider): string =>
  provider.user?.fullName || provider.user?.email || provider.userId;

const WorkspaceStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
  </div>
);

const ServiceRow = ({
  service,
  onEdit,
  onDisable,
  canManage
}: {
  service: FacilityService;
  onEdit: (service: FacilityService) => void;
  onDisable: (service: FacilityService) => void;
  canManage: boolean;
}) => (
  <article className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-slate-900">{service.service?.name ?? "Service"}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {formatMoney(service.priceCents, service.currency)} • {service.estimateDurationMinutes ?? "-"} min
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {service.active ? "Active" : "Inactive"}
        </span>
        {service.isEmergencyCapable && (
          <span className="rounded-full bg-warning-50 px-2.5 py-1 text-xs font-semibold text-warning-500">
            Emergency
          </span>
        )}
      </div>
    </div>
    {canManage && (
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button size="sm" variant="outline" onClick={() => onEdit(service)}>
          <EditIcon fontSize="small" />
          Edit
        </Button>
        {service.active && (
          <Button size="sm" variant="outline" onClick={() => onDisable(service)}>
            Disable
          </Button>
        )}
      </div>
    )}
  </article>
);

const ProviderRow = ({
  provider,
  onEditCompensation,
  canManage
}: {
  provider: Provider;
  onEditCompensation: (provider: Provider) => void;
  canManage: boolean;
}) => (
  <article className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-slate-900">{providerName(provider)}</h3>
        <p className="mt-1 break-words text-sm text-slate-500">{provider.user?.email ?? provider.userId}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {provider.verified ? "Verified" : "Unverified"}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {provider.isAvailable ? "Available" : "Offline"}
        </span>
      </div>
    </div>
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Compensation</p>
        <p className="mt-1 text-slate-800">{formatProviderCompensation(provider.compensation)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Services</p>
        <p className="mt-1 text-slate-800">{provider.services.filter((service) => service.active).length} active</p>
      </div>
    </div>
    {canManage && (
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => onEditCompensation(provider)}>
          <EditIcon fontSize="small" />
          Compensation
        </Button>
      </div>
    )}
  </article>
);

const FacilityBookingRow = ({
  booking,
  onAssign,
  canAssign,
  nowMs
}: {
  booking: Booking;
  onAssign: (booking: Booking) => void;
  canAssign: boolean;
  nowMs: number;
}) => {
  const countdown = formatFacilityResponseCountdown(booking.facilityResponseDueAt, nowMs);
  const countdownTone = facilityResponseCountdownTone(booking.facilityResponseDueAt, nowMs);
  return (
  <article className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-slate-900">{booking.service?.name ?? "Service request"}</h3>
        <p className="mt-1 text-sm text-slate-500">{booking.client?.fullName ?? "Client"} • {booking.addressText ?? "Location set"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
          {booking.status.replace(/_/g, " ")}
        </span>
        {booking.facilityStatus && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold uppercase text-tiba-blue">
            {booking.facilityStatus}
          </span>
        )}
      </div>
    </div>
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Provider</p>
        <p className="mt-1 text-slate-800">{booking.provider?.fullName ?? "Unassigned"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Response window</p>
        <p className={`mt-1 font-semibold ${countdownTone}`}>
          {countdown}
        </p>
        <p className="text-xs text-slate-500">
          {booking.facilityResponseDueAt ? new Date(booking.facilityResponseDueAt).toLocaleTimeString() : "-"}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Mode</p>
        <p className="mt-1 text-slate-800">{booking.requestMode?.replace(/_/g, " ") ?? "-"}</p>
      </div>
    </div>
    {canAssign && (
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => onAssign(booking)}>
          <EditIcon fontSize="small" />
          {booking.provider ? "Reassign" : "Assign & claim"}
        </Button>
      </div>
    )}
  </article>
  );
};

const FacilityWorkspacePage = () => {
  const { facilityId } = useParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useRbac();
  const canReadFacilities = hasPermission("facility:read");
  const canManageFacility = hasPermission("facility:manage");
  const canManageServices = hasPermission("facility:services.manage");
  const canVerifyProviders = hasPermission("provider:verify");
  const canManageBookings = hasPermission("booking:manage");

  const [financialsVisible, setFinancialsVisible] = useState(true);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<FacilityService | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(initialServiceForm);
  const [serviceFormError, setServiceFormError] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<FacilityService | null>(null);
  const [providerSearch, setProviderSearch] = useState("");
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderCompensationFormState>(initialProviderForm);
  const [providerFormError, setProviderFormError] = useState<string | null>(null);
  const [assignmentBooking, setAssignmentBooking] = useState<Booking | null>(null);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>({ providerUserId: "", reason: "" });
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const facilityQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId],
    queryFn: () => fetchFacility(String(facilityId)),
    enabled: Boolean(facilityId) && canReadFacilities
  });

  const servicesQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "services"],
    queryFn: () => fetchFacilityServices(String(facilityId)),
    enabled: Boolean(facilityId) && canReadFacilities
  });

  const catalogQuery = useQuery({
    queryKey: ["admin", "services", "catalog", "active"],
    queryFn: fetchCatalogServices,
    enabled: canManageServices
  });

  const providersQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "providers", providerSearch],
    queryFn: () =>
      fetchFacilityProviders(String(facilityId), {
        search: providerSearch.trim() || undefined
      }),
    enabled: Boolean(facilityId) && canReadFacilities && canVerifyProviders
  });

  const bookingsQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "bookings", "assignment"],
    queryFn: () =>
      fetchFacilityBookings(String(facilityId), {
        pageSize: 25,
        facilityStatus: "pending,claimed"
      }),
    enabled: Boolean(facilityId) && canReadFacilities && canManageBookings
  });

  const facility = facilityQuery.data;
  const facilityServices = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const providers = useMemo(() => providersQuery.data?.providers ?? [], [providersQuery.data?.providers]);
  const facilityBookings = bookingsQuery.data?.bookings ?? [];
  const assignableProviders = useMemo(
    () => filterAssignableProviders(assignmentBooking, providers),
    [assignmentBooking, providers]
  );

  useEffect(() => {
    if (facility) {
      setFinancialsVisible(facility.providerFinancialsVisible);
    }
  }, [facility]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const availableCatalogServices = useMemo(() => {
    const used = new Set(facilityServices.map((service) => service.serviceId));
    return (catalogQuery.data ?? []).filter((service) => editingService?.serviceId === service.id || !used.has(service.id));
  }, [catalogQuery.data, editingService?.serviceId, facilityServices]);

  const activeServiceCount = facilityServices.filter((service) => service.active).length;

  const invalidateWorkspace = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "facilities", facilityId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "facilities", facilityId, "services"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "facilities", facilityId, "bookings"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "facilities"] });
  };

  const visibilityMutation = useMutation({
    mutationFn: (visible: boolean) => updateFacility(String(facilityId), { providerFinancialsVisible: visible }),
    onSuccess: () => {
      invalidateWorkspace();
      setMutationError(null);
    },
    onError: (error) => {
      setMutationError(extractErrorMessage(error));
    }
  });

  const serviceMutation = useMutation({
    mutationFn: (input: FacilityServiceInput) => {
      if (editingService) {
        return updateFacilityService(String(facilityId), editingService.id, input);
      }
      return createFacilityService(String(facilityId), input);
    },
    onSuccess: () => {
      invalidateWorkspace();
      setServiceModalOpen(false);
      setEditingService(null);
      setServiceForm(initialServiceForm);
      setServiceFormError(null);
    },
    onError: (error) => {
      setServiceFormError(extractErrorMessage(error));
    }
  });

  const disableMutation = useMutation({
    mutationFn: (service: FacilityService) => deleteFacilityService(String(facilityId), service.id),
    onSuccess: () => {
      invalidateWorkspace();
      setPendingDisable(null);
      setMutationError(null);
    },
    onError: (error) => {
      setMutationError(extractErrorMessage(error));
    }
  });

  const providerMutation = useMutation({
    mutationFn: async (form: ProviderCompensationFormState) => {
      const compensation = buildProviderCompensationInput(form);
      if (editingProvider) {
        return updateFacilityProviderCompensation(String(facilityId), editingProvider.userId, compensation);
      }
      const result = await bootstrapFacilityProvider(String(facilityId), form.userId.trim(), { compensation });
      return result.provider;
    },
    onSuccess: () => {
      invalidateWorkspace();
      setProviderModalOpen(false);
      setEditingProvider(null);
      setProviderForm(initialProviderForm);
      setProviderFormError(null);
    },
    onError: (error) => {
      setProviderFormError(extractErrorMessage(error));
    }
  });

  const assignmentMutation = useMutation({
    mutationFn: ({ booking, form }: { booking: Booking; form: AssignmentFormState }) =>
      assignFacilityBookingProvider(String(facilityId), booking.id, {
        providerUserId: form.providerUserId,
        reason: form.reason.trim() || undefined
      }),
    onSuccess: () => {
      invalidateWorkspace();
      setAssignmentBooking(null);
      setAssignmentForm({ providerUserId: "", reason: "" });
      setAssignmentError(null);
    },
    onError: (error) => {
      setAssignmentError(extractErrorMessage(error));
    }
  });

  const openServiceModal = (service?: FacilityService) => {
    setEditingService(service ?? null);
    setServiceForm(service ? mapServiceForm(service) : initialServiceForm);
    setServiceFormError(null);
    setServiceModalOpen(true);
  };

  const updateServiceForm = <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => {
    setServiceForm((current) => ({ ...current, [key]: value }));
  };

  const handleSaveService = () => {
    const validationMessage = validateServiceForm(serviceForm);
    if (validationMessage) {
      setServiceFormError(validationMessage);
      return;
    }
    setServiceFormError(null);
    serviceMutation.mutate(buildFacilityServiceInput(serviceForm));
  };

  const openProviderModal = (provider?: Provider) => {
    setEditingProvider(provider ?? null);
    setProviderForm(provider ? mapProviderCompensationForm(provider) : initialProviderForm);
    setProviderFormError(null);
    setProviderModalOpen(true);
  };

  const updateProviderForm = <K extends keyof ProviderCompensationFormState>(
    key: K,
    value: ProviderCompensationFormState[K]
  ) => {
    setProviderForm((current) => ({ ...current, [key]: value }));
  };

  const handleSaveProvider = () => {
    const validationMessage = validateProviderForm(providerForm);
    if (validationMessage) {
      setProviderFormError(validationMessage);
      return;
    }
    setProviderFormError(null);
    providerMutation.mutate(providerForm);
  };

  const openAssignmentModal = (booking: Booking) => {
    const options = filterAssignableProviders(booking, providers);
    setAssignmentBooking(booking);
    setAssignmentForm({
      providerUserId: options[0]?.userId ?? "",
      reason: booking.provider ? "facility_reassignment" : "facility_assignment"
    });
    setAssignmentError(null);
  };

  if (!canReadFacilities) {
    return (
      <Card>
        <p className="text-sm text-slate-600">You do not have permission to view this facility.</p>
      </Card>
    );
  }

  if (facilityQuery.isLoading) {
    return (
      <Card>
        <Loading />
      </Card>
    );
  }

  if (facilityQuery.isError || !facility) {
    return (
      <Card>
        <p className="text-sm text-danger-600">
          {facilityQuery.isError ? extractErrorMessage(facilityQuery.error) : "Facility not found."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Link to="/admin/facilities" className="inline-flex items-center gap-2 text-sm font-semibold text-tiba-blue">
            <ArrowBackIcon fontSize="small" />
            Facilities
          </Link>
          <h1 className="mt-3 truncate text-xl font-semibold text-slate-900">{facility.name}</h1>
          <p className="text-sm text-slate-500">{facility.address}</p>
        </div>
        <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
          {facility.status}
        </span>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <WorkspaceStat label="County" value={facility.county || "-"} />
        <WorkspaceStat label="Facility type" value={facility.facilityType} />
        <WorkspaceStat label="Active services" value={String(activeServiceCount)} />
        <WorkspaceStat label="TYH fee" value={`${facility.platformFeePercent}%`} />
      </section>

      <Card title="Facility settings">
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Contact</p>
              <p className="mt-1 break-words text-sm text-slate-800">{facility.email}</p>
              <p className="mt-1 text-sm text-slate-600">
                {facility.phones.find((phone) => phone.isPrimary)?.phone ?? facility.phones[0]?.phone ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Operating hours</p>
              <p className="mt-1 text-sm text-slate-800">{formatOperatingHoursSummary(facility.operatingHours)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              {financialsVisible ? (
                <VisibilityIcon className="mt-0.5 text-success-600" />
              ) : (
                <VisibilityOffIcon className="mt-0.5 text-slate-500" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">Provider financial visibility</p>
                <p className="mt-1 text-sm text-slate-500">
                  Controls whether providers can see service price, payment amount, payout, and commission data.
                </p>
              </div>
            </div>
            <label className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
              <span>{financialsVisible ? "Visible" : "Hidden"}</span>
              <input
                type="checkbox"
                checked={financialsVisible}
                onChange={(event) => setFinancialsVisible(event.target.checked)}
                disabled={!canManageFacility || visibilityMutation.isPending}
                className="h-5 w-5 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
              />
            </label>
            {canManageFacility && (
              <Button
                className="mt-4 w-full"
                variant="outline"
                loading={visibilityMutation.isPending}
                disabled={financialsVisible === facility.providerFinancialsVisible}
                onClick={() => visibilityMutation.mutate(financialsVisible)}
              >
                <SaveIcon fontSize="small" />
                Save visibility
              </Button>
            )}
            {mutationError && <p className="mt-3 text-sm text-danger-600">{mutationError}</p>}
          </div>
        </div>
      </Card>

      <Card
        title="Facility services"
        description="Manage facility-specific service rates and availability."
        badge={`${activeServiceCount} active`}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Prices are facility rates shown to clients during service-first discovery.
          </p>
          {canManageServices && (
            <Button className="w-full sm:w-auto" onClick={() => openServiceModal()}>
              <AddIcon fontSize="small" />
              Add service
            </Button>
          )}
        </div>

        {servicesQuery.isLoading ? (
          <Loading />
        ) : facilityServices.length === 0 ? (
          <p className="text-sm text-slate-600">No facility services configured.</p>
        ) : (
          <div className="grid gap-3">
            {facilityServices.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                canManage={canManageServices}
                onEdit={openServiceModal}
                onDisable={(target) => {
                  setMutationError(null);
                  setPendingDisable(target);
                }}
              />
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Facility providers"
        description="Onboard existing users into this facility and manage provider compensation."
        badge={`${providers.length} listed`}
      >
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <Input
            label="Search providers"
            value={providerSearch}
            onChange={(event) => setProviderSearch(event.target.value)}
            placeholder="Name, email, or phone"
          />
          {hasPermission("provider:verify") && (
            <Button className="w-full md:w-auto" onClick={() => openProviderModal()}>
              <AddIcon fontSize="small" />
              Bootstrap provider
            </Button>
          )}
        </div>

        {providersQuery.isLoading ? (
          <Loading />
        ) : providersQuery.isError ? (
          <p className="text-sm text-danger-600">{extractErrorMessage(providersQuery.error)}</p>
        ) : providers.length === 0 ? (
          <p className="text-sm text-slate-600">No providers are currently visible for this facility.</p>
        ) : (
          <div className="grid gap-3">
            {providers.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                canManage={canManageFacility}
                onEditCompensation={openProviderModal}
              />
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Facility booking queue"
        description="Assign or reassign providers for bookings routed to this facility."
        badge={`${facilityBookings.length} open`}
      >
        {!canManageBookings ? (
          <p className="text-sm text-slate-600">You do not have permission to manage facility bookings.</p>
        ) : bookingsQuery.isLoading ? (
          <Loading />
        ) : bookingsQuery.isError ? (
          <p className="text-sm text-danger-600">{extractErrorMessage(bookingsQuery.error)}</p>
        ) : facilityBookings.length === 0 ? (
          <p className="text-sm text-slate-600">No pending facility bookings.</p>
        ) : (
          <div className="grid gap-3">
            {facilityBookings.map((booking) => (
              <FacilityBookingRow
                key={booking.id}
                booking={booking}
                canAssign={canManageBookings && canVerifyProviders}
                nowMs={nowMs}
                onAssign={openAssignmentModal}
              />
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={serviceModalOpen}
        title={editingService ? "Edit facility service" : "Add facility service"}
        onClose={() => setServiceModalOpen(false)}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
            <span>Service</span>
            <select
              value={serviceForm.serviceId}
              onChange={(event) => {
                const nextService = availableCatalogServices.find((service) => service.id === event.target.value);
                updateServiceForm("serviceId", event.target.value);
                if (!editingService && nextService) {
                  updateServiceForm("price", centsToPrice(nextService.base_price_cents));
                  updateServiceForm("estimateDurationMinutes", String(nextService.default_estimate_minutes));
                }
              }}
              disabled={Boolean(editingService)}
              className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
            >
              <option value="">Select service</option>
              {availableCatalogServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Facility price"
            type="number"
            min="0"
            step="1"
            value={serviceForm.price}
            onChange={(event) => updateServiceForm("price", event.target.value)}
          />
          <Input
            label="Estimate duration minutes"
            type="number"
            min="1"
            step="1"
            value={serviceForm.estimateDurationMinutes}
            onChange={(event) => updateServiceForm("estimateDurationMinutes", event.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={serviceForm.active}
                onChange={(event) => updateServiceForm("active", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
              />
              Active
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={serviceForm.isEmergencyCapable}
                onChange={(event) => updateServiceForm("isEmergencyCapable", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
              />
              Emergency capable
            </label>
          </div>
          {serviceFormError && <p className="text-sm text-danger-600">{serviceFormError}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setServiceModalOpen(false)} disabled={serviceMutation.isPending}>
              Cancel
            </Button>
            <Button type="button" loading={serviceMutation.isPending} onClick={handleSaveService}>
              Save service
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDisable)}
        title="Disable facility service?"
        description={pendingDisable ? `${pendingDisable.service?.name ?? "This service"} will stop appearing for this facility.` : undefined}
        error={mutationError ?? undefined}
        confirmLabel="Disable"
        loading={disableMutation.isPending}
        onClose={() => setPendingDisable(null)}
        onConfirm={() => {
          if (pendingDisable) {
            disableMutation.mutate(pendingDisable);
          }
        }}
      />

      <Modal
        open={providerModalOpen}
        title={editingProvider ? "Edit provider compensation" : "Bootstrap provider"}
        description={
          editingProvider
            ? `Update compensation for ${providerName(editingProvider)}.`
            : "Create or fetch a provider profile for an existing user inside this facility."
        }
        onClose={() => setProviderModalOpen(false)}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <Input
            label="Provider user ID"
            value={providerForm.userId}
            disabled={Boolean(editingProvider)}
            onChange={(event) => updateProviderForm("userId", event.target.value)}
          />
          <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
            <span>Compensation mode</span>
            <select
              value={providerForm.mode}
              onChange={(event) => updateProviderForm("mode", event.target.value as ProviderCompensationMode)}
              className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
            >
              {PROVIDER_COMPENSATION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === "employee" ? "Employee" : mode === "fixed" ? "Fixed payout" : "Percentage split"}
                </option>
              ))}
            </select>
          </label>
          {providerForm.mode === "fixed" && (
            <Input
              label="Fixed payout"
              type="number"
              min="0"
              step="1"
              value={providerForm.fixedPayout}
              onChange={(event) => updateProviderForm("fixedPayout", event.target.value)}
            />
          )}
          {providerForm.mode === "percentage" && (
            <Input
              label="Provider payout percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={providerForm.payoutPercentage}
              onChange={(event) => updateProviderForm("payoutPercentage", event.target.value)}
            />
          )}
          {providerFormError && <p className="text-sm text-danger-600">{providerFormError}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setProviderModalOpen(false)} disabled={providerMutation.isPending}>
              Cancel
            </Button>
            <Button type="button" loading={providerMutation.isPending} onClick={handleSaveProvider}>
              {editingProvider ? "Save compensation" : "Bootstrap provider"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(assignmentBooking)}
        title={assignmentBooking?.provider ? "Reassign provider" : "Assign provider"}
        description={assignmentBooking ? `Choose a provider configured for ${assignmentBooking.service?.name ?? "this service"}.` : undefined}
        onClose={() => setAssignmentBooking(null)}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
            <span>Provider</span>
            <select
              value={assignmentForm.providerUserId}
              onChange={(event) => setAssignmentForm((current) => ({ ...current, providerUserId: event.target.value }))}
              className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
            >
              <option value="">Select provider</option>
              {assignableProviders.map((provider) => (
                <option key={provider.userId} value={provider.userId}>
                  {providerName(provider)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
            <span>Reason</span>
            <textarea
              value={assignmentForm.reason}
              onChange={(event) => setAssignmentForm((current) => ({ ...current, reason: event.target.value }))}
              className="min-h-20 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
            />
          </label>
          {assignableProviders.length === 0 && (
            <p className="text-sm text-warning-500">No verified provider in this facility is configured for this service.</p>
          )}
          {assignmentError && <p className="text-sm text-danger-600">{assignmentError}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setAssignmentBooking(null)} disabled={assignmentMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={assignmentMutation.isPending}
              disabled={!assignmentBooking || !assignmentForm.providerUserId}
              onClick={() => {
                if (assignmentBooking) {
                  assignmentMutation.mutate({ booking: assignmentBooking, form: assignmentForm });
                }
              }}
            >
              Save assignment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FacilityWorkspacePage;
