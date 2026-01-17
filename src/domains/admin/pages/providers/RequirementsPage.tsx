import classNames from "classnames";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { FormField } from "../../../../shared/components/FormField";
import { Input } from "../../../../shared/components/Input";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import { api } from "../../../../shared/libs/api";

type RequirementType = {
  id: string;
  key: string;
  label: string;
  input_type: string;
  is_universal: boolean;
  is_sensitive: boolean;
  is_active: boolean;
  display_order?: number | null;
};

type Envelope<T> = {
  data: T;
};

const requirementSchema = z.object({
  label: z.string().min(2, "Provide a descriptive label"),
  input_type: z.enum(["file", "image", "text"], { errorMap: () => ({ message: "Select an input type" }) }),
  is_universal: z.boolean().default(false),
  is_sensitive: z.boolean().default(false),
  is_active: z.boolean().default(true),
  display_order: z
    .number({ invalid_type_error: "Display order must be a number" })
    .int("Must be an integer")
    .min(0, "Must be zero or greater")
    .optional()
});

type RequirementFormValues = z.infer<typeof requirementSchema>;

const INPUT_TYPE_OPTIONS = [
  { value: "file", label: "File upload" },
  { value: "image", label: "Image upload" },
  { value: "text", label: "Text response" }
];

const useRequirementsQuery = () =>
  useQuery({
    queryKey: ["admin", "provider-requirements"],
    queryFn: async () => {
      const response = await api.get<Envelope<RequirementType[]>>("/requirements");
      return response.data.data;
    }
  });

