import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link, useParams } from "react-router-dom";
import AddIcon from "@mui/icons-material/AddOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBackOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import SaveIcon from "@mui/icons-material/SaveOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOffOutlined";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAddOutlined";

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
  fetchFacilities,
  fetchFacility,
  fetchFacilityBookings,
  fetchFacilityProviders,
  fetchFacilityServices,
  bootstrapFacilityProvider,
  replaceFacilityServices,
  updateFacility,
  updateFacilityProviderCompensation,
  updateFacilityService
} from "../../../../shared/libs/facilities";
import {
  cancelFacilityServiceRequest,
  createFacilityServiceRequest,
  fetchFacilityServiceRequests
} from "../../../../shared/libs/serviceRequests";
import type {
  Facility,
  FacilityService,
  FacilityServiceInput,
  ProviderCompensation,
  ProviderCompensationMode
} from "../../../../shared/schemas/facility";
import {
  PROVIDER_COMPENSATION_MODES,
  WEEKDAYS,
  formatOperatingHoursSummary,
  formatProviderCompensation
} from "../../../../shared/schemas/facility";
import type { FacilityOperatingHour, FacilityPhone, Provider } from "../../../../shared/schemas/facility";
import type { Booking } from "../../../../shared/schemas/booking";
import type { ServiceRequest, ServiceRequestCreateInput } from "../../../../shared/schemas/serviceRequest";
import { STATUS_LABELS } from "../../../../shared/schemas/serviceRequest";
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
  remote_capable: boolean;
};

type ServiceFormState = {
  serviceId: string;
  price: string;
  estimateDurationMinutes: string;
  active: boolean;
  isEmergencyCapable: boolean;
  deliveryMode: "in_person" | "remote" | "both";
};

type BulkServiceRow = ServiceFormState & {
  name: string;
  remoteCapable: boolean;
};

type ServiceRequestFormState = {
  proposedName: string;
  rationale: string;
  proposedCategoryName: string;
};

const initialServiceRequestForm: ServiceRequestFormState = {
  proposedName: "",
  rationale: "",
  proposedCategoryName: ""
};

export const validateServiceRequestForm = (form: ServiceRequestFormState): string | null => {
  if (!form.proposedName.trim()) {
    return "Enter the service name you want added.";
  }
  if (!form.rationale.trim()) {
    return "Explain why this service is needed.";
  }
  return null;
};

export const buildServiceRequestInput = (form: ServiceRequestFormState): ServiceRequestCreateInput => ({
  proposedName: form.proposedName.trim(),
  rationale: form.rationale.trim(),
  proposedCategoryName: form.proposedCategoryName.trim() || null
});

