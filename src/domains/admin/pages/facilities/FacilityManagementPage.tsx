import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import BusinessIcon from "@mui/icons-material/BusinessOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutline";
import MoreTimeIcon from "@mui/icons-material/MoreTimeOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAddAltOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import MyLocationOutlinedIcon from "@mui/icons-material/MyLocationOutlined";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { Input } from "../../../../shared/components/Input";
import { Modal } from "../../../../shared/components/Modal";
import { ActionMenu, type ActionMenuItem } from "../../../../shared/components/ActionMenu";
import { FacilityAdminSummary } from "../../components/FacilityAdminSummary";
import {
  createFacility,
  fetchFacilityAdminInvitationStatus,
  fetchFacilities,
  resendFacilityAdminInvitation,
  updateFacilityStatus
} from "../../../../shared/libs/facilities";
import type { Facility, FacilityCreateInput, FacilityStatus } from "../../../../shared/schemas/facility";
import { FACILITY_TYPES, HOSPITAL_LEVELS, WEEKDAYS } from "../../../../shared/schemas/facility";
import { useRbac } from "../../../../shared/hooks/useRbac";
import { classifyApiError } from "../../../../shared/utils/errors";
import LocationPickerMap from "../../../../shared/components/LocationPickerMap";
import { SUPPORTED_COUNTRIES } from "../../../../shared/constants/region";

type CreateFormState = {
  name: string;
  facilityType: FacilityCreateInput["facilityType"];
  hospitalLevel: string;
  address: string;
  county: string;
  countryCode: string;
  phones: Array<{ phone: string; label: string; isPrimary: boolean }>;
  email: string;
  initialAdminEmail: string;
  lat: string;
  lng: string;
  locationDetails: string;
  platformFeePercent: string;
  is24Hours: boolean;
  openTime: string;
  closeTime: string;
  fastResponseEnabled: boolean;
};

type StatusDialogState = {
  facility: Facility;
  status: FacilityStatus;
};

const initialFormState: CreateFormState = {
  name: "",
  facilityType: "hospital",
  hospitalLevel: "",
  address: "",
  county: "",
  countryCode: "",
  phones: [{ phone: "", label: "Reception", isPrimary: true }],
  email: "",
  initialAdminEmail: "",
  lat: "",
  lng: "",
  locationDetails: "",
  platformFeePercent: "10",
  is24Hours: true,
  openTime: "08:00",
  closeTime: "17:00",
  fastResponseEnabled: false
};

const FACILITY_PAGE_SIZE = 25;

const statusTone: Record<FacilityStatus, string> = {
  pending: "bg-warning-50 text-warning-500 ring-warning-100",
  active: "bg-success-50 text-success-600 ring-success-100",
  suspended: "bg-danger-50 text-danger-600 ring-danger-100"
};

const formatLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const parseOptionalNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const extractErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const data = error.response?.data as { data?: { message?: string }; meta?: { message?: string } } | undefined;
    return data?.meta?.message ?? data?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "Request failed";
};

// What to tell someone when the facility list could not be loaded. A timeout, no connection and a
// server fault each say what happened and that trying again is reasonable; anything else shows
// the API's own explanation.
export const describeFacilityListError = (error: unknown): string => {
  const { category, message } = classifyApiError(error, extractErrorMessage(error));
  if (category === "timeout") {
    return "The server took too long to respond. Check your connection and try again.";
  }
  if (category === "unavailable") {
    return message && message !== "Network Error" && isAxiosError(error) && error.response
      ? "Something went wrong on our side. Try again in a moment."
      : "We could not reach the server. Check your connection and try again.";
  }
  if (category === "forbidden") {
    return "You do not have permission to view facilities.";
  }
  return message || "We could not load facilities.";
};

const FacilityListSkeleton = () => (
  <div className="grid gap-4" role="status" aria-label="Loading facilities">
    {[0, 1, 2].map((index) => (
      <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" aria-hidden="true" />
    ))}
  </div>
);

