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

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import {
  assignFacilityAdmin,
  createFacility,
  fetchFacilities,
  updateFacilityStatus
} from "../../../../shared/libs/facilities";
import type { Facility, FacilityCreateInput, FacilityStatus } from "../../../../shared/schemas/facility";
import { FACILITY_TYPES, WEEKDAYS, formatOperatingHoursSummary } from "../../../../shared/schemas/facility";
import { useRbac } from "../../../../shared/hooks/useRbac";

type CreateFormState = {
  name: string;
  facilityType: FacilityCreateInput["facilityType"];
  address: string;
  county: string;
  phone: string;
  phoneLabel: string;
  email: string;
  initialAdminEmail: string;
  lat: string;
  lng: string;
  platformFeePercent: string;
  is24Hours: boolean;
  openTime: string;
  closeTime: string;
};

type StatusDialogState = {
  facility: Facility;
  status: FacilityStatus;
};

type AdminDialogState = {
  facility: Facility;
  userId: string;
};

const initialFormState: CreateFormState = {
  name: "",
  facilityType: "hospital",
  address: "",
  county: "",
  phone: "",
  phoneLabel: "Reception",
  email: "",
  initialAdminEmail: "",
  lat: "",
  lng: "",
  platformFeePercent: "10",
  is24Hours: true,
  openTime: "08:00",
  closeTime: "17:00"
};

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
  address: form.address.trim(),
  county: form.county.trim(),
  phones: [
    {
      phone: form.phone.trim(),
      label: form.phoneLabel.trim() || null,
      isPrimary: true
    }
  ],
  email: form.email.trim(),
  initialAdminEmail: form.initialAdminEmail.trim(),
  lat: parseOptionalNumber(form.lat),
  lng: parseOptionalNumber(form.lng),
  operatingHours: buildOperatingHours(form),
  platformFeePercent: Number(form.platformFeePercent)
});