const SERVICE_REQUEST_STATUS_BADGE: Record<ServiceRequest["status"], string> = {
  pending: "bg-warning-50 text-warning-500",
  approved: "bg-success-50 text-success-600",
  rejected: "bg-danger-50 text-danger-600",
  cancelled: "bg-slate-100 text-slate-600"
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

type FacilityWorkspacePageProps = {
  showOperationalSections?: boolean;
};

type FacilitySettingsFormState = {
  phones: Array<Pick<FacilityPhone, "phone" | "label" | "isPrimary">>;
  operatingHours: Array<Omit<FacilityOperatingHour, "id">>;
};

const defaultOperatingHours = (): FacilitySettingsFormState["operatingHours"] =>
  WEEKDAYS.map((weekday) => ({
    weekday,
    openTime: "08:00",
    closeTime: "17:00",
    isClosed: false,
    is24Hours: true
  }));

export const buildFacilitySettingsForm = (facility: Facility): FacilitySettingsFormState => ({
  phones: facility.phones.map(({ phone, label, isPrimary }) => ({ phone, label, isPrimary })),
  operatingHours: WEEKDAYS.map((weekday) => {
    const existing = facility.operatingHours.find((hour) => hour.weekday === weekday);
    return existing
      ? {
          weekday,
          openTime: existing.openTime,
          closeTime: existing.closeTime,
          isClosed: existing.isClosed,
          is24Hours: existing.is24Hours
        }
      : defaultOperatingHours().find((hour) => hour.weekday === weekday)!;
  })
});

export const validateFacilitySettingsForm = (form: FacilitySettingsFormState): string | null => {
  if (!form.phones.some((phone) => phone.phone.trim())) {
    return "At least one facility phone number is required.";
  }
  if (form.phones.some((phone) => !phone.phone.trim() && (phone.label ?? "").trim())) {
    return "Remove empty phone rows or enter a phone number.";
  }
  for (const hour of form.operatingHours) {
    if (hour.isClosed || hour.is24Hours) continue;
    if (!hour.openTime || !hour.closeTime) {
      return "Enter opening and closing times for every open day.";
    }
  }
  return null;
};

const initialServiceForm: ServiceFormState = {
  serviceId: "",
  price: "",
  estimateDurationMinutes: "60",
  active: true,
  isEmergencyCapable: false,
  deliveryMode: "in_person"
};

const initialProviderForm: ProviderCompensationFormState = {
  userId: "",
  mode: "employee",
  fixedPayout: "",
  payoutPercentage: ""
};

export const priceToCents = (value: string): number => Math.round(Number(value) * 100);

/** Keep admin ops inside the one facility returned by the backend scope query. */
export const canAdminOpsAccessFacility = (
  facilityId: string | undefined,
  roles: string[],
  facilities: Pick<Facility, "id">[]
): boolean => {
  const roleSet = new Set(roles);
  const isFacilityAdmin = roleSet.has("admin.ops") && !roleSet.has("admin.super") && !roleSet.has("admin");
  if (!isFacilityAdmin) {
    return true;
  }
  return Boolean(facilityId) && facilities.length === 1 && facilities[0].id === facilityId;
};

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

export const validateServiceForm = (form: ServiceFormState): string | null => {
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
  isEmergencyCapable: form.isEmergencyCapable,
  deliveryMode: form.deliveryMode
});

export const validateBulkServiceRows = (rows: BulkServiceRow[]): string | null => {
  if (rows.length === 0) {
    return "Select at least one service.";
  }
  for (const row of rows) {
    const message = validateServiceForm(row);
    if (message) {
      return `${row.name}: ${message}`;
    }
    if (!row.remoteCapable && row.deliveryMode !== "in_person") {
      return `${row.name}: remote delivery is not available for this service.`;
    }
  }
  return null;
};

export const buildBulkFacilityServiceInputs = (rows: BulkServiceRow[]): FacilityServiceInput[] =>
  rows.map((row) => buildFacilityServiceInput(row));

const mapExistingFacilityServiceInput = (service: FacilityService): FacilityServiceInput => ({
  serviceId: service.serviceId,
  priceCents: service.priceCents,
  currency: service.currency,
  estimateDurationMinutes: service.estimateDurationMinutes,
  active: service.active,
  isEmergencyCapable: service.isEmergencyCapable,
  deliveryMode: service.deliveryMode
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
  isEmergencyCapable: service.isEmergencyCapable,
  deliveryMode: service.deliveryMode
});

const mapProviderCompensationForm = (provider: Provider): ProviderCompensationFormState => ({
  userId: provider.userId,
  mode: provider.compensation.mode,
  fixedPayout: provider.compensation.fixedPayoutCents == null ? "" : centsToPrice(provider.compensation.fixedPayoutCents),
  payoutPercentage: provider.compensation.payoutPercentage == null ? "" : String(provider.compensation.payoutPercentage)
});

