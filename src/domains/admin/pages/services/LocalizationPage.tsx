import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { FormField } from "../../../../shared/components/FormField";
import { Input } from "../../../../shared/components/Input";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import { api } from "../../../../shared/libs/api";
import { buildFieldParams, serviceWithLocales } from "../../../../shared/libs/fieldInclude";

type ServiceLocale = {
  id: string;
  locale: string;
  name: string;
  description?: string | null;
};

type Service = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  locales?: ServiceLocale[];
};

type Envelope<T> = {
  data: T;
};

const localeSchema = z.object({
  locale: z
    .string()
    .min(2, "Locale is required")
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Use locale format e.g. en or en-US"),
  name: z.string().min(2, "Provide the localized name"),
  description: z.string().max(300).optional().or(z.literal(""))
});

type LocaleFormValues = z.infer<typeof localeSchema>;

const useServiceLocalesQuery = () =>
  useQuery({
    queryKey: ["admin", "service-locales"],
    queryFn: async () => {
      const response = await api.get<Envelope<Service[]>>("/services", {
        params: buildFieldParams(serviceWithLocales)
      });
      return response.data.data;
    }
  });

export const ServiceLocalizationPanel = () => {
  const { data, isFetching } = useServiceLocalesQuery();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ServiceLocale | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const services = useMemo(() => data ?? [], [data]);
  const selectedService = useMemo(() => {
    if (!selectedServiceId && services.length > 0) {
      return services[0];
    }
    return services.find((service) => service.id === selectedServiceId) ?? services[0];
  }, [selectedServiceId, services]);

  useEffect(() => {
    if (services.length > 0 && !selectedServiceId) {
      setSelectedServiceId(services[0].id);
    }
  }, [services, selectedServiceId]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting }
  } = useForm<LocaleFormValues>({
    resolver: zodResolver(localeSchema),
    defaultValues: {
      locale: "",
      name: "",
      description: ""
    }
  });

  useEffect(() => {
    if (editing) {
      setValue("locale", editing.locale);
      setValue("name", editing.name);
      setValue("description", editing.description ?? "");
    } else {
      reset({ locale: "", name: "", description: "" });
    }
  }, [editing, reset, setValue]);

  const mutation = useMutation({
    mutationFn: async (values: LocaleFormValues) => {
      if (!selectedService) {
        throw new Error("Select a service first");
      }
      const payload = { ...values, description: values.description || null };
      if (editing) {
        await api.patch(`/services/${selectedService.id}/locales/${editing.locale}`, payload);
      } else {
        await api.post(`/services/${selectedService.id}/locales`, payload);
      }
    },
    onSuccess: () => {
      toast.showToast({
        title: editing ? "Locale updated" : "Locale added",
        description: "Localization updated across the catalog.",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "service-locales"] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to save locale",
        description: error instanceof Error ? error.message : "Check the fields and retry.",
        variant: "error"
      });
    }
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (locale: ServiceLocale) => {
    setEditing(locale);
    setModalOpen(true);
  };

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  return (
    <div className="space-y-6">
      <Card
        title="Service localization"
        description="Translate service names and descriptions to support multilingual experiences across the platform."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600" htmlFor="service-select">
              Service
            </label>
            <select
              id="service-select"
              value={selectedService?.id ?? ""}
              onChange={(event) => setSelectedServiceId(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={openCreate} disabled={!selectedService}>
            Add locale
          </Button>
        </div>
      </Card>

      <Card title="Locales">
        {isFetching && services.length === 0 ? (
          <p className="text-sm text-slate-600">Loading localization data…</p>
        ) : selectedService?.locales && selectedService.locales.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {selectedService.locales.map((locale) => (
              <div key={locale.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {locale.name}
                      <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">{locale.locale}</span>
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{locale.description || "No description"}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(locale)}>
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No locales configured yet. Add translations to enhance the experience.</p>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!mutation.isLoading) {
            setModalOpen(false);
            setEditing(null);
          }
        }}
        title={editing ? "Edit locale" : "Add locale"}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField
            control={control}
            name="locale"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label="Locale"
                placeholder="en"
                hint="Use ISO language code, e.g., en or sw"
                error={fieldState.error?.message}
                disabled={Boolean(editing)}
              />
            )}
          />
          <FormField
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Input {...field} label="Localized name" placeholder="Service name" error={fieldState.error?.message} />
            )}
          />
          <FormField
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label="Description"
                placeholder="Localized description"
                error={fieldState.error?.message}
              />
            )}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? "Save changes" : "Add locale"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const LocalizationPage = () => <ServiceLocalizationPanel />;

export default LocalizationPage;