const buildOperatingHours = (form: CreateFormState): FacilityCreateInput["operatingHours"] =>
  WEEKDAYS.map((weekday) => ({
    weekday,
    openTime: form.is24Hours ? null : form.openTime,
    closeTime: form.is24Hours ? null : form.closeTime,
    isClosed: false,
    is24Hours: form.is24Hours
  }));

export const buildFacilityCreateInput = (form: CreateFormState): FacilityCreateInput => ({
  name: form.name.trim(),
  facilityType: form.facilityType,
  hospitalLevel: form.facilityType === "hospital" ? Number(form.hospitalLevel) : null,
  address: form.address.trim(),
  locationDetails: form.locationDetails.trim() || null,
  county: form.county.trim(),
  countryCode: form.countryCode || null,
  phones: form.phones.map((phone) => ({ ...phone, phone: phone.phone.trim(), label: phone.label.trim() || null })),
  email: form.email.trim(),
  initialAdminEmail: form.initialAdminEmail.trim(),
  lat: parseOptionalNumber(form.lat),
  lng: parseOptionalNumber(form.lng),
  operatingHours: buildOperatingHours(form),
  platformFeePercent: Number(form.platformFeePercent),
  fastResponseEnabled: form.fastResponseEnabled
});

export const validateCreateForm = (form: CreateFormState): string | null => {
  if (!form.name.trim() || !form.address.trim() || !form.county.trim() || !form.email.trim()) {
    return "Name, address, county, and facility email are required.";
  }
  if (!form.phones.some((phone) => phone.phone.trim())) {
    return "At least one facility phone number is required.";
  }
  if (!form.initialAdminEmail.trim()) {
    return "Initial admin email is required.";
  }
  if (form.facilityType === "hospital" && !HOSPITAL_LEVELS.includes(Number(form.hospitalLevel) as (typeof HOSPITAL_LEVELS)[number])) {
    return "Select a hospital level from Level 1 to Level 6.";
  }
  if (!form.is24Hours && (!form.openTime || !form.closeTime)) {
    return "Opening and closing time are required unless the facility is 24/7.";
  }
  const platformFee = Number(form.platformFeePercent);
  if (!Number.isFinite(platformFee) || platformFee < 0 || platformFee > 100) {
    return "Platform fee must be between 0 and 100.";
  }
  const lat = parseOptionalNumber(form.lat);
  const lng = parseOptionalNumber(form.lng);
  if (lat === undefined || lng === undefined) {
    return "Select the facility location on the map.";
  }
  return null;
};

const FacilityMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
    <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
  </div>
);

