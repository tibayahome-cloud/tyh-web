import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/PersonAddAltOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import SearchIcon from "@mui/icons-material/SearchOutlined";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { getApiError } from "../../../../shared/utils/errors";
import {
  createFacilityProvider,
  fetchFacilities,
  fetchFacilityProviders,
  fetchFacilityServices,
  updateFacilityProvider,
  updateFacilityProviderLifecycle
} from "../../../../shared/libs/facilities";
import {
  fetchTelemedicineAdminServices,
  fetchTelemedicineSubcategories,
  type TelemedicineCatalogService,
  type TelemedicineSubcategory
} from "../../../../shared/libs/telemedicineCatalog";
import type { Provider } from "../../../../shared/schemas/provider";
import type { ProviderCompensationMode } from "../../../../shared/schemas/facility";

type VisibilityChoice = "inherit" | "visible" | "hidden";

type ProviderForm = {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  serviceIds: string[];
  telemedicineSubcategoryIds: string[];
  mode: ProviderCompensationMode;
  fixedPayout: string;
  percentage: string;
  visibility: VisibilityChoice;
};

type ProviderLifecycleAction =
  | "verify"
  | "activate"
  | "suspend"
  | "available"
  | "unavailable"
  | "telemedicine_on"
  | "telemedicine_off";

// State chips previously all rendered bg-slate-100, so "pending" looked identical to
// "Verified" and there was no way to read a provider's state at a glance. Tones follow the
// palette already used by getBookingStatusTheme: green = on, amber = needs action,
// slate = deliberately off, rose = blocked. The label always states the value too, so the
// meaning never depends on colour alone.
const CHIP_TONES = {
  on: "bg-green-100 text-green-700",
  off: "bg-slate-100 text-slate-500",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-rose-100 text-rose-700"
} as const;

type ChipTone = keyof typeof CHIP_TONES;

export const accountStatusTone = (status?: string | null): ChipTone =>
  status === "active" ? "on" : status === "suspended" ? "suspended" : "pending";

const StatusChip = ({ tone, label }: { tone: ChipTone; label: string }) => (
  <span className={`rounded-lg px-2 py-1 ${CHIP_TONES[tone]}`}>{label}</span>
);

const emptyForm: ProviderForm = {
  fullName: "",
  email: "",
  phone: "",
  gender: "",
  serviceIds: [],
  telemedicineSubcategoryIds: [],
  mode: "employee",
  fixedPayout: "",
  percentage: "",
  visibility: "inherit"
};

const providerToForm = (provider: Provider): ProviderForm => ({
  fullName: provider.user?.fullName ?? "",
  email: provider.user?.email ?? "",
  phone: provider.user?.phone ?? "",
  gender: provider.gender ?? "",
  serviceIds: provider.services.map((service) => service.serviceId),
  telemedicineSubcategoryIds: provider.telemedicineSubcategoryAssignments
    .filter((assignment) => assignment.status === "active")
    .map((assignment) => assignment.subcategoryId),
  mode: provider.compensation.mode,
  fixedPayout: provider.compensation.fixedPayoutCents === null ? "" : String(provider.compensation.fixedPayoutCents / 100),
  percentage: provider.compensation.payoutPercentage === null ? "" : String(provider.compensation.payoutPercentage),
  visibility: provider.financialsVisible === null ? "inherit" : provider.financialsVisible ? "visible" : "hidden"
});

