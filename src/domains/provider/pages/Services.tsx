import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { Loading } from "../../../shared/components/Loading";
import ConfirmDialog from "../../../shared/components/ConfirmDialog";
import { Input } from "../../../shared/components/Input";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useProviderProfile } from "../hooks/useProviderProfile";
import { api } from "../../../shared/libs/api";
import { buildFieldParams, svcCard } from "../../../shared/libs/fieldInclude";
import { useToast } from "../../../shared/components/ToastProvider";

type Service = {
  id: string;
  key: string;
  name: string;
  base_price_cents: number;
  default_estimate_minutes: number;
  is_emergency_capable: boolean;
  active: boolean;
  category?: {
    id: string;
    name: string;
  };
};

type ProviderService = {
  id: string;
  service_id: string;
  active: boolean;
};

type Envelope<T> = {
  data: T;
};

const useServiceCatalog = () =>
  useQuery({
    queryKey: ["provider", "catalog"],
    queryFn: async () => {
      const params = buildFieldParams(svcCard);
      const response = await api.get<Envelope<Service[]>>("/services", { params });
      return response.data.data.filter((service) => service.active);
    }
  });

const useProviderServices = (userId: string | undefined) =>
  useQuery({
    queryKey: ["provider", "services", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return [] as ProviderService[];
      }
      const response = await api.get<Envelope<ProviderService[]>>(`/providers/${userId}/services`);
      return response.data.data;
    }
  });

const ServicesPage = () => {
  const { user } = useAuth();
  const { data: profile } = useProviderProfile(user?.id);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: catalog, isLoading: loadingCatalog } = useServiceCatalog();
  const { data: membership, isLoading: loadingMembership } = useProviderServices(user?.id);

  const [selected, setSelected] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    | {
        type: "save" | "reset";
        message: string;
        confirmLabel: string;
      }
    | null
  >(null);

  useEffect(() => {
    if (membership) {
      setSelected(membership.map((item) => item.service_id));
      setHasChanges(false);
    }
  }, [membership]);

  const groupedServices = useMemo(() => {
    const groups: Record<string, { name: string; items: Service[] }> = {};
    const filtered = (catalog ?? []).filter((service) =>
      service.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );
    filtered.forEach((service) => {
      const categoryName = service.category?.name ?? "General";
      if (!groups[categoryName]) {
        groups[categoryName] = { name: categoryName, items: [] };
      }
      groups[categoryName].items.push(service);
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, searchTerm]);

  const toggleService = (serviceId: string) => {
    if (!profile?.verified) {
      return;
    }
    setSelected((prev) => {
      setHasChanges(true);
      return prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId];
    });
  };

  const updateMutation = useMutation({
    mutationFn: async (services: string[]) => {
      if (!user?.id) {
        throw new Error("Missing provider id");
      }
      await api.put(`/providers/${user.id}/services`, services);
    },
    onSuccess: () => {
      toast.showToast({
        title: "Services updated",
        description: "Your offerings are up to date.",
        variant: "success"
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["provider", "services", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update services",
        description: error instanceof Error ? error.message : "Try again soon.",
        variant: "error"
      });
    }
  });

  if (loadingCatalog || loadingMembership || !catalog) {
    return <Loading fullHeight />;
  }

  const infoCopy =
    "Select the services you can deliver. Verified providers can adjust these anytime to control which jobs they receive.";

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">Services</h1>
            <button
              type="button"
              className="text-slate-500 transition hover:text-primary-600"
              title={infoCopy}
              aria-label="Service selection info"
            >
              <InfoOutlinedIcon fontSize="small" />
            </button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Input
              label="Search"
              placeholder="Search services"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  setConfirmAction({
                    type: "reset",
                    message: "Revert to your previously saved service list?",
                    confirmLabel: "Reset"
                  })
                }
                disabled={!membership || updateMutation.isLoading || !profile?.verified}
              >
                Reset
              </Button>
              <Button
                onClick={() =>
                  setConfirmAction({
                    type: "save",
                    message: "Save your updated service selections?",
                    confirmLabel: "Save"
                  })
                }
                disabled={!hasChanges || !profile?.verified}
                loading={updateMutation.isLoading}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
        {!profile?.verified && (
          <p className="text-xs font-semibold text-amber-600">Verification required to change services.</p>
        )}
      </Card>

      {groupedServices.map((group) => (
        <Card key={group.name} title={group.name} padding="default">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((service) => {
              const active = selected.includes(service.id);
              return (
                <div
                  key={service.id}
                  className={`flex flex-col rounded-2xl border p-4 text-left shadow-sm transition ${
                    active ? "border-primary-400 bg-primary-50" : "border-slate-200 bg-white"
                  } ${!profile?.verified ? "cursor-not-allowed opacity-60" : "hover:shadow-md"}`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{service.name}</h3>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {`KES ${(service.base_price_cents / 100).toLocaleString()} · ${service.default_estimate_minutes} mins`}
                  </p>
                  {service.is_emergency_capable && (
                    <p className="mt-2 text-xs font-semibold text-emerald-600">Emergency capable</p>
                  )}
                  <div className="mt-4">
                    {active ? (
                      <Button
                        variant="secondary"
                        className="w-full"
                        disabled={!profile?.verified}
                        onClick={() => toggleService(service.id)}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button className="w-full" disabled={!profile?.verified} onClick={() => toggleService(service.id)}>
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title="Confirm changes"
        description={confirmAction?.message}
        confirmLabel={confirmAction?.confirmLabel ?? "Confirm"}
        onConfirm={() => {
          if (!confirmAction) {
            return;
          }
          if (confirmAction.type === "save") {
            updateMutation.mutate(selected);
          } else if (confirmAction.type === "reset" && membership) {
            setSelected(membership.map((item) => item.service_id));
            setHasChanges(false);
          }
          setConfirmAction(null);
        }}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default ServicesPage;