const FacilityCard = ({
  facility,
  canManageFacilities,
  canManageAdmins,
  onStatus,
  onOpen,
  onManageAdmins
}: {
  facility: Facility;
  canManageFacilities: boolean;
  canManageAdmins: boolean;
  onStatus: (facility: Facility, status: FacilityStatus) => void;
  onOpen: (facility: Facility) => void;
  onManageAdmins: (facility: Facility) => void;
}) => {
  const menuItems: ActionMenuItem[] = [
    ...(canManageFacilities && facility.status !== "active"
      ? [{ key: "approve", label: "Approve facility", icon: <CheckCircleIcon fontSize="small" />, onSelect: () => onStatus(facility, "active") }]
      : []),
    ...(canManageFacilities && facility.status !== "pending"
      ? [{ key: "pending", label: "Set to pending", icon: <MoreTimeIcon fontSize="small" />, onSelect: () => onStatus(facility, "pending") }]
      : []),
    ...(canManageFacilities && facility.status !== "suspended"
      ? [{ key: "suspend", label: "Suspend facility", icon: <BlockIcon fontSize="small" />, onSelect: () => onStatus(facility, "suspended") }]
      : []),
    ...(canManageAdmins
      ? [{ key: "admins", label: "Manage administrators", icon: <PersonAddIcon fontSize="small" />, onSelect: () => onManageAdmins(facility) }]
      : [])
  ];
  const place = [facility.county, facility.countryCode].filter(Boolean).join(", ");

  return (
    <article
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_auto] lg:items-center"
      aria-label={facility.name}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-semibold text-slate-900">{facility.name}</h2>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[facility.status]}`}>
            {formatLabel(facility.status)}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {formatLabel(facility.facilityType)}
          {facility.hospitalLevel ? ` · Level ${facility.hospitalLevel}` : ""}
          {place ? ` · ${place}` : ""}
        </p>
        <p className="mt-0.5 truncate text-sm text-slate-500">{facility.address}</p>
        <p className="mt-0.5 break-words text-sm text-slate-500">{facility.email || "-"}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {canManageAdmins && (
          <div className="col-span-2">
            <dt className="text-xs font-semibold text-slate-500">Administrators</dt>
            <dd className="mt-0.5">
              <FacilityAdminSummary facilityId={facility.id} />
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-semibold text-slate-500">TYH fee</dt>
          <dd className="mt-0.5 text-slate-800">{facility.platformFeePercent}%</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Button size="sm" onClick={() => onOpen(facility)} aria-label={`Open facility ${facility.name}`}>
          <VisibilityIcon fontSize="small" aria-hidden="true" />
          Open facility
        </Button>
        <ActionMenu label="Manage" subject={facility.name} items={menuItems} />
      </div>
    </article>
  );
};

const FacilityManagementPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission, hasRole } = useRbac();
  const canReadFacilities = hasPermission("facility:read");
  const canManageFacilities = hasPermission("facility:manage");
  const isSuperAdmin = hasRole("admin.super");
  const canCreateFacilities = isSuperAdmin && canManageFacilities;
  const canChangeFacilityStatus = isSuperAdmin && canManageFacilities;
  const canManageAdmins = isSuperAdmin && hasPermission("facility:admins.manage");

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<FacilityStatus | "all">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateFormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [statusDialog, setStatusDialog] = useState<StatusDialogState | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invitationNotice, setInvitationNotice] = useState<{
    facilityId: string;
    userId: string;
    email: string;
  } | null>(null);

  const facilitiesQuery = useQuery({
    queryKey: ["admin", "facilities", { status, search, page }],
    queryFn: () =>
      fetchFacilities({
        page,
        pageSize: FACILITY_PAGE_SIZE,
        status: status === "all" ? undefined : status,
        search: search || undefined
      }),
    enabled: canReadFacilities,
    placeholderData: (previousData) => previousData
  });

  const facilities = useMemo(() => facilitiesQuery.data?.facilities ?? [], [facilitiesQuery.data?.facilities]);
  const pageInfo = facilitiesQuery.data?.meta.page;
  const invitationStatusQuery = useQuery({
    queryKey: ["admin", "facility-admin-invitation", invitationNotice?.facilityId, invitationNotice?.userId],
    queryFn: () => fetchFacilityAdminInvitationStatus(invitationNotice!.facilityId, invitationNotice!.userId),
    enabled: Boolean(invitationNotice)
  });
  const visibleFacilities = facilities;

  const metrics = useMemo(
    () => ({
      total: pageInfo?.total ?? facilities.length,
      active: facilitiesQuery.data?.statusCounts.active ?? 0,
      pending: facilitiesQuery.data?.statusCounts.pending ?? 0,
      suspended: facilitiesQuery.data?.statusCounts.suspended ?? 0
    }),
    [facilities.length, facilitiesQuery.data?.statusCounts, pageInfo?.total]
  );

  useEffect(() => {
    if (isCreateOpen) {
      setFormError(null);
    }
  }, [isCreateOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const invalidateFacilities = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "facilities"] });
  };

  const createMutation = useMutation({
    mutationFn: createFacility,
    onSuccess: (result) => {
      invalidateFacilities();
      if (result.adminInvitation?.userId) {
        setInvitationNotice({
          facilityId: result.facility.id,
          userId: result.adminInvitation.userId,
          email: form.initialAdminEmail.trim()
        });
      }
      setIsCreateOpen(false);
      setForm(initialFormState);
      setSuccessMessage(result.adminInvitation?.invitationSent
        ? "Facility created. The initial admin has been sent a password setup email."
        : "Facility created.");
    },
    onError: (error) => {
      setFormError(extractErrorMessage(error));
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ facility, nextStatus }: { facility: Facility; nextStatus: FacilityStatus }) =>
      updateFacilityStatus(facility.id, nextStatus),
    onSuccess: () => {
      invalidateFacilities();
      setStatusDialog(null);
      setMutationError(null);
    },
    onError: (error) => {
      setMutationError(extractErrorMessage(error));
    }
  });

  const resendInvitationMutation = useMutation({
    mutationFn: () => {
      if (!invitationNotice) {
        throw new Error("Invitation context is missing");
      }
      return resendFacilityAdminInvitation(invitationNotice.facilityId, invitationNotice.userId);
    },
    onSuccess: () => {
      setSuccessMessage("A new password setup invitation has been queued.");
      invitationStatusQuery.refetch();
    },
    onError: (error) => {
      setMutationError(extractErrorMessage(error));
    }
  });

  const handleCreate = () => {
    const validationMessage = validateCreateForm(form);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }
    setFormError(null);
    createMutation.mutate(buildFacilityCreateInput(form));
  };

  const updateForm = <K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("This browser does not support location access.");
      return;
    }
    setLocationError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateForm("lat", String(coords.latitude));
        updateForm("lng", String(coords.longitude));
        setIsLocating(false);
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. Search for the address or place the pin manually."
            : error.code === error.TIMEOUT
              ? "We could not get your location in time. Try again or place the pin manually."
              : "We could not get your current location. Search for the address or place the pin manually."
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  if (!canReadFacilities) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-slate-700">
          <BusinessIcon className="text-slate-400" />
          <p className="text-sm">You do not have permission to view facilities.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Facilities</h1>
          <p className="text-sm text-slate-500">
            Manage facility tenants, lifecycle status, admin ownership, and platform fee baselines.
          </p>
        </div>
        {canCreateFacilities && (
          <Button className="w-full sm:w-auto" onClick={() => setIsCreateOpen(true)}>
            <BusinessIcon fontSize="small" />
            Add facility
          </Button>
        )}
      </div>

      {successMessage && <div className="rounded-xl border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700" role="status">{successMessage}</div>}

      {invitationNotice && (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <EmailOutlinedIcon className="mt-0.5 text-tiba-blue" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Initial admin invitation</p>
                <p className="mt-1 text-sm text-slate-600">
                  {invitationNotice.email} · {formatLabel(invitationStatusQuery.data?.status ?? "pending")}
                </p>
                {invitationStatusQuery.data?.expiresAt && (
                  <p className="mt-1 text-xs text-slate-500">
                    Expires {new Date(invitationStatusQuery.data.expiresAt).toLocaleString()}
                  </p>
                )}
                {mutationError && <p className="mt-2 text-sm text-danger-600">{mutationError}</p>}
              </div>
            </div>
            {invitationStatusQuery.data?.status !== "completed" && (
              <Button
                size="sm"
                variant="outline"
                loading={resendInvitationMutation.isPending}
                onClick={() => {
                  setMutationError(null);
                  resendInvitationMutation.mutate();
                }}
              >
                <RefreshOutlinedIcon fontSize="small" />
                Resend invitation
              </Button>
            )}
          </div>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FacilityMetric label="Total" value={String(metrics.total)} />
        <FacilityMetric label="Active" value={String(metrics.active)} />
        <FacilityMetric label="Pending" value={String(metrics.pending)} />
        <FacilityMetric label="Suspended" value={String(metrics.suspended)} />
      </section>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input
            label="Search"
            placeholder="Facility, county, address, or email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as FacilityStatus | "all");
                setPage(1);
              }}
              className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        </div>
      </Card>

      {facilitiesQuery.isError && facilitiesQuery.data && (
        <div
          className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span>{describeFacilityListError(facilitiesQuery.error)} Showing the last results that loaded.</span>
          <Button size="sm" variant="outline" loading={facilitiesQuery.isFetching} onClick={() => void facilitiesQuery.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {facilitiesQuery.isLoading ? (
        <FacilityListSkeleton />
      ) : facilitiesQuery.isError && !facilitiesQuery.data ? (
        <Card>
          <p className="text-sm text-danger-600" role="alert">
            {describeFacilityListError(facilitiesQuery.error)}
          </p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            loading={facilitiesQuery.isFetching}
            onClick={() => void facilitiesQuery.refetch()}
          >
            Try again
          </Button>
        </Card>
      ) : visibleFacilities.length === 0 ? (
        <Card>
          {search || status !== "all" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">No facilities match the current filters.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setStatus("all");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              No facilities yet.{canCreateFacilities ? " Use Add facility to onboard the first one." : ""}
            </p>
          )}
        </Card>
      ) : (
        <section
          className={`grid gap-4 transition-opacity ${facilitiesQuery.isPlaceholderData ? "opacity-60" : ""}`}
          aria-busy={facilitiesQuery.isPlaceholderData}
        >
          {visibleFacilities.map((facility) => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              canManageFacilities={canChangeFacilityStatus}
              canManageAdmins={canManageAdmins}
              onStatus={(target, nextStatus) => {
                setMutationError(null);
                setStatusDialog({ facility: target, status: nextStatus });
              }}
              onOpen={(target) => navigate(`/admin/facilities/${target.id}`)}
              onManageAdmins={(target) => navigate(`/admin/facilities/${target.id}#facility-administrators`)}
            />
          ))}
        </section>
      )}

      {facilitiesQuery.isPlaceholderData && (
        <p className="text-xs text-slate-500" role="status">
          Updating the list...
        </p>
      )}

      {pageInfo && pageInfo.totalPages > 1 && (
        <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Page {pageInfo.number} of {pageInfo.totalPages} · {pageInfo.total} facilities
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pageInfo.number <= 1 || facilitiesQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pageInfo.number >= pageInfo.totalPages || facilitiesQuery.isFetching}
              onClick={() => setPage((current) => Math.min(pageInfo.totalPages, current + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={isCreateOpen}
        title="Add facility"
        description="Create a facility tenant with the minimum onboarding details."
        onClose={() => setIsCreateOpen(false)}
        maxWidth="md"
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Facility name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
              <span>Facility type</span>
              <select
                value={form.facilityType}
                onChange={(event) => updateForm("facilityType", event.target.value as FacilityCreateInput["facilityType"])}
                className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
              >
                {FACILITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            {form.facilityType === "hospital" && (
              <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
                <span>Hospital level</span>
                <select
                  required
                  value={form.hospitalLevel}
                  onChange={(event) => updateForm("hospitalLevel", event.target.value)}
                  className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
                >
                  <option value="">Select level</option>
                  {HOSPITAL_LEVELS.map((level) => (
                    <option key={level} value={level}>Level {level}</option>
                  ))}
                </select>
              </label>
            )}
            <Input label="County" value={form.county} onChange={(event) => updateForm("county", event.target.value)} />
            <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
              <span>Country</span>
              <select
                value={form.countryCode}
                onChange={(event) => updateForm("countryCode", event.target.value)}
                className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
              >
                <option value="">Select country</option>
                {SUPPORTED_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Facility email" type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
            <div className="md:col-span-2 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-semibold text-slate-800">Facility phone numbers</p><p className="text-xs text-slate-500">Add reception, billing, emergency, or other contacts.</p></div>
                <Button type="button" size="sm" variant="outline" onClick={() => updateForm("phones", [...form.phones, { phone: "", label: "", isPrimary: false }])}><AddCircleOutlineIcon fontSize="small" />Add phone</Button>
              </div>
              <div className="mt-3 space-y-3">
                {form.phones.map((phone, index) => (
                  <div key={`phone-${index}`} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Input label={index === 0 ? "Phone number" : `Phone number ${index + 1}`} value={phone.phone} onChange={(event) => updateForm("phones", form.phones.map((item, itemIndex) => itemIndex === index ? { ...item, phone: event.target.value } : item))} placeholder="+254..." />
                    <Input label="Label" value={phone.label} onChange={(event) => updateForm("phones", form.phones.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="Reception" />
                    <div className="flex items-center gap-2 pb-2"><label className="flex items-center gap-2 text-xs text-slate-600"><input type="radio" name="primary-facility-phone" checked={phone.isPrimary} onChange={() => updateForm("phones", form.phones.map((item, itemIndex) => ({ ...item, isPrimary: itemIndex === index })))} />Primary</label>{form.phones.length > 1 && <button type="button" className="text-danger-600" title="Remove phone" onClick={() => updateForm("phones", form.phones.filter((_, itemIndex) => itemIndex !== index))}><RemoveCircleOutlineIcon fontSize="small" /></button>}</div>
                  </div>
                ))}
              </div>
            </div>
            <Input
              label="Initial admin email"
              type="email"
              value={form.initialAdminEmail}
              onChange={(event) => updateForm("initialAdminEmail", event.target.value)}
            />
            <Input
              label="TYH platform fee (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.platformFeePercent}
              onChange={(event) => updateForm("platformFeePercent", event.target.value)}
            />
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={form.fastResponseEnabled}
                onChange={(event) => updateForm("fastResponseEnabled", event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
              />
              <span>
                <span className="block font-semibold text-slate-800">Fast-response candidate</span>
                <span className="mt-1 block text-xs text-slate-500">
                  Include this facility in internal response benchmarking. Client-facing ranking remains disabled until the benchmark is reviewed.
                </span>
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-800">Facility location</p>
              <p className="text-xs text-slate-500">Search for the street address or place the pin. Use current location only when you are at the facility.</p>
            </div>
            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Street address</span>
              <textarea
                value={form.address}
                onChange={(event) => updateForm("address", event.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
              />
            </label>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">Choose the pin for the building entrance or main site.</p>
              <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} loading={isLocating}>
                <MyLocationOutlinedIcon fontSize="small" />
                Use my current location
              </Button>
            </div>
            <LocationPickerMap
              value={form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null}
              onChange={(location) => { updateForm("lat", String(location.lat)); updateForm("lng", String(location.lng)); }}
              onAddressChange={(address) => updateForm("address", address)}
              height={280}
            />
            {locationError && <p className="mt-2 text-sm text-danger-600" role="alert">{locationError}</p>}
            {form.lat && form.lng && <p className="mt-2 text-xs text-slate-500">Location selected: {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}</p>}
            <div className="mt-4">
              <Input
                label="Building, floor, suite or room (optional)"
                value={form.locationDetails}
                onChange={(event) => updateForm("locationDetails", event.target.value)}
                placeholder="Building B, 2nd floor, Room 3"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={form.is24Hours}
                onChange={(event) => updateForm("is24Hours", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-tiba-blue focus:ring-tiba-blue"
              />
              Open 24/7
            </label>
            {!form.is24Hours && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input
                  label="Daily opening time"
                  type="time"
                  value={form.openTime}
                  onChange={(event) => updateForm("openTime", event.target.value)}
                />
                <Input
                  label="Daily closing time"
                  type="time"
                  value={form.closeTime}
                  onChange={(event) => updateForm("closeTime", event.target.value)}
                />
              </div>
            )}
          </div>

          {formError && <p className="text-sm text-danger-600">{formError}</p>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} loading={createMutation.isPending}>
              Create facility
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(statusDialog)}
        title="Change facility status?"
        description={
          statusDialog
            ? `${statusDialog.facility.name} will be marked ${formatLabel(statusDialog.status).toLowerCase()}.`
            : undefined
        }
        error={mutationError ?? undefined}
        confirmLabel="Update status"
        loading={statusMutation.isPending}
        onClose={() => setStatusDialog(null)}
        onConfirm={() => {
          if (statusDialog) {
            statusMutation.mutate({ facility: statusDialog.facility, nextStatus: statusDialog.status });
          }
        }}
      />
    </div>
  );
};

export default FacilityManagementPage;
