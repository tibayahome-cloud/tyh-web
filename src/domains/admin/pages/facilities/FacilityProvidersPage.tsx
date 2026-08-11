import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/PersonAddAltOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import SearchIcon from "@mui/icons-material/SearchOutlined";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import {
  createFacilityProvider,
  fetchFacilities,
  fetchFacilityProviders,
  fetchFacilityServices,
  updateFacilityProvider,
  updateFacilityProviderLifecycle
} from "../../../../shared/libs/facilities";
import type { Provider } from "../../../../shared/schemas/provider";
import type { ProviderCompensationMode } from "../../../../shared/schemas/facility";

type VisibilityChoice = "inherit" | "visible" | "hidden";

type ProviderForm = {
  fullName: string;
  email: string;
  phone: string;
  serviceIds: string[];
  mode: ProviderCompensationMode;
  fixedPayout: string;
  percentage: string;
  visibility: VisibilityChoice;
};

const emptyForm: ProviderForm = {
  fullName: "",
  email: "",
  phone: "",
  serviceIds: [],
  mode: "employee",
  fixedPayout: "",
  percentage: "",
  visibility: "inherit"
};

const providerToForm = (provider: Provider): ProviderForm => ({
  fullName: provider.user?.fullName ?? "",
  email: provider.user?.email ?? "",
  phone: provider.user?.phone ?? "",
  serviceIds: provider.services.map((service) => service.serviceId),
  mode: provider.compensation.mode,
  fixedPayout: provider.compensation.fixedPayoutCents === null ? "" : String(provider.compensation.fixedPayoutCents / 100),
  percentage: provider.compensation.payoutPercentage === null ? "" : String(provider.compensation.payoutPercentage),
  visibility: provider.financialsVisible === null ? "inherit" : provider.financialsVisible ? "visible" : "hidden"
});

