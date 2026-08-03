import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/PersonAddAltOutlined";
import SearchIcon from "@mui/icons-material/SearchOutlined";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { fetchFacilities, fetchFacilityProviders, fetchFacilityServices, createFacilityProvider } from "../../../../shared/libs/facilities";

const FacilityProvidersPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"employee" | "fixed" | "percentage">("employee");
  const [fixedPayout, setFixedPayout] = useState("");
  const [percentage, setPercentage] = useState("");
  const [financialsVisible, setFinancialsVisible] = useState<boolean | null>(null);
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
  const createMutation = useMutation({
    mutationFn: () => createFacilityProvider(facilityId as string, {
      fullName,
      email: email || undefined,
      phone: phone || undefined,
      serviceIds,
      invitationChannel: email ? "email" : "sms",
      compensation: {
        mode,
        fixedPayoutCents: mode === "fixed" ? Math.round(Number(fixedPayout) * 100) : null,
        payoutPercentage: mode === "percentage" ? Number(percentage) : null
      },
      providerFinancialsVisible: financialsVisible
    }),
    onSuccess: () => {
      setShowForm(false);
      setFullName(""); setEmail(""); setPhone(""); setServiceIds([]);
      void queryClient.invalidateQueries({ queryKey: ["admin", "facility-providers", facilityId] });
    }
  });
  const services = useMemo(() => servicesQuery.data?.filter((service) => service.active) ?? [], [servicesQuery.data]);

  if (facilitiesQuery.isLoading || providersQuery.isLoading) return <Loading fullHeight />;
  if (!facilityId) return <Card title="Providers" description="Your admin.ops account is not linked to exactly one facility." />;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-tiba-blue">Facility operations</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Providers</h1><p className="mt-1 text-sm text-slate-500">Manage the providers assigned to this facility.</p></div>
        <Button size="sm" onClick={() => setShowForm((value) => !value)}><AddIcon fontSize="small" />{showForm ? "Close form" : "Add provider"}</Button>
      </div>

      {showForm && <Card title="Add provider" subtitle="The provider will receive a one-time password setup invitation.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Phone" placeholder="+254..." value={phone} onChange={(event) => setPhone(event.target.value)} />
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700"><span>Compensation</span><select className="rounded-xl border border-slate-200 bg-white px-4 py-3" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="employee">Employee</option><option value="fixed">Fixed amount</option><option value="percentage">Percentage</option></select></label>
          {mode === "fixed" && <Input label="Fixed payout (KES)" type="number" value={fixedPayout} onChange={(event) => setFixedPayout(event.target.value)} />}
          {mode === "percentage" && <Input label="Provider percentage" type="number" min="0" max="100" value={percentage} onChange={(event) => setPercentage(event.target.value)} />}
        </div>
        <div className="mt-4"><p className="mb-2 text-sm font-semibold text-slate-700">Facility services</p><div className="grid gap-2 sm:grid-cols-2">{services.map((service) => <label key={service.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={serviceIds.includes(service.serviceId)} onChange={() => setServiceIds((current) => current.includes(service.serviceId) ? current.filter((id) => id !== service.serviceId) : [...current, service.serviceId])} />{service.service?.name ?? "Service"}</label>)}</div></div>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={financialsVisible === true} onChange={(event) => setFinancialsVisible(event.target.checked ? true : false)} />Show financial details to this provider</label>
        <Button className="mt-5" loading={createMutation.isPending} disabled={!fullName || (!email && !phone)} onClick={() => createMutation.mutate()}><AddIcon fontSize="small" />Create provider</Button>
      </Card>}

      <Card title="Facility providers" subtitle={`${providersQuery.data?.providers.length ?? 0} shown`}>
        <div className="relative mb-4"><SearchIcon className="absolute left-3 top-3 text-slate-400" fontSize="small" /><Input aria-label="Search providers" className="pl-10" placeholder="Search by name or contact" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="divide-y divide-slate-100">{providersQuery.data?.providers.map((provider) => <div key={provider.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">{provider.user?.fullName ?? "Unnamed provider"}</p><p className="text-sm text-slate-500">{provider.user?.email ?? provider.user?.phone ?? "No contact"}</p></div><div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-lg bg-slate-100 px-2 py-1">{provider.verified ? "Verified" : "Pending verification"}</span><span className="rounded-lg bg-slate-100 px-2 py-1">{provider.isAvailable ? "Available" : "Unavailable"}</span><span className="rounded-lg bg-slate-100 px-2 py-1">{provider.financialsVisible === null ? "Facility default" : provider.financialsVisible ? "Financials visible" : "Financials hidden"}</span></div></div>)}</div>
      </Card>
    </div>
  );
};

export default FacilityProvidersPage;