const validateCreateForm = (form: CreateFormState): string | null => {
  if (!form.name.trim() || !form.address.trim() || !form.county.trim() || !form.email.trim()) {
    return "Name, address, county, and facility email are required.";
  }
  if (!form.phone.trim()) {
    return "At least one facility phone number is required.";
  }
  if (!form.initialAdminEmail.trim()) {
    return "Initial admin email is required.";
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
  if ((form.lat.trim() && lat === undefined) || (lat !== undefined && (lat < -90 || lat > 90))) {
    return "Latitude must be a number between -90 and 90.";
  }
  if ((form.lng.trim() && lng === undefined) || (lng !== undefined && (lng < -180 || lng > 180))) {
    return "Longitude must be a number between -180 and 180.";
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
  onAssignAdmin
}: {
  facility: Facility;
  canManageFacilities: boolean;
  canManageAdmins: boolean;
  onStatus: (facility: Facility, status: FacilityStatus) => void;
  onOpen: (facility: Facility) => void;
  onAssignAdmin: (facility: Facility) => void;
}) => {
  const primaryPhone = facility.phones.find((phone) => phone.isPrimary) ?? facility.phones[0];
  const serviceCount = facility.services.filter((service) => service.active).length;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-slate-900">{facility.name}</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[facility.status]}`}>
              {formatLabel(facility.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{formatLabel(facility.facilityType)} in {facility.county}</p>
          <p className="mt-1 text-sm text-slate-500">{facility.address}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button size="sm" variant="outline" onClick={() => onOpen(facility)}>
            <VisibilityIcon fontSize="small" />
            Open
          </Button>
          {canManageFacilities && facility.status !== "active" && (
            <Button size="sm" variant="outline" onClick={() => onStatus(facility, "active")}>
              <CheckCircleIcon fontSize="small" />
              Approve
            </Button>
          )}
          {canManageFacilities && facility.status !== "pending" && (
            <Button size="sm" variant="outline" onClick={() => onStatus(facility, "pending")}>
              <MoreTimeIcon fontSize="small" />
              Pending
            </Button>
          )}
          {canManageFacilities && facility.status !== "suspended" && (
            <Button size="sm" variant="outline" onClick={() => onStatus(facility, "suspended")}>
              <BlockIcon fontSize="small" />
              Suspend
            </Button>
          )}
          {canManageAdmins && (
            <Button size="sm" variant="secondary" onClick={() => onAssignAdmin(facility)}>
              <PersonAddIcon fontSize="small" />
              Admin
            </Button>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Email</dt>
          <dd className="mt-1 break-words text-slate-800">{facility.email || "-"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Phone</dt>
          <dd className="mt-1 text-slate-800">{primaryPhone?.phone ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Services</dt>
          <dd className="mt-1 text-slate-800">{serviceCount} active</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">TYH fee</dt>
          <dd className="mt-1 text-slate-800">{facility.platformFeePercent}%</dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <dt className="text-xs font-semibold uppercase text-slate-500">Operating hours</dt>
          <dd className="mt-1 text-slate-800">{formatOperatingHoursSummary(facility.operatingHours)}</dd>
        </div>
      </dl>
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
  const [status, setStatus] = useState<FacilityStatus | "all">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateFormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusDialog, setStatusDialog] = useState<StatusDialogState | null>(null);
  const [adminDialog, setAdminDialog] = useState<AdminDialogState | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const facilitiesQuery = useQuery({
    queryKey: ["admin", "facilities", { status, search }],
    queryFn: () =>
      fetchFacilities({
        status: status === "all" ? undefined : status,
        search: search.trim() || undefined
      }),
    enabled: canReadFacilities
  });

  const facilities = useMemo(() => facilitiesQuery.data?.facilities ?? [], [facilitiesQuery.data?.facilities]);
  const visibleFacilities = useMemo(() => {
    const term = search.trim().toLowerCase();
    return facilities.filter((facility) => {
      const statusMatches = status === "all" || facility.status === status;
      if (!term) {
        return statusMatches;
      }
      const text = `${facility.name} ${facility.email} ${facility.county} ${facility.address}`.toLowerCase();
      return statusMatches && text.includes(term);
    });
  }, [facilities, search, status]);

  const metrics = useMemo(
    () => ({
      total: facilities.length,
      active: facilities.filter((facility) => facility.status === "active").length,
      pending: facilities.filter((facility) => facility.status === "pending").length,
      suspended: facilities.filter((facility) => facility.status === "suspended").length
    }),
    [facilities]
  );

  useEffect(() => {
    if (isCreateOpen) {
      setFormError(null);
    }
  }, [isCreateOpen]);

  const invalidateFacilities = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "facilities"] });
  };

  const createMutation = useMutation({
    mutationFn: createFacility,
    onSuccess: () => {
      invalidateFacilities();
      setIsCreateOpen(false);
      setForm(initialFormState);
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

  const adminMutation = useMutation({
    mutationFn: ({ facility, userId }: AdminDialogState) => assignFacilityAdmin(facility.id, userId.trim()),
    onSuccess: () => {
      invalidateFacilities();
      setAdminDialog(null);
      setMutationError(null);
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
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as FacilityStatus | "all")}
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

      {facilitiesQuery.isLoading ? (
        <Card>
          <Loading />
        </Card>
      ) : facilitiesQuery.isError ? (
        <Card>
          <p className="text-sm text-danger-600">{extractErrorMessage(facilitiesQuery.error)}</p>
        </Card>
      ) : visibleFacilities.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No facilities match the current filters.</p>
        </Card>
      ) : (
        <section className="grid gap-4">
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
              onAssignAdmin={(target) => {
                setMutationError(null);
                setAdminDialog({ facility: target, userId: "" });
              }}
            />
          ))}
        </section>
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
            <Input label="County" value={form.county} onChange={(event) => updateForm("county", event.target.value)} />
            <Input label="Facility email" type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
            <Input
              label="Primary phone"
              value={form.phone}
              onChange={(event) => updateForm("phone", event.target.value)}
              placeholder="+254..."
            />
            <Input label="Phone label" value={form.phoneLabel} onChange={(event) => updateForm("phoneLabel", event.target.value)} />
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
            <Input label="Latitude" value={form.lat} onChange={(event) => updateForm("lat", event.target.value)} />
            <Input label="Longitude" value={form.lng} onChange={(event) => updateForm("lng", event.target.value)} />
            <label className="md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Address</span>
              <textarea
                value={form.address}
                onChange={(event) => updateForm("address", event.target.value)}
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
              />
            </label>
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

      <Modal
        open={Boolean(adminDialog)}
        title="Assign admin ops"
        description={adminDialog ? `Assign an existing admin ops user to ${adminDialog.facility.name}.` : undefined}
        onClose={() => setAdminDialog(null)}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <Input
            label="Admin user ID"
            value={adminDialog?.userId ?? ""}
            onChange={(event) =>
              setAdminDialog((current) => (current ? { ...current, userId: event.target.value } : current))
            }
          />
          {mutationError && <p className="text-sm text-danger-600">{mutationError}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setAdminDialog(null)} disabled={adminMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={adminMutation.isPending}
              disabled={!adminDialog?.userId.trim()}
              onClick={() => {
                if (adminDialog) {
                  adminMutation.mutate(adminDialog);
                }
              }}
            >
              Assign admin
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FacilityManagementPage;
