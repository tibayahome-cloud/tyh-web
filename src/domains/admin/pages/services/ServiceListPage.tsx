import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GridColDef } from "@mui/x-data-grid";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { DataGrid } from "../../../../shared/components/DataGrid";
import { FormField } from "../../../../shared/components/FormField";
import { Input } from "../../../../shared/components/Input";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import { api } from "../../../../shared/libs/api";
import { buildFieldParams, serviceCategoryAdmin, svcCard } from "../../../../shared/libs/fieldInclude";

type ServiceCategory = {
  id: string;
  key: string;
  name: string;
};

type Service = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  base_price_cents: number;
  default_estimate_minutes: number;
  is_emergency_capable: boolean;
  active: boolean;
  category?: {
    id: string;
    name: string;
  };
};

type Envelope<T> = {
  data: T;
};

const serviceSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().max(300).optional().or(z.literal("")),
  category_id: z.string().uuid("Select a category"),
  base_price: z
    .number({ invalid_type_error: "Price must be a number" })
    .min(0, "Price must be zero or greater"),
  default_estimate_minutes: z
    .number({ invalid_type_error: "Duration must be a number" })
    .int("Duration must be an integer")
    .min(1, "Duration must be at least 1 minute"),
  is_emergency_capable: z.boolean().default(false),
  active: z.boolean().default(true)
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

const slugifyKey = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `service-${Date.now()}`;
};

const useCategoriesQuery = () =>
  useQuery({
    queryKey: ["admin", "service-categories"],
    queryFn: async () => {
      const response = await api.get<Envelope<ServiceCategory[]>>("/service-categories", {
        params: buildFieldParams(serviceCategoryAdmin)
      });
      return response.data.data;
    }
  });

const useServicesQuery = (filters: { category: string; active: string }) =>
  useQuery({
    queryKey: ["admin", "services", filters],
    queryFn: async () => {
      const params: Record<string, string | boolean> = {
        ...buildFieldParams(svcCard)
      };
      if (filters.category && filters.category !== "all") {
        params["filter[category_id]"] = filters.category;
      }
      if (filters.active !== "all") {
        params["filter[active]"] = filters.active === "active" ? "true" : "false";
      }
      const response = await api.get<Envelope<Service[]>>("/services", { params });
      return response.data.data;
    }
  });