const ProviderFormFields = ({
  form,
  services,
  telemedicineSubcategories,
  onChange
}: {
  form: ProviderForm;
  services: Array<{ serviceId: string; service?: { name?: string | null } | null }>;
  telemedicineSubcategories: TelemedicineSubcategory[];
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

  const toggleTelemedicineSubcategory = (subcategoryId: string) => {
    onChange({
      ...form,
      telemedicineSubcategoryIds: form.telemedicineSubcategoryIds.includes(subcategoryId)
        ? form.telemedicineSubcategoryIds.filter((id) => id !== subcategoryId)
        : [...form.telemedicineSubcategoryIds, subcategoryId]
    });
  };

  const groupedSubcategories = useMemo(() => {
    const groups = new Map<string, { name: string; items: TelemedicineSubcategory[] }>();
    telemedicineSubcategories.forEach((subcategory) => {
      const category = subcategory.category;
      const key = category?.id ?? "uncategorized";
      const group = groups.get(key) ?? { name: category?.name ?? "Other", items: [] };
      group.items.push(subcategory);
      groups.set(key, group);
    });
    return Array.from(groups.values());
  }, [telemedicineSubcategories]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" value={form.fullName} onChange={(event) => onChange({ ...form, fullName: event.target.value })} required />
        <Input label="Email" type="email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
        <Input label="Phone" placeholder="+254..." value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} />
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span>Gender</span>
          <select className="rounded-xl border border-slate-200 bg-white px-4 py-3" value={form.gender} onChange={(event) => onChange({ ...form, gender: event.target.value })}>
            <option value="">Not specified</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
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

      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-slate-700">Telemedicine specialties</legend>
        <p className="mb-2 text-xs text-slate-500">Assign subcategories that this provider can handle remotely.</p>
        {groupedSubcategories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">No active telemedicine subcategories are available.</p>
        ) : (
          <div className="space-y-3">
            {groupedSubcategories.map((group) => (
              <div key={group.name}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.name}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.items.map((subcategory) => (
                    <label key={subcategory.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <input type="checkbox" checked={form.telemedicineSubcategoryIds.includes(subcategory.id)} onChange={() => toggleTelemedicineSubcategory(subcategory.id)} />
                      {subcategory.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
  const [lifecyclePendingKey, setLifecyclePendingKey] = useState<string | null>(null);

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
  const telemedicineSubcategoriesQuery = useQuery({
    queryKey: ["telemedicine", "catalog", "subcategories"],
    queryFn: () => fetchTelemedicineSubcategories(),
    enabled: Boolean(facilityId)
  });
  const telemedicineServicesQuery = useQuery<TelemedicineCatalogService[]>({
    queryKey: ["telemedicine", "catalog", "services"],
    queryFn: () => fetchTelemedicineAdminServices(),
    enabled: Boolean(facilityId)
  });
  const telemedicineServiceIds = useMemo(
    () => new Set((telemedicineServicesQuery.data ?? []).map((service) => service.id)),
    [telemedicineServicesQuery.data]
  );
  const services = useMemo(
    () => servicesQuery.data?.filter((service) => service.active && !telemedicineServiceIds.has(service.serviceId)) ?? [],
    [servicesQuery.data, telemedicineServiceIds]
  );
  const invalidateProviders = () => void queryClient.invalidateQueries({ queryKey: ["admin", "facility-providers", facilityId] });

  const createMutation = useMutation({
    mutationFn: () => createFacilityProvider(facilityId as string, {
      fullName: form.fullName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      gender: form.gender || null,
      serviceIds: form.serviceIds,
      telemedicineSubcategoryIds: form.telemedicineSubcategoryIds,
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
        gender: form.gender || null,
        serviceIds: form.serviceIds,
        telemedicineSubcategoryIds: form.telemedicineSubcategoryIds,
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
      action: ProviderLifecycleAction;
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
    onMutate: ({ provider, action }) => {
      setLifecyclePendingKey(`${provider.userId}:${action}`);
    },
    onSuccess: () => invalidateProviders(),
    onSettled: () => setLifecyclePendingKey(null)
  });

  const isLifecyclePending = (provider: Provider, action: ProviderLifecycleAction) =>
    lifecyclePendingKey === `${provider.userId}:${action}`;

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
          <ProviderFormFields form={form} services={services} telemedicineSubcategories={telemedicineSubcategoriesQuery.data ?? []} onChange={setForm} />
          {(createMutation.error || updateMutation.error) && (
            <p className="mt-4 text-sm text-danger-600">
              {getApiError(createMutation.error || updateMutation.error, "Unable to save provider")}
            </p>
          )}
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
            <div key={provider.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="font-semibold text-slate-900">{provider.user?.fullName ?? "Unnamed provider"}</p><p className="text-sm text-slate-500">{provider.user?.email ?? provider.user?.phone ?? "No contact"}</p><p className="mt-1 text-xs text-slate-500">{provider.services.length} services · {provider.telemedicineSubcategoryAssignments.length} remote specialties · {provider.compensation.mode} · {provider.financialsVisible === null ? "facility default" : provider.financialsVisible ? "financials visible" : "financials hidden"}</p></div>
              <div className="flex flex-col gap-2 sm:items-end">
                {/* State first, on its own line -- actions below, so the two never mix into one wrapped blob. */}
                <div className="flex flex-wrap gap-1.5 text-xs font-semibold sm:justify-end">
                  <StatusChip tone={accountStatusTone(provider.user?.status)} label={`Account ${provider.user?.status ?? "pending"}`} />
                  <StatusChip tone={provider.verified ? "on" : "pending"} label={provider.verified ? "Verified" : "Not verified"} />
                  <StatusChip tone={provider.isAvailable ? "on" : "off"} label={provider.isAvailable ? "Available" : "Unavailable"} />
                  <StatusChip tone={provider.telemedicineEnabled ? "on" : "off"} label={provider.telemedicineEnabled ? "Telemedicine on" : "Telemedicine off"} />
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {!provider.verified && <Button size="sm" variant="outline" loading={isLifecyclePending(provider, "verify")} onClick={() => lifecycleMutation.mutate({ provider, action: "verify" })}>Verify</Button>}
                  {provider.verified && provider.user?.status !== "active" && <Button size="sm" variant="outline" loading={isLifecyclePending(provider, "activate")} onClick={() => lifecycleMutation.mutate({ provider, action: "activate" })}>Activate</Button>}
                  {provider.user?.status !== "suspended" && <Button size="sm" variant="outline" loading={isLifecyclePending(provider, "suspend")} onClick={() => lifecycleMutation.mutate({ provider, action: "suspend" })}>Suspend</Button>}
                  <Button size="sm" variant="outline" loading={isLifecyclePending(provider, provider.isAvailable ? "unavailable" : "available")} onClick={() => lifecycleMutation.mutate({ provider, action: provider.isAvailable ? "unavailable" : "available" })}>{provider.isAvailable ? "Set unavailable" : "Set available"}</Button>
                  <Button size="sm" variant="outline" loading={isLifecyclePending(provider, provider.telemedicineEnabled ? "telemedicine_off" : "telemedicine_on")} onClick={() => lifecycleMutation.mutate({ provider, action: provider.telemedicineEnabled ? "telemedicine_off" : "telemedicine_on" })}>{provider.telemedicineEnabled ? "Disable telemedicine" : "Enable telemedicine"}</Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(provider)}><EditIcon fontSize="small" />Edit</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {lifecycleMutation.error && (
          <p className="mt-3 text-sm text-danger-600">
            {getApiError(lifecycleMutation.error, "Provider lifecycle update failed.")}
          </p>
        )}
      </Card>
    </div>
  );
};

export default FacilityProvidersPage;