export const validateProviderForm = (form: ProviderCompensationFormState): string | null => {
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
        {service.deliveryMode !== "in_person" && (
          <span className="rounded-full bg-tiba-blue/10 px-2.5 py-1 text-xs font-semibold text-tiba-blue">
            {service.deliveryMode === "both" ? "In-person & remote" : "Remote only"}
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

export const FacilityBookingRow = ({
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

const FacilityWorkspacePage = ({ showOperationalSections = true }: FacilityWorkspacePageProps) => {
  const { facilityId } = useParams();
  const queryClient = useQueryClient();
  const { roles, hasPermission } = useRbac();
  const isFacilityAdmin = roles.includes("admin.ops") && !roles.includes("admin.super") && !roles.includes("admin");
  const canReadFacilities = hasPermission("facility:read");
  const canManageFacility = hasPermission("facility:manage");
  const canManageServices = hasPermission("facility:services.manage");
  const canVerifyProviders = hasPermission("provider:verify");
  const canManageBookings = hasPermission("booking:manage");

  const [financialsVisible, setFinancialsVisible] = useState(true);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<FacilitySettingsFormState>({
    phones: [],
    operatingHours: defaultOperatingHours()
  });
  const [settingsFormError, setSettingsFormError] = useState<string | null>(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<FacilityService | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(initialServiceForm);
  const [bulkServiceRows, setBulkServiceRows] = useState<BulkServiceRow[]>([]);
  const [serviceFormError, setServiceFormError] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<FacilityService | null>(null);
  const [serviceRequestModalOpen, setServiceRequestModalOpen] = useState(false);
  const [serviceRequestForm, setServiceRequestForm] = useState<ServiceRequestFormState>(initialServiceRequestForm);
  const [serviceRequestFormError, setServiceRequestFormError] = useState<string | null>(null);
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

  const facilityScopeQuery = useQuery({
    queryKey: ["admin", "facility-scope"],
    queryFn: () => fetchFacilities({ pageSize: 2 }),
    enabled: isFacilityAdmin && canReadFacilities
  });
  const scopedFacilities = facilityScopeQuery.data?.facilities ?? [];
  const hasFacilityScope = canAdminOpsAccessFacility(String(facilityId), roles, scopedFacilities);

  const facilityQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId],
    queryFn: () => fetchFacility(String(facilityId)),
    enabled: Boolean(facilityId) && canReadFacilities && (!isFacilityAdmin || (facilityScopeQuery.isSuccess && hasFacilityScope))
  });

  const servicesQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "services"],
    queryFn: () => fetchFacilityServices(String(facilityId)),
    enabled: Boolean(facilityId) && canReadFacilities && (!isFacilityAdmin || (facilityScopeQuery.isSuccess && hasFacilityScope))
  });

  const catalogQuery = useQuery({
    queryKey: ["admin", "services", "catalog", "active"],
    queryFn: fetchCatalogServices,
    enabled: canManageServices && (!isFacilityAdmin || (facilityScopeQuery.isSuccess && hasFacilityScope))
  });

  const serviceRequestsQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "service-requests"],
    queryFn: () => fetchFacilityServiceRequests(String(facilityId)),
    enabled: Boolean(facilityId) && canManageServices && (!isFacilityAdmin || (facilityScopeQuery.isSuccess && hasFacilityScope))
  });

  const providersQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "providers", providerSearch],
    queryFn: () =>
      fetchFacilityProviders(String(facilityId), {
        search: providerSearch.trim() || undefined
      }),
    enabled: showOperationalSections && Boolean(facilityId) && canReadFacilities && canVerifyProviders && (!isFacilityAdmin || (facilityScopeQuery.isSuccess && hasFacilityScope))
  });

  const bookingsQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "bookings", "assignment"],
    queryFn: () =>
      fetchFacilityBookings(String(facilityId), {
        pageSize: 25,
        facilityStatus: "pending,claimed"
      }),
    enabled: showOperationalSections && Boolean(facilityId) && canReadFacilities && canManageBookings && (!isFacilityAdmin || (facilityScopeQuery.isSuccess && hasFacilityScope))
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

  const createBulkServiceRow = (service: CatalogService): BulkServiceRow => ({
    serviceId: service.id,
    name: service.name,
    price: centsToPrice(service.base_price_cents),
    estimateDurationMinutes: String(service.default_estimate_minutes),
    active: true,
    isEmergencyCapable: false,
    deliveryMode: "in_person",
    remoteCapable: service.remote_capable
  });

  const activeServiceCount = facilityServices.filter((service) => service.active).length;

  const selectedCatalogServiceIsRemoteCapable = useMemo(() => {
    const selected = (catalogQuery.data ?? []).find((service) => service.id === serviceForm.serviceId);
    return Boolean(selected?.remote_capable);
  }, [catalogQuery.data, serviceForm.serviceId]);

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

  const settingsMutation = useMutation({
    mutationFn: (form: FacilitySettingsFormState) =>
      updateFacility(String(facilityId), {
        phones: form.phones.map((phone) => ({
          phone: phone.phone.trim(),
          label: phone.label.trim() || null,
          isPrimary: phone.isPrimary
        })),
        operatingHours: form.operatingHours
      }),
    onSuccess: () => {
      invalidateWorkspace();
      setSettingsModalOpen(false);
      setSettingsFormError(null);
    },
    onError: (error) => setSettingsFormError(extractErrorMessage(error))
  });

  const openSettingsModal = () => {
    if (!facility) return;
    setSettingsForm(buildFacilitySettingsForm(facility));
    setSettingsFormError(null);
    setSettingsModalOpen(true);
  };

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

  const bulkServiceMutation = useMutation({
    mutationFn: () => {
      const existing = facilityServices.map(mapExistingFacilityServiceInput);
      const additions = buildBulkFacilityServiceInputs(bulkServiceRows);
      const merged = new Map(existing.map((service) => [service.serviceId, service]));
      additions.forEach((service) => merged.set(service.serviceId, service));
      return replaceFacilityServices(String(facilityId), [...merged.values()]);
    },
    onSuccess: () => {
      invalidateWorkspace();
      setServiceModalOpen(false);
      setEditingService(null);
      setBulkServiceRows([]);
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

  const invalidateServiceRequests = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "facilities", facilityId, "service-requests"] });
  };

  const serviceRequestMutation = useMutation({
    mutationFn: (input: ServiceRequestCreateInput) => createFacilityServiceRequest(String(facilityId), input),
    onSuccess: () => {
      invalidateServiceRequests();
      setServiceRequestModalOpen(false);
      setServiceRequestForm(initialServiceRequestForm);
      setServiceRequestFormError(null);
    },
    onError: (error) => {
      setServiceRequestFormError(extractErrorMessage(error));
    }
  });

  const cancelServiceRequestMutation = useMutation({
    mutationFn: (request: ServiceRequest) => cancelFacilityServiceRequest(String(facilityId), request.id),
    onSuccess: () => {
      invalidateServiceRequests();
      setMutationError(null);
    },
    onError: (error) => {
      setMutationError(extractErrorMessage(error));
    }
  });

  const openServiceRequestModal = () => {
    setServiceRequestForm(initialServiceRequestForm);
    setServiceRequestFormError(null);
    setServiceRequestModalOpen(true);
  };

  const handleSaveServiceRequest = () => {
    const validationMessage = validateServiceRequestForm(serviceRequestForm);
    if (validationMessage) {
      setServiceRequestFormError(validationMessage);
      return;
    }
    setServiceRequestFormError(null);
    serviceRequestMutation.mutate(buildServiceRequestInput(serviceRequestForm));
  };

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
    setBulkServiceRows([]);
    setServiceFormError(null);
    setServiceModalOpen(true);
  };

  const updateServiceForm = <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => {
    setServiceForm((current) => ({ ...current, [key]: value }));
  };

  const handleSaveService = () => {
    if (!editingService) {
      const validationMessage = validateBulkServiceRows(bulkServiceRows);
      if (validationMessage) {
        setServiceFormError(validationMessage);
        return;
      }
      setServiceFormError(null);
      bulkServiceMutation.mutate();
      return;
    }
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

  if (isFacilityAdmin && (facilityScopeQuery.isLoading || facilityScopeQuery.isError || !hasFacilityScope)) {
    return (
      <Card>
        <p className="text-sm text-danger-600">
          {facilityScopeQuery.isError
            ? extractErrorMessage(facilityScopeQuery.error)
            : "This facility is not assigned to your admin ops account."}
        </p>
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
        {canManageFacility && (
          <div className="mb-4 flex justify-end">
            <Button variant="outline" onClick={openSettingsModal}>
              <EditIcon fontSize="small" />
              Edit operations settings
            </Button>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Contact</p>
              <p className="mt-1 break-words text-sm text-slate-800">{facility.email}</p>
              <p className="mt-1 text-sm text-slate-600">
                {facility.phones.find((phone) => phone.isPrimary)?.phone ?? facility.phones[0]?.phone ?? "-"}
              </p>
              {facility.phones.length > 1 && (
                <p className="mt-1 text-xs text-slate-500">{facility.phones.length} contact numbers configured</p>
              )}
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

      <Modal
        open={settingsModalOpen}
        title="Edit facility operations settings"
        description="Manage facility contact numbers and operating hours. Facility identity, email, and location are managed by a super admin."
        onClose={() => setSettingsModalOpen(false)}
        maxWidth="lg"
      >
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Facility phone numbers</h2>
                <p className="mt-1 text-xs text-slate-500">Use labels to distinguish reception, billing, emergency, or other contacts.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setSettingsForm((current) => ({ ...current, phones: [...current.phones, { phone: "", label: "", isPrimary: false }] }))}>
                <AddCircleOutlineIcon fontSize="small" />
                Add phone
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {settingsForm.phones.map((phone, index) => (
                <div key={`settings-phone-${index}`} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <Input label={index === 0 ? "Phone number" : `Phone number ${index + 1}`} value={phone.phone} onChange={(event) => setSettingsForm((current) => ({ ...current, phones: current.phones.map((item, itemIndex) => itemIndex === index ? { ...item, phone: event.target.value } : item) }))} placeholder="+254..." />
                  <Input label="Label" value={phone.label ?? ""} onChange={(event) => setSettingsForm((current) => ({ ...current, phones: current.phones.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} placeholder="Reception" />
                  <div className="flex items-center gap-3 pb-2">
                    <label className="flex items-center gap-2 text-xs text-slate-600"><input type="radio" name="settings-primary-facility-phone" checked={phone.isPrimary} onChange={() => setSettingsForm((current) => ({ ...current, phones: current.phones.map((item, itemIndex) => ({ ...item, isPrimary: itemIndex === index })) }))} />Primary</label>
                    {settingsForm.phones.length > 1 && <button type="button" className="text-danger-600" title="Remove phone" aria-label={`Remove phone ${index + 1}`} onClick={() => setSettingsForm((current) => ({ ...current, phones: current.phones.filter((_, itemIndex) => itemIndex !== index) }))}><RemoveCircleOutlineIcon fontSize="small" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Operating hours</h2>
              <p className="mt-1 text-xs text-slate-500">Set each day independently, including closed days and 24-hour coverage.</p>
            </div>
            <div className="mt-4 space-y-3">
              {settingsForm.operatingHours.map((hour, index) => (
                <div key={hour.weekday} className="grid gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-[100px_110px_1fr_1fr] sm:items-end">
                  <span className="text-sm font-semibold uppercase text-slate-700">{hour.weekday}</span>
                  <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={hour.isClosed} onChange={(event) => setSettingsForm((current) => ({ ...current, operatingHours: current.operatingHours.map((item, itemIndex) => itemIndex === index ? { ...item, isClosed: event.target.checked, is24Hours: false } : item) }))} />Closed</label>
                  <Input label="Opens" type="time" value={hour.openTime ?? ""} disabled={hour.isClosed || hour.is24Hours} onChange={(event) => setSettingsForm((current) => ({ ...current, operatingHours: current.operatingHours.map((item, itemIndex) => itemIndex === index ? { ...item, openTime: event.target.value } : item) }))} />
                  <div className="flex items-end gap-3"><Input label="Closes" type="time" value={hour.closeTime ?? ""} disabled={hour.isClosed || hour.is24Hours} onChange={(event) => setSettingsForm((current) => ({ ...current, operatingHours: current.operatingHours.map((item, itemIndex) => itemIndex === index ? { ...item, closeTime: event.target.value } : item) }))} /><label className="flex items-center gap-2 whitespace-nowrap pb-3 text-xs text-slate-600"><input type="checkbox" checked={hour.is24Hours} disabled={hour.isClosed} onChange={(event) => setSettingsForm((current) => ({ ...current, operatingHours: current.operatingHours.map((item, itemIndex) => itemIndex === index ? { ...item, is24Hours: event.target.checked } : item) }))} />24 hours</label></div>
                </div>
              ))}
            </div>
          </section>

          {settingsFormError && <p className="text-sm text-danger-600">{settingsFormError}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setSettingsModalOpen(false)} disabled={settingsMutation.isPending}>Cancel</Button>
            <Button type="button" loading={settingsMutation.isPending} onClick={() => { const error = validateFacilitySettingsForm(settingsForm); if (error) { setSettingsFormError(error); return; } setSettingsFormError(null); settingsMutation.mutate(settingsForm); }}><SaveIcon fontSize="small" />Save settings</Button>
          </div>
        </div>
      </Modal>

      <Card
        title="Facility services"
        description="Manage facility-specific service rates and availability."
        badge={`${activeServiceCount} active`}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Select an active catalog service to offer at this facility, with your own price and duration.
          </p>
          {canManageServices && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="w-full sm:w-auto" variant="secondary" onClick={openServiceRequestModal}>
                <PlaylistAddIcon fontSize="small" />
                Request a service
              </Button>
              <Button className="w-full sm:w-auto" onClick={() => openServiceModal()}>
                <AddIcon fontSize="small" />
                Add from catalog
              </Button>
            </div>
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

        {canManageServices && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Service requests</h3>
            <p className="mt-1 text-xs text-slate-500">
              Requests to add a new service to the platform catalog, reviewed by a super admin.
            </p>
            {serviceRequestsQuery.isLoading ? (
              <Loading />
            ) : (serviceRequestsQuery.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No service requests yet.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {(serviceRequestsQuery.data ?? []).map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{request.proposedName}</p>
                      <p className="text-xs text-slate-500">{request.rationale}</p>
                      {request.status !== "pending" && request.decisionNote && (
                        <p className="mt-1 text-xs text-slate-500">Decision note: {request.decisionNote}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${SERVICE_REQUEST_STATUS_BADGE[request.status]}`}
                      >
                        {STATUS_LABELS[request.status]}
                      </span>
                      {request.status === "pending" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={cancelServiceRequestMutation.isPending}
                          onClick={() => cancelServiceRequestMutation.mutate(request)}
                        >
                          Cancel
                        </Button>
                      )}
                      {request.status === "approved" && !request.resultingFacilityServiceId && (
                        <span className="text-xs text-warning-500">Awaiting configuration</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Modal
        open={serviceRequestModalOpen}
        title="Request a new catalog service"
        onClose={() => setServiceRequestModalOpen(false)}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <Input
            label="Service name"
            value={serviceRequestForm.proposedName}
            onChange={(event) =>
              setServiceRequestForm((current) => ({ ...current, proposedName: event.target.value }))
            }
            placeholder="e.g. IV Therapy at Home"
          />
          <Input
            label="Suggested category (optional)"
            value={serviceRequestForm.proposedCategoryName}
            onChange={(event) =>
              setServiceRequestForm((current) => ({ ...current, proposedCategoryName: event.target.value }))
            }
            placeholder="e.g. Diagnostics & Monitoring"
          />
          <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
            <span>Why is this service needed?</span>
            <textarea
              value={serviceRequestForm.rationale}
              onChange={(event) =>
                setServiceRequestForm((current) => ({ ...current, rationale: event.target.value }))
              }
              rows={3}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
              placeholder="Explain client demand or a gap in current offerings."
            />
          </label>
          {serviceRequestFormError && <p className="text-sm text-danger-600">{serviceRequestFormError}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setServiceRequestModalOpen(false)}
              disabled={serviceRequestMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="button" loading={serviceRequestMutation.isPending} onClick={handleSaveServiceRequest}>
              Submit request
            </Button>
          </div>
        </div>
      </Modal>

      {showOperationalSections && (
        <>
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
        </>
      )}

      <Modal
        open={serviceModalOpen}
        title={editingService ? "Edit facility service" : "Add facility service"}
        onClose={() => setServiceModalOpen(false)}
        maxWidth="sm"
      >
        <div className="space-y-4">
          {editingService ? (
            <>
              <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
                <span>Service</span>
                <select
                  value={serviceForm.serviceId}
                  disabled
                  className="h-[50px] rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 shadow-sm"
                >
                  <option value={serviceForm.serviceId}>{editingService.service?.name ?? "Service"}</option>
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
              <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
                <span>Delivery mode</span>
                <select
                  value={serviceForm.deliveryMode}
                  onChange={(event) => updateServiceForm("deliveryMode", event.target.value as ServiceFormState["deliveryMode"])}
                  disabled={!selectedCatalogServiceIsRemoteCapable}
                  className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="in_person">In-person only</option>
                  <option value="remote" disabled={!selectedCatalogServiceIsRemoteCapable}>Remote only</option>
                  <option value="both" disabled={!selectedCatalogServiceIsRemoteCapable}>In-person and remote</option>
                </select>
                {!selectedCatalogServiceIsRemoteCapable && (
                  <span className="text-xs text-slate-500">This service isn&apos;t enabled for remote delivery in the global catalog.</span>
                )}
              </label>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-semibold text-slate-800">Choose services to add</p>
                <p className="mt-1 text-xs text-slate-500">You can configure each selected service before saving.</p>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {availableCatalogServices.map((service) => {
                  const selected = bulkServiceRows.some((row) => row.serviceId === service.id);
                  return (
                    <label key={service.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => {
                          setBulkServiceRows((rows) => event.target.checked
                            ? [...rows, createBulkServiceRow(service)]
                            : rows.filter((row) => row.serviceId !== service.id));
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
                      />
                      <span>{service.name}</span>
                      {service.remote_capable && <span className="ml-auto text-xs font-medium text-tiba-blue">Remote capable</span>}
                    </label>
                  );
                })}
                {availableCatalogServices.length === 0 && <p className="p-3 text-sm text-slate-500">All catalog services are already configured.</p>}
              </div>
              {bulkServiceRows.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Service settings</p>
                  {bulkServiceRows.map((row) => (
                    <div key={row.serviceId} className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                        <button type="button" className="text-xs font-semibold text-danger-600" onClick={() => setBulkServiceRows((rows) => rows.filter((item) => item.serviceId !== row.serviceId))}>Remove</button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input label="Price" type="number" min="0" step="1" value={row.price} onChange={(event) => setBulkServiceRows((rows) => rows.map((item) => item.serviceId === row.serviceId ? { ...item, price: event.target.value } : item))} />
                        <Input label="Duration (minutes)" type="number" min="1" step="1" value={row.estimateDurationMinutes} onChange={(event) => setBulkServiceRows((rows) => rows.map((item) => item.serviceId === row.serviceId ? { ...item, estimateDurationMinutes: event.target.value } : item))} />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-800">
                          <input type="checkbox" checked={row.isEmergencyCapable} onChange={(event) => setBulkServiceRows((rows) => rows.map((item) => item.serviceId === row.serviceId ? { ...item, isEmergencyCapable: event.target.checked } : item))} className="h-4 w-4 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue" />
                          Emergency capable
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-800">
                          <input type="checkbox" checked={row.active} onChange={(event) => setBulkServiceRows((rows) => rows.map((item) => item.serviceId === row.serviceId ? { ...item, active: event.target.checked } : item))} className="h-4 w-4 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue" />
                          Active
                        </label>
                      </div>
                      <label className="mt-3 flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
                        <span>Delivery mode</span>
                        <select value={row.deliveryMode} onChange={(event) => setBulkServiceRows((rows) => rows.map((item) => item.serviceId === row.serviceId ? { ...item, deliveryMode: event.target.value as BulkServiceRow["deliveryMode"] } : item))} disabled={!row.remoteCapable} className="h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-400">
                          <option value="in_person">In-person only</option>
                          <option value="remote">Remote only</option>
                          <option value="both">In-person and remote</option>
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {serviceFormError && <p className="text-sm text-danger-600">{serviceFormError}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setServiceModalOpen(false)} disabled={serviceMutation.isPending || bulkServiceMutation.isPending}>
              Cancel
            </Button>
            <Button type="button" loading={serviceMutation.isPending || bulkServiceMutation.isPending} onClick={handleSaveService}>
              {editingService ? "Save service" : `Add ${bulkServiceRows.length || "selected"} services`}
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

      {showOperationalSections && (
        <>
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
        </>
      )}

      {showOperationalSections && (
        <>
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
        </>
      )}
    </div>
  );
};

export default FacilityWorkspacePage;