export const ServiceListPanel = () => {
  const [filters, setFilters] = useState({ category: "all", active: "active" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Service | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: categories } = useCategoriesQuery();
  const { data: services, isFetching } = useServicesQuery(filters);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      description: "",
      category_id: "",
      base_price: 0,
      default_estimate_minutes: 60,
      is_emergency_capable: false,
      active: true
    }
  });

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        description: editing.description ?? "",
        category_id: editing.category?.id ?? "",
        base_price: editing.base_price_cents / 100,
        default_estimate_minutes: editing.default_estimate_minutes,
        is_emergency_capable: editing.is_emergency_capable,
        active: Boolean(editing.active)
      });
    } else {
      reset({
        name: "",
        description: "",
        category_id: "",
        base_price: 0,
        default_estimate_minutes: 60,
        is_emergency_capable: false,
        active: true
      });
    }
  }, [editing, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ServiceFormValues) => {
      const { base_price, ...rest } = values;
      const payload = {
        ...rest,
        key: editing?.key ?? slugifyKey(values.name),
        base_price_cents: Math.round(base_price * 100),
        description: values.description || null
      };
      if (editing) {
        await api.patch(`/services/${editing.id}`, payload);
      } else {
        await api.post("/services", payload);
      }
    },
    onSuccess: () => {
      toast.showToast({
        title: editing ? "Service updated" : "Service created",
        description: "Catalog entries refreshed successfully.",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "services"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to save service",
        description: error instanceof Error ? error.message : "Check the details and try again.",
        variant: "error"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (service: Service) => {
      await api.delete(`/services/${service.id}`);
      return service;
    },
    onMutate: async (service) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "services", filters] });
      const previous = queryClient.getQueryData<Service[]>(["admin", "services", filters]);
      queryClient.setQueryData<Service[]>(["admin", "services", filters], (old) =>
        (old ?? []).filter((item) => item.id !== service.id)
      );
      return { previous };
    },
    onError: (error: unknown, _service, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin", "services", filters], context.previous);
      }
      toast.showToast({
        title: "Unable to delete service",
        description: error instanceof Error ? error.message : "Please try again shortly.",
        variant: "error"
      });
    },
    onSuccess: (_result, service) => {
      toast.showToast({
        title: "Service deleted",
        description: `${service.name} removed from the catalog.`,
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "services"] });
      setPendingDelete(null);
    }
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setModalOpen(true);
  };

  const confirmDelete = (service: Service) => {
    setPendingDelete(service);
  };

  const rows = useMemo(() => {
    if (!services) {
      return [];
    }
    return services.map((service) => ({
      ...service,
      price: (service.base_price_cents / 100).toLocaleString(undefined, { style: "currency", currency: "KES" }),
      duration: `${service.default_estimate_minutes} min`,
      emergency: service.is_emergency_capable ? "Yes" : "No",
      activeStatus: service.active ? "Active" : "Inactive",
      categoryName: service.category?.name ?? "Unassigned"
    }));
  }, [services]);

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  const columns: GridColDef[] = [
    { field: "name", headerName: "Service", flex: 1.2, minWidth: 220 },
    { field: "key", headerName: "Key", minWidth: 160 },
    { field: "categoryName", headerName: "Category", flex: 1, minWidth: 180 },
    { field: "price", headerName: "Base price", minWidth: 140 },
    { field: "duration", headerName: "Duration", minWidth: 130 },
    { field: "emergency", headerName: "Emergency", minWidth: 120 },
    { field: "activeStatus", headerName: "Status", minWidth: 120 },
    {
      field: "actions",
      headerName: "",
      minWidth: 160,
      sortable: false,
      renderCell: (params) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(params.row)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => confirmDelete(params.row)}>
            Delete
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Card
        title="Services"
        description="Maintain the service catalog, set pricing defaults, and control availability with a single view."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600" htmlFor="service-category-filter">
              Category
            </label>
            <select
              id="service-category-filter"
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="all">All categories</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600" htmlFor="service-status-filter">
              Status
            </label>
            <select
              id="service-status-filter"
              value={filters.active}
              onChange={(event) => setFilters((prev) => ({ ...prev, active: event.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <Button onClick={openCreate}>Create service</Button>
        </div>
      </Card>

      <Card title="Catalog" padding="none">
        <DataGrid rows={rows} columns={columns} loading={isFetching || mutation.isPending || deleteMutation.isPending} />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!mutation.isPending) {
            setModalOpen(false);
            setEditing(null);
          }
        }}
        title={editing ? "Edit service" : "Create service"}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                value={field.value as string}
                label="Name"
                placeholder="Post-operative wound care"
                error={fieldState.error?.message}
              />
            )}
          />
          <FormField
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                value={field.value as string}
                label="Description"
                placeholder="Short summary of the service"
                error={fieldState.error?.message}
              />
            )}
          />
          <FormField
            control={control}
            name="category_id"
            render={({ field, fieldState }) => (
              <div>
                <label className="block text-sm font-medium text-slate-700">Category</label>
                <select
                  {...field}
                  value={field.value as string}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select category</option>
                  {categories?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {fieldState.error?.message && <p className="mt-1 text-xs text-rose-600">{fieldState.error.message}</p>}
              </div>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="base_price"
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  type="number"
                  step="0.01"
                  min="0"
                  label="Base price (KES)"
                  placeholder="5000"
                  error={fieldState.error?.message}
                  value={field.value as number}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                />
              )}
            />
            <FormField
              control={control}
              name="default_estimate_minutes"
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  type="number"
                  label="Default duration (minutes)"
                  placeholder="60"
                  error={fieldState.error?.message}
                  value={field.value as number}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                />
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="is_emergency_capable"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                  Emergency capable
                </label>
              )}
            />
            <FormField
              control={control}
              name="active"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                  Active service
                </label>
              )}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              disabled={isSubmitting || mutation.isPending}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              {editing ? "Save changes" : "Create service"}
            </Button>
          </div>
          {editing && (
            <p className="text-xs text-slate-500">
              Key: <code>{editing.key}</code>. New services auto-generate keys from their names.
            </p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete service"
        description="This service will no longer appear in the catalog for providers or clients."
        confirmLabel="Delete"
        confirmVariant="secondary"
        loading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
};

const ServiceListPage = () => <ServiceListPanel />;

export default ServiceListPage;
