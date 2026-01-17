import classNames from "classnames";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { Input } from "../../../../shared/components/Input";
import { Loading } from "../../../../shared/components/Loading";
import { Stepper } from "../../../../shared/components/Stepper";
import { StickyActionBar } from "../../../../shared/components/StickyActionBar";
import { useToast } from "../../../../shared/components/ToastProvider";
import { api } from "../../../../shared/libs/api";
import { buildFieldParams, reqType, svcCard, userAdminList } from "../../../../shared/libs/fieldInclude";

type Role = {
  id: string;
  key: string;
  name: string;
};

type SearchUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  roles?: Role[];
};

type Requirement = {
  id: string;
  label: string;
  key: string;
  input_type: string;
  is_active: boolean;
};

type ServiceOption = {
  id: string;
  name: string;
  key: string;
};

type ProviderPayload = {
  id: string;
  user_id: string;
  verified: boolean;
  is_available: boolean;
  can_emergency: boolean;
  daily_request_limit: number;
};

type ApplicationPayload = {
  id: string;
  status: string;
  items?: Array<{
    id: string;
    status: string;
    requirement_type?: { id: string };
  }>;
};

type WizardStep = 0 | 1 | 2 | 3;

const steps = [
  { title: "Identify provider", description: "Select an existing user or create a new one." },
  { title: "Attach requirements", description: "Pick checklist items needed for verification." },
  { title: "Assign services", description: "Allow the provider to deliver selected services." },
  { title: "Review & finish", description: "Confirm the setup before handing off." },
];

const fetchUsers = async (search: string) => {
  const params: Record<string, string> = {
    ...buildFieldParams(userAdminList),
    "page[size]": "10",
  };
  if (search.trim()) {
    params["filter[search]"] = search.trim();
  }
  const response = await api.get<{ data: SearchUser[] }>("/users", { params });
  return response.data.data;
};

const fetchRequirements = async (): Promise<Requirement[]> => {
  const response = await api.get<{ data: Requirement[] }>("/requirements", {
    params: buildFieldParams(reqType),
  });
  return response.data.data.filter((req) => req.is_active);
};

const fetchServices = async (): Promise<ServiceOption[]> => {
  const response = await api.get<{ data: ServiceOption[] }>("/services", {
    params: buildFieldParams(svcCard),
  });
  return response.data.data;
};

const ProviderOnboardingWizardPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>(0);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [newUser, setNewUser] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [dailyLimit, setDailyLimit] = useState<number>(0);
  const [canEmergency, setCanEmergency] = useState(false);
  const [provider, setProvider] = useState<ProviderPayload | null>(null);
  const [application, setApplication] = useState<ApplicationPayload | null>(null);
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["admin", "providers", "wizard", "users", searchTerm],
    queryFn: () => fetchUsers(searchTerm),
    enabled: mode === "existing" && Boolean(searchTerm.trim()),
  });

  const requirementsQuery = useQuery({
    queryKey: ["admin", "providers", "wizard", "requirements"],
    queryFn: fetchRequirements,
    staleTime: 60_000,
  });

  const servicesQuery = useQuery({
    queryKey: ["admin", "providers", "wizard", "services"],
    queryFn: fetchServices,
    staleTime: 60_000,
  });

  useEffect(() => {
    const handle = window.setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (usersQuery.isError) {
      toast.showToast({
        title: "Unable to search users",
        description: "Check your filters and try again.",
        variant: "error",
      });
    }
  }, [usersQuery.isError, toast]);

  useEffect(() => {
    if (requirementsQuery.isError) {
      toast.showToast({
        title: "Unable to load requirements",
        description: "Refresh the page or try again later.",
        variant: "error",
      });
    }
  }, [requirementsQuery.isError, toast]);

  useEffect(() => {
    if (servicesQuery.isError) {
      toast.showToast({
        title: "Unable to load services",
        description: "Refresh the page or try again later.",
        variant: "error",
      });
    }
  }, [servicesQuery.isError, toast]);

  useEffect(() => {
    if (application?.items) {
      const preset = application.items
        .map((item) => item.requirement_type?.id)
        .filter((value): value is string => Boolean(value));
      setSelectedRequirements(Array.from(new Set(preset)));
    }
    if (provider) {
      setDailyLimit(provider.daily_request_limit ?? 0);
      setCanEmergency(Boolean(provider.can_emergency));
    }
  }, [application?.items, provider]);

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        full_name: newUser.fullName.trim(),
        password: newUser.password,
        roles: ["provider"],
      };
      if (newUser.email.trim()) {
        payload.email = newUser.email.trim();
      }
      if (newUser.phone.trim()) {
        payload.phone = newUser.phone.trim();
      }
      const response = await api.post<{ data: SearchUser }>("/users", payload);
      return response.data.data;
    },
  });

  const bootstrapMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.post<{ data: { provider: ProviderPayload; application: ApplicationPayload } }>(
        `/providers/${userId}/bootstrap`,
      );
      return response.data.data;
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: async (payload: { userId: string; dailyLimit: number; canEmergency: boolean }) => {
      await api.patch(`/providers/${payload.userId}`, {
        daily_request_limit: payload.dailyLimit,
        can_emergency: payload.canEmergency,
      });
    },
  });

  const attachRequirementMutation = useMutation({
    mutationFn: async ({
      applicationId,
      requirementId,
    }: {
      applicationId: string;
      requirementId: string;
    }) => {
      const response = await api.post<{ data: { id: string; requirement_type?: { id: string } } }>(
        `/provider-applications/${applicationId}/requirements`,
        {
          requirement_type_id: requirementId,
        },
      );
      return response.data.data;
    },
  });

  const setServicesMutation = useMutation({
    mutationFn: async ({ userId, services }: { userId: string; services: string[] }) => {
      await api.put(`/providers/${userId}/services`, services);
    },
  });

  const existingRequirementIds = useMemo(() => {
    if (!application?.items) {
      return new Set<string>();
    }
    return new Set(
      application.items
        .map((item) => item.requirement_type?.id)
        .filter((value): value is string => Boolean(value)),
    );
  }, [application]);

  const canProceed = (() => {
    switch (step) {
      case 0:
        if (mode === "existing") {
          return Boolean(selectedUser);
        }
        return Boolean(newUser.fullName.trim() && newUser.password && (newUser.email.trim() || newUser.phone.trim()));
      case 1:
        return Boolean(provider && application);
      case 2:
        return Boolean(provider && application);
      default:
        return Boolean(provider && application);
    }
  })();

  const handleStepAdvance = async () => {
    if (submitting) return;
    if (step === steps.length - 1) {
      if (provider) {
        navigate(`/admin/providers/${provider.user_id}`);
      } else {
        navigate("/admin/providers/directory");
      }
      return;
    }
    if (!provider && step > 0) {
      toast.showToast({
        title: "Complete identity step first",
        description: "Set up the provider before continuing.",
        variant: "warning",
      });
      return;
    }
    setSubmitting(true);
    try {
      if (step === 0) {
        let userRecord: SearchUser | null = selectedUser;
        if (mode === "new") {
          const user = await createUserMutation.mutateAsync();
          userRecord = user;
          toast.showToast({
            title: "User created",
            description: "Account created and assigned the provider role.",
            variant: "success",
          });
        }
        if (!userRecord) {
          throw new Error("Select a user before continuing.");
        }
        const bootstrap = await bootstrapMutation.mutateAsync(userRecord.id);
        setProvider(bootstrap.provider);
        setApplication(bootstrap.application);
        await updateProviderMutation.mutateAsync({
          userId: bootstrap.provider.user_id,
          dailyLimit,
          canEmergency,
        });
        setStep(1);
      } else if (step === 1 && provider && application) {
        const additions = selectedRequirements.filter((reqId) => !existingRequirementIds.has(reqId));
        const attachedItems = [];
        for (const requirementId of additions) {
          const item = await attachRequirementMutation.mutateAsync({
            applicationId: application.id,
            requirementId,
          });
          attachedItems.push(item);
        }
        if (additions.length > 0) {
          setApplication((prev) =>
            prev
              ? {
                  ...prev,
                  items: [...(prev.items ?? []), ...attachedItems],
                }
              : prev,
          );
          toast.showToast({
            title: "Requirements added",
            description: `${additions.length} requirement(s) attached to the application.`,
            variant: "success",
          });
          queryClient.invalidateQueries({ queryKey: ["admin", "provider", provider.user_id, "application"] });
        }
        setStep(2);
      } else if (step === 2 && provider) {
        await setServicesMutation.mutateAsync({ userId: provider.user_id, services: selectedServices });
        toast.showToast({
          title: "Services updated",
          description: "Service membership saved for the provider.",
          variant: "success",
        });
        queryClient.invalidateQueries({ queryKey: ["admin", "provider", provider.user_id] });
        queryClient.invalidateQueries({ queryKey: ["admin", "providers", "list"] });
        setStep(3);
      } else {
        setStep((previous) => (previous + 1) as WizardStep);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not complete the action.";
      toast.showToast({
        title: "Action failed",
        description: message,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 0) {
      navigate("/admin/providers/directory");
      return;
    }
    setStep((previous) => (previous - 1) as WizardStep);
  };

  const userList = usersQuery.data ?? [];
  const requirements = requirementsQuery.data ?? [];
  const services = servicesQuery.data ?? [];

  const renderStepContent = () => {
    if (step === 0) {
      return (
        <Card title="Provider identity" description="Choose an existing user or create a new provider account.">
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant={mode === "existing" ? "primary" : "secondary"}
              onClick={() => setMode("existing")}
            >
              Use existing user
            </Button>
            <Button
              type="button"
              variant={mode === "new" ? "primary" : "secondary"}
              onClick={() => {
                setMode("new");
                setSelectedUser(null);
              }}
            >
              Create new user
            </Button>
          </div>

          {mode === "existing" ? (
            <div className="mt-6 space-y-4">
              <Input
                label="Search users"
                placeholder="Search by name, email, or phone"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {usersQuery.isLoading && <Loading />}
              {!usersQuery.isLoading && (
                <ul className="space-y-2">
                  {userList.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                      Start typing to find a user.
                    </li>
                  ) : (
                    userList.map((user) => {
                      const hasProviderRole = user.roles?.some((role) => role.key === "provider");
                      return (
                        <li key={user.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedUser(user)}
                            className={classNames(
                              "w-full rounded-xl border px-4 py-3 text-left transition",
                              selectedUser?.id === user.id
                                ? "border-primary-500 bg-primary-50"
                                : "border-slate-200 bg-white hover:border-primary-300",
                            )}
                          >
                            <p className="text-sm font-semibold text-slate-900">
                              {user.full_name || user.email || user.phone}
                            </p>
                            <p className="text-xs text-slate-500">{user.email || user.phone || "No email/phone"}</p>
                            {!hasProviderRole && (
                              <p className="mt-1 text-xs text-amber-600">
                                This user does not currently have the provider role.
                              </p>
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <Input
                label="Full name"
                placeholder="Jane Mwangi"
                value={newUser.fullName}
                onChange={(event) => setNewUser((prev) => ({ ...prev, fullName: event.target.value }))}
              />
              <Input
                label="Email"
                placeholder="jane@example.com"
                value={newUser.email}
                onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
              />
              <Input
                label="Phone"
                placeholder="+2547..."
                value={newUser.phone}
                onChange={(event) => setNewUser((prev) => ({ ...prev, phone: event.target.value }))}
              />
              <Input
                label="Temporary password"
                type="password"
                value={newUser.password}
                onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Daily request limit
              <input
                type="number"
                min={0}
                value={dailyLimit}
                onChange={(event) => setDailyLimit(Number(event.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={canEmergency}
                onChange={(event) => setCanEmergency(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Provider can respond to emergencies
            </label>
          </div>
        </Card>
      );
    }

    if (step === 1) {
      if (requirementsQuery.isLoading) {
        return (
          <Card>
            <Loading />
          </Card>
        );
      }
      if (requirementsQuery.isError) {
        return (
          <Card>
            <p className="text-sm text-rose-600">Requirements could not be loaded.</p>
          </Card>
        );
      }
      return (
        <Card
          title="Attach requirements"
          description="Select requirements for the provider to complete. Existing items are already checked."
        >
          <ul className="space-y-3">
            {requirements.map((requirement) => {
              const selected = selectedRequirements.includes(requirement.id);
              return (
                <li
                  key={requirement.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{requirement.label}</p>
                    <p className="text-xs text-slate-500">{requirement.key}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        setSelectedRequirements((prev) =>
                          event.target.checked ? [...prev, requirement.id] : prev.filter((id) => id !== requirement.id),
                        );
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    Include
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>
      );
    }

    if (step === 2) {
      if (servicesQuery.isLoading) {
        return (
          <Card>
            <Loading />
          </Card>
        );
      }
      if (servicesQuery.isError) {
        return (
          <Card>
            <p className="text-sm text-rose-600">Services could not be loaded.</p>
          </Card>
        );
      }
      return (
        <Card title="Assign services" description="Choose the services this provider can deliver.">
          <ul className="space-y-3">
            {services.map((service) => {
              const selected = selectedServices.includes(service.id);
              return (
                <li
                  key={service.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                    <p className="text-xs text-slate-500">{service.key}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        setSelectedServices((prev) =>
                          event.target.checked ? [...prev, service.id] : prev.filter((id) => id !== service.id),
                        );
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    Assigned
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>
      );
    }

    return (
      <Card title="Review setup" description="Double-check details before finalising the onboarding.">
        <div className="space-y-4 text-sm text-slate-600">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Provider</p>
            <p className="text-base font-semibold text-slate-900">
              {selectedUser?.full_name || selectedUser?.email || selectedUser?.phone || newUser.fullName}
            </p>
            <p>
              Daily limit: <span className="font-semibold text-slate-900">{dailyLimit}</span> · Emergency capable:{" "}
              <span className="font-semibold text-slate-900">{canEmergency ? "Yes" : "No"}</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Requirements</p>
            <p className="font-semibold text-slate-900">{selectedRequirements.length} selected</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Services</p>
            <p className="font-semibold text-slate-900">{selectedServices.length} selected</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {provider && (
              <Button variant="ghost" type="button" onClick={() => navigate(`/admin/providers/${provider.user_id}`)}>
                Open provider detail
              </Button>
            )}
            {application && (
              <Button variant="ghost" type="button" onClick={() => navigate(`/admin/providers/applications`)}>
                View applications queue
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6 pb-24">
      <Card title="Provider onboarding wizard" description="Guide a new provider through the initial setup.">
        <Stepper steps={steps} current={step} />
        <p className="mt-4 text-sm text-slate-600">{steps[step]?.description}</p>
      </Card>

      {renderStepContent()}

      <StickyActionBar align="between">
        <div className="flex gap-2">
          <Button variant="secondary" type="button" onClick={handleBack} disabled={step === 0 || submitting}>
            Back
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleStepAdvance}
            disabled={!canProceed || submitting}
            loading={submitting}
          >
            {step === steps.length - 1 ? "Finish onboarding" : `Continue to ${steps[step + 1]?.title ?? "next step"}`}
          </Button>
        </div>
      </StickyActionBar>
    </div>
  );
};

export default ProviderOnboardingWizardPage;