export const ProviderRequirementsPanel = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useRequirementsQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RequirementType | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RequirementType | null>(null);
  const [filters, setFilters] = useState({ showInactive: false, showSensitive: false });
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const nextDisplayOrder = useMemo(() => {
    if (!data || data.length === 0) {
      return 0;
    }
    const maxOrder = Math.max(...data.map((requirement) => requirement.display_order ?? 0));
    return maxOrder + 1;
  }, [data]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting }
  } = useForm<RequirementFormValues>({
    resolver: zodResolver(requirementSchema),
    defaultValues: {
      label: "",
      input_type: "file",
      is_universal: false,
      is_sensitive: false,
      is_active: true,
      display_order: nextDisplayOrder
    }
  });

  useEffect(() => {
    if (isError) {
      toast.showToast({
        title: "Unable to load requirements",
        description: "Refresh the page or try again shortly.",
        variant: "error",
      });
    }
  }, [isError, toast]);

  useEffect(() => {
    if (editing) {
      setValue("label", editing.label);
      setValue("input_type", editing.input_type as RequirementFormValues["input_type"]);
      setValue("is_universal", Boolean(editing.is_universal));
      setValue("is_sensitive", Boolean(editing.is_sensitive));
      setValue("is_active", Boolean(editing.is_active));
      setValue("display_order", editing.display_order ?? nextDisplayOrder);
    } else {
      reset({
        label: "",
        input_type: "file",
        is_universal: false,
        is_sensitive: false,
        is_active: true,
        display_order: nextDisplayOrder
      });
    }
  }, [editing, reset, setValue, nextDisplayOrder]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const mutation = useMutation({
    mutationFn: async (values: RequirementFormValues) => {
      if (editing) {
        await api.patch(`/requirements/${editing.id}`, values);
      } else {
        await api.post("/requirements", values);
      }
    },
    onSuccess: () => {
      toast.showToast({
        title: editing ? "Requirement updated" : "Requirement created",
        description: "Provider onboarding requirements have been refreshed.",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-requirements"] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to save requirement",
        description: error instanceof Error ? error.message : "Check the form details and try again.",
        variant: "error"
      });
    }
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = useCallback((requirement: RequirementType) => {
    setEditing(requirement);
    setModalOpen(true);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (requirement: RequirementType) => {
      await api.delete(`/requirements/${requirement.id}`);
      return requirement;
    },
    onMutate: async (requirement) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "provider-requirements"] });
      const previous = queryClient.getQueryData<RequirementType[]>(["admin", "provider-requirements"]);
      queryClient.setQueryData<RequirementType[]>(["admin", "provider-requirements"], (old) =>
        (old ?? []).filter((item) => item.id !== requirement.id)
      );
      return { previous };
    },
    onError: (error: unknown, _requirement, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin", "provider-requirements"], context.previous);
      }
      toast.showToast({
        title: "Unable to delete requirement",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error"
      });
    },
    onSuccess: (_result, requirement) => {
      toast.showToast({
        title: "Requirement deleted",
        description: `${requirement.label} removed from onboarding.`,
        variant: "success"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-requirements"] });
      setPendingDelete(null);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ requirement, nextActive }: { requirement: RequirementType; nextActive: boolean }) => {
      await api.patch(`/requirements/${requirement.id}`, { is_active: nextActive });
    },
    onSuccess: (_, variables) => {
      toast.showToast({
        title: variables.nextActive ? "Requirement activated" : "Requirement archived",
        description: `${variables.requirement.label} has been ${variables.nextActive ? "re" : ""}activated.`,
        variant: "success"
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update status",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-requirements"] });
    }
  });
  const { mutate: toggleActive, isLoading: toggleActiveLoading } = toggleActiveMutation;

  const confirmDelete = useCallback((requirement: RequirementType) => {
    setPendingDelete(requirement);
  }, []);

  const metrics = useMemo(() => {
    const requirements = data ?? [];
    const total = requirements.length;
    const active = requirements.filter((req) => req.is_active).length;
    const inactive = total - active;
    const universal = requirements.filter((req) => req.is_universal).length;
    const sensitive = requirements.filter((req) => req.is_sensitive).length;
    return { total, active, inactive, universal, sensitive };
  }, [data]);

  const filteredRequirements = useMemo(() => {
    const requirements = [...(data ?? [])].sort((a, b) => {
      const orderDelta = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (orderDelta !== 0) {
        return orderDelta;
      }
      return a.label.localeCompare(b.label);
    });

    return requirements.filter((requirement) => {
      if (!filters.showInactive && !requirement.is_active) {
        return false;
      }
      if (!filters.showSensitive && requirement.is_sensitive) {
        return false;
      }
      if (searchTerm) {
        const haystack = `${requirement.label} ${requirement.key}`.toLowerCase();
        return haystack.includes(searchTerm);
      }
      return true;
    });
  }, [data, filters, searchTerm]);

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  const FilterChip = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "rounded-full border px-4 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        active
          ? "border-primary-500 bg-primary-50 text-primary-700"
          : "border-slate-300 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <Card
        title="Onboarding requirements"
        description="Define the evidence or inputs providers must submit. Universal requirements auto-populate in new applications."
      >
        <div className="flex flex-wrap justify-between gap-4">
          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{metrics.total}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Active</p>
              <p className="mt-1 text-xl font-semibold text-emerald-600">{metrics.active}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Universal</p>
              <p className="mt-1 text-xl font-semibold text-primary-600">{metrics.universal}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Sensitive</p>
              <p className="mt-1 text-xl font-semibold text-rose-600">{metrics.sensitive}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="sm:w-64">
              <Input
                label="Search"
                placeholder="Search label or key"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <Button type="button" onClick={openCreate} className="self-start">
              Create requirement
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip
            label="Show inactive"
            active={filters.showInactive}
            onClick={() => setFilters((prev) => ({ ...prev, showInactive: !prev.showInactive }))}
          />
          <FilterChip
            label="Show sensitive"
            active={filters.showSensitive}
            onClick={() => setFilters((prev) => ({ ...prev, showSensitive: !prev.showSensitive }))}
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`requirements-skeleton-${index}`} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : filteredRequirements.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No requirements match the selected filters.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRequirements.map((requirement) => (
            <div key={requirement.id} className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{requirement.label}</p>
                    <p className="text-xs text-slate-500">{requirement.key}</p>
                  </div>
                  <span
                    className={classNames(
                      "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                      requirement.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {requirement.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">{requirement.input_type}</span>
                  {requirement.is_universal && <span className="rounded-full bg-primary-100 px-2 py-0.5 text-primary-700">Universal</span>}
                  {requirement.is_sensitive && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Sensitive</span>}
                </div>
                <p className="text-xs text-slate-400">Display order: {requirement.display_order ?? 0}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(requirement)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleActive({ requirement, nextActive: !requirement.is_active })}
                  loading={toggleActiveLoading}
                >
                  {requirement.is_active ? "Make inactive" : "Activate"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => confirmDelete(requirement)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!mutation.isLoading) {
            setModalOpen(false);
            setEditing(null);
          }
        }}
        title={editing ? "Edit requirement" : "Create requirement"}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField
            control={control}
            name="label"
            render={({ field, fieldState }) => (
              <Input {...field} label="Label" placeholder="Proof of certification" error={fieldState.error?.message} />
            )}
          />
          <FormField
            control={control}
            name="input_type"
            render={({ field, fieldState }) => (
              <div>
                <label className="block text-sm font-medium text-slate-700">Input type</label>
                <select
                  {...field}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  {INPUT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldState.error?.message && <p className="mt-1 text-xs text-rose-600">{fieldState.error.message}</p>}
              </div>
            )}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={control}
              name="is_universal"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                  Universal requirement
                </label>
              )}
            />
            <FormField
              control={control}
              name="is_sensitive"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                  Contains sensitive data
                </label>
              )}
            />
          </div>
          <FormField
            control={control}
            name="is_active"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
                Active (available for new applications)
              </label>
            )}
          />
          <FormField
            control={control}
            name="display_order"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                type="number"
                label="Display order"
                placeholder="0"
                error={fieldState.error?.message}
                onChange={(event) => field.onChange(Number(event.target.value))}
              />
            )}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? "Save changes" : "Create requirement"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete requirement"
        description="Providers will no longer be asked to supply this document or field in new applications."
        confirmLabel="Delete"
        confirmVariant="secondary"
        loading={deleteMutation.isLoading}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
        onClose={() => {
          if (!deleteMutation.isLoading) {
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
};

const RequirementsPage = () => <ProviderRequirementsPanel />;

export default RequirementsPage;
