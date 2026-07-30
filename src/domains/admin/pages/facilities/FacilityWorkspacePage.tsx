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
  fetchFacility,
  fetchFacilityServices,
  updateFacility,
  updateFacilityService
} from "../../../../shared/libs/facilities";
import type { FacilityService, FacilityServiceInput } from "../../../../shared/schemas/facility";
import { formatOperatingHoursSummary } from "../../../../shared/schemas/facility";
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

const initialServiceForm: ServiceFormState = {
  serviceId: "",
  price: "",
  estimateDurationMinutes: "60",
  active: true,
  isEmergencyCapable: false
};

export const priceToCents = (value: string): number => Math.round(Number(value) * 100);

const centsToPrice = (value: number): string => String(value / 100);

const formatMoney = (cents: number, currency = "KES") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);

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

const mapServiceForm = (service: FacilityService): ServiceFormState => ({
  serviceId: service.serviceId,
  price: centsToPrice(service.priceCents),
  estimateDurationMinutes: String(service.estimateDurationMinutes ?? 60),
  active: service.active,
  isEmergencyCapable: service.isEmergencyCapable
});

const fetchCatalogServices = async (): Promise<CatalogService[]> => {
  const response = await api.get<Envelope<CatalogService[]>>("/services", {
    params: { "filter[active]": "true" }
  });
  return response.data.data;
};

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

const FacilityWorkspacePage = () => {
  const { facilityId } = useParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useRbac();
  const canReadFacilities = hasPermission("facility:read");
  const canManageFacility = hasPermission("facility:manage");
  const canManageServices = hasPermission("facility:services.manage");

  const [financialsVisible, setFinancialsVisible] = useState(true);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<FacilityService | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(initialServiceForm);
  const [serviceFormError, setServiceFormError] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<FacilityService | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

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

  const facility = facilityQuery.data;
  const facilityServices = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);

  useEffect(() => {
    if (facility) {
      setFinancialsVisible(facility.providerFinancialsVisible);
    }
  }, [facility]);

  const availableCatalogServices = useMemo(() => {
    const used = new Set(facilityServices.map((service) => service.serviceId));
    return (catalogQuery.data ?? []).filter((service) => editingService?.serviceId === service.id || !used.has(service.id));
  }, [catalogQuery.data, editingService?.serviceId, facilityServices]);

  const activeServiceCount = facilityServices.filter((service) => service.active).length;

  const invalidateWorkspace = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "facilities", facilityId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "facilities", facilityId, "services"] });
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
    </div>
  );
};

export default FacilityWorkspacePage;