const ProviderFormFields = ({
  form,
  services,
  onChange
}: {
  form: ProviderForm;
  services: Array<{ serviceId: string; service?: { name?: string | null } | null }>;
  onChange: (next: ProviderForm) => void;
}) => {
  const toggleService = (serviceId: string) => {
    onChange({
      ...form,
      serviceIds: form.serviceIds.includes(serviceId)
        ? form.serviceIds.filter((id) => id !== serviceId)
        : [...form.serviceIds, serviceId]
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" value={form.fullName} onChange={(event) => onChange({ ...form, fullName: event.target.value })} required />
        <Input label="Email" type="email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
        <Input label="Phone" placeholder="+254..." value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} />
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span>Compensation</span>
          <select className="rounded-xl border border-slate-200 bg-white px-4 py-3" value={form.mode} onChange={(event) => onChange({ ...form, mode: event.target.value as ProviderCompensationMode })}>
            <option value="employee">Employee</option>
            <option value="fixed">Fixed amount per service</option>
            <option value="percentage">Percentage of service</option>
          </select>
        </label>
        {form.mode === "fixed" && <Input label="Fixed payout (KES)" type="number" min="0" value={form.fixedPayout} onChange={(event) => onChange({ ...form, fixedPayout: event.target.value })} />}
        {form.mode === "percentage" && <Input label="Provider percentage" type="number" min="0" max="100" value={form.percentage} onChange={(event) => onChange({ ...form, percentage: event.target.value })} />}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Assigned facility services</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((service) => (
            <label key={service.serviceId} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={form.serviceIds.includes(service.serviceId)} onChange={() => toggleService(service.serviceId)} />
              {service.service?.name ?? "Service"}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <span>Financial visibility</span>
        <select className="rounded-xl border border-slate-200 bg-white px-4 py-3" value={form.visibility} onChange={(event) => onChange({ ...form, visibility: event.target.value as VisibilityChoice })}>
          <option value="inherit">Use facility default</option>
          <option value="visible">Visible to provider</option>
          <option value="hidden">Hidden from provider</option>
        </select>
      </label>
    </div>
  );
};

const FacilityProvidersPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  const facilitiesQuery = useQuery({ queryKey: ["admin", "facility-scope"], queryFn: () => fetchFacilities({ pageSize: 5 }) });
  const facilityId = facilitiesQuery.data?.facilities.length === 1 ? facilitiesQuery.data.facilities[0].id : undefined;
  const providersQuery = useQuery({
    queryKey: ["admin", "facility-providers", facilityId, search],
    queryFn: () => fetchFacilityProviders(facilityId as string, { search: search || undefined }),
    enabled: Boolean(facilityId)
  });
  const servicesQuery = useQuery({
    queryKey: ["admin", "facility-services", facilityId],
    queryFn: () => fetchFacilityServices(facilityId as string),
    enabled: Boolean(facilityId)
  });
  const services = useMemo(() => servicesQuery.data?.filter((service) => service.active) ?? [], [servicesQuery.data]);
  const invalidateProviders = () => void queryClient.invalidateQueries({ queryKey: ["admin", "facility-providers", facilityId] });

  const createMutation = useMutation({
    mutationFn: () => createFacilityProvider(facilityId as string, {
      fullName: form.fullName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      serviceIds: form.serviceIds,
      invitationChannel: form.email ? "email" : "sms",
      compensation: {
        mode: form.mode,
        fixedPayoutCents: form.mode === "fixed" ? Math.round(Number(form.fixedPayout) * 100) : null,
        payoutPercentage: form.mode === "percentage" ? Number(form.percentage) : null
      },
      providerFinancialsVisible: form.visibility === "inherit" ? null : form.visibility === "visible"
    }),
    onSuccess: () => {
      setShowForm(false);
      setForm(emptyForm);
      invalidateProviders();
    }
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingProvider) throw new Error("Provider selection is required");
      return updateFacilityProvider(facilityId as string, editingProvider.userId, {
        fullName: form.fullName,
        email: form.email || null,
        phone: form.phone || null,
        serviceIds: form.serviceIds,
        providerFinancialsVisible: form.visibility === "inherit" ? null : form.visibility === "visible",
        compensation: {
          mode: form.mode,
          fixedPayoutCents: form.mode === "fixed" ? Math.round(Number(form.fixedPayout) * 100) : null,
          payoutPercentage: form.mode === "percentage" ? Number(form.percentage) : null
        }
      });
    },
    onSuccess: () => {
      setEditingProvider(null);
      setForm(emptyForm);
      invalidateProviders();
    }
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({
      provider,
      action
    }: {
      provider: Provider;
      action: "verify" | "activate" | "suspend" | "available" | "unavailable" | "telemedicine_on" | "telemedicine_off";
    }) => {
      const input =
        action === "verify"
          ? { verified: true }
          : action === "activate"
            ? { status: "active" as const }
            : action === "suspend"
              ? { status: "suspended" as const }
              : action === "telemedicine_on" || action === "telemedicine_off"
                ? { telemedicineEnabled: action === "telemedicine_on" }
                : { isAvailable: action === "available" };
      return updateFacilityProviderLifecycle(facilityId as string, provider.userId, input);
    },
    onSuccess: () => invalidateProviders()
  });

  if (facilitiesQuery.isLoading || providersQuery.isLoading) return <Loading fullHeight />;
  if (!facilityId) return <Card title="Providers" description="Your admin.ops account is not linked to exactly one facility." />;

  const openCreate = () => {
    setEditingProvider(null);
    setForm(emptyForm);
    setShowForm((value) => !value);
  };
  const openEdit = (provider: Provider) => {
    setShowForm(false);
    setEditingProvider(provider);
    setForm(providerToForm(provider));
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-tiba-blue">Facility operations</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Providers</h1><p className="mt-1 text-sm text-slate-500">Manage providers, services, compensation, and financial visibility.</p></div>
        <Button size="sm" onClick={openCreate}><AddIcon fontSize="small" />{showForm ? "Close form" : "Add provider"}</Button>
      </div>

      {(showForm || editingProvider) && (
        <Card title={editingProvider ? "Edit provider" : "Add provider"} subtitle={editingProvider ? "Changes apply only to this facility provider." : "The provider will receive an invitation when an email is supplied."}>
          <ProviderFormFields form={form} services={services} onChange={setForm} />
          {(createMutation.error || updateMutation.error) && <p className="mt-4 text-sm text-danger-600">{(createMutation.error || updateMutation.error) instanceof Error ? (createMutation.error || updateMutation.error)?.message : "Request failed"}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingProvider(null); }}>Cancel</Button>
            <Button loading={createMutation.isPending || updateMutation.isPending} disabled={!form.fullName.trim() || (!form.email.trim() && !form.phone.trim())} onClick={() => editingProvider ? updateMutation.mutate() : createMutation.mutate()}>
              {editingProvider ? "Save provider" : "Create provider"}
            </Button>
          </div>
        </Card>
      )}

      <Card title="Facility providers" subtitle={`${providersQuery.data?.providers.length ?? 0} shown`}>
        <div className="relative mb-4"><SearchIcon className="absolute left-3 top-3 text-slate-400" fontSize="small" /><Input aria-label="Search providers" className="pl-10" placeholder="Search by name or contact" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="divide-y divide-slate-100">
          {providersQuery.data?.providers.map((provider) => (
            <div key={provider.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold text-slate-900">{provider.user?.fullName ?? "Unnamed provider"}</p><p className="text-sm text-slate-500">{provider.user?.email ?? provider.user?.phone ?? "No contact"}</p><p className="mt-1 text-xs text-slate-500">{provider.services.length} services · {provider.compensation.mode} · {provider.financialsVisible === null ? "facility default" : provider.financialsVisible ? "financials visible" : "financials hidden"}</p></div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-lg bg-slate-100 px-2 py-1">{provider.user?.status ?? "pending"}</span>
                <span className="rounded-lg bg-slate-100 px-2 py-1">{provider.verified ? "Verified" : "Pending verification"}</span>
                <span className="rounded-lg bg-slate-100 px-2 py-1">{provider.isAvailable ? "Available" : "Unavailable"}</span>
                <span className="rounded-lg bg-slate-100 px-2 py-1">{provider.telemedicineEnabled ? "Telemedicine on" : "Telemedicine off"}</span>
                {!provider.verified && <Button size="sm" variant="outline" loading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ provider, action: "verify" })}>Verify</Button>}
                {provider.verified && provider.user?.status !== "active" && <Button size="sm" variant="outline" loading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ provider, action: "activate" })}>Activate</Button>}
                {provider.user?.status !== "suspended" && <Button size="sm" variant="outline" loading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ provider, action: "suspend" })}>Suspend</Button>}
                <Button size="sm" variant="outline" loading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ provider, action: provider.isAvailable ? "unavailable" : "available" })}>{provider.isAvailable ? "Set unavailable" : "Set available"}</Button>
                <Button size="sm" variant="outline" loading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ provider, action: provider.telemedicineEnabled ? "telemedicine_off" : "telemedicine_on" })}>{provider.telemedicineEnabled ? "Disable telemedicine" : "Enable telemedicine"}</Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(provider)}><EditIcon fontSize="small" />Edit</Button>
              </div>
            </div>
          ))}
        </div>
        {lifecycleMutation.error && <p className="mt-3 text-sm text-danger-600">{lifecycleMutation.error instanceof Error ? lifecycleMutation.error.message : "Provider lifecycle update failed."}</p>}
      </Card>
    </div>
  );
};

export default FacilityProvidersPage;
