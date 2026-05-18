import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { DataGrid } from "../../../../shared/components/DataGrid";
import { FormField } from "../../../../shared/components/FormField";
import { Input } from "../../../../shared/components/Input";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import { api } from "../../../../shared/libs/api";
import { buildFieldParams, serviceCategoryAdmin } from "../../../../shared/libs/fieldInclude";

type ServiceCategory = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
};

type Envelope<T> = {
  data: T;
};

const categorySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().max(300, "Keep the description concise").optional().or(z.literal(""))
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const slugifyKey = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `category-${Date.now()}`;
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

export const ServiceCatalogPanel = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isFetching } = useCategoriesQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ServiceCategory | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting }
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: ""
    }
  });

  useEffect(() => {
    if (editing) {
      setValue("name", editing.name);
      setValue("description", editing.description ?? "");
    } else {
      reset();
    }
  }, [editing, reset, setValue]);

  const mutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const payload = {
        key: editing?.key ?? slugifyKey(values.name),
        name: values.name.trim(),
        description: values.description?.trim() || null
      };
      if (editing) {
        await api.patch(`/service-categories/${editing.id}`, payload);
      } else {
        await api.post("/service-categories", payload);
      }
    },
    onSuccess: () => {
      toast.showToast({
        title: editing ? "Category updated" : "Category created",
        description: "The service catalog has been refreshed.",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "service-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to save category",
        description: error instanceof Error ? error.message : "Check the form details and try again.",
        variant: "error"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (category: ServiceCategory) => {
      await api.delete(`/service-categories/${category.id}`);
      return category;
    },
    onMutate: async (category) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "service-categories"] });
      const previous = queryClient.getQueryData<ServiceCategory[]>(["admin", "service-categories"]);
      queryClient.setQueryData<ServiceCategory[]>(["admin", "service-categories"], (old) =>
        (old ?? []).filter((item) => item.id !== category.id)
      );
      return { previous };
    },
    onError: (error: unknown, _category, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin", "service-categories"], context.previous);
      }
      toast.showToast({
        title: "Unable to delete category",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "error"
      });
    },
    onSuccess: (_result, category) => {
      toast.showToast({
        title: "Category deleted",
        description: `${category.name} removed from catalog.`,
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "service-categories"] });
      setPendingDelete(null);
    }
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (category: ServiceCategory) => {
    setEditing(category);
    setModalOpen(true);
  };

  const confirmDelete = (category: ServiceCategory) => {
    setPendingDelete(category);
  };

  const rows = useMemo(
    () =>
      (data ?? []).map((category) => ({
        ...category,
        description: category.description || "—"
      })),
    [data]
  );

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  return (
    <div className="space-y-6">
      <Card
        title="Service categories"
        description="Organize services into manageable groups. Categories help providers navigate available offerings."
      >
        <div className="flex justify-end">
          <Button onClick={openCreate}>Create category</Button>
        </div>
      </Card>

      <Card title="Categories" padding="none">
        <DataGrid
          rows={rows}
          columns={[
            { field: "name", headerName: "Name", flex: 1.2, minWidth: 200 },
            { field: "key", headerName: "Key", flex: 1, minWidth: 160 },
            { field: "description", headerName: "Description", flex: 1.5, minWidth: 220 },
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
          ]}
          loading={isFetching || mutation.isLoading || deleteMutation.isLoading}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!mutation.isLoading) {
            setModalOpen(false);
            setEditing(null);
          }
        }}
        title={editing ? "Edit category" : "Create category"}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Input {...field} label="Name" placeholder="Nursing" error={fieldState.error?.message} />
            )}
          />
          <FormField
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label="Description"
                placeholder="Hands-on medical support delivered at home."
                error={fieldState.error?.message}
              />
            )}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? "Save changes" : "Create category"}
            </Button>
          </div>
          {editing && (
            <p className="text-xs text-slate-500">
              Key: <code>{editing.key}</code>. Keys now auto-generate from the category name for new entries.
            </p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete category"
        description="This category will be hidden for all users. Delete only if services are already reassigned."
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

const CatalogPage = () => <ServiceCatalogPanel />;

export default CatalogPage;
