import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { Input } from "../../../../shared/components/Input";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import {
  createTelemedicineCatalogService,
  createTelemedicineCategory,
  createTelemedicineSubcategory,
  fetchTelemedicineAdminCategories,
  fetchTelemedicineAdminServices,
  fetchTelemedicineAdminSubcategories,
  updateTelemedicineCatalogService,
  updateTelemedicineCategory,
  updateTelemedicineSubcategory,
  type TelemedicineCatalogService,
  type TelemedicineCategory,
  type TelemedicineSubcategory
} from "../../../../shared/libs/telemedicineCatalog";

type EditorKind = "category" | "subcategory" | "service";
type EditorState = { kind: EditorKind; item?: TelemedicineCategory | TelemedicineSubcategory | TelemedicineCatalogService };

type FormState = {
  key: string;
  name: string;
  description: string;
  status: string;
  displayOrder: string;
  basePrice: string;
  duration: string;
  emergency: boolean;
  tags: string;
};

const EMPTY_FORM: FormState = {
  key: "",
  name: "",
  description: "",
  status: "active",
  displayOrder: "0",
  basePrice: "0",
  duration: "30",
  emergency: false,
  tags: ""
};

const slugify = (value: string, fallback: string) => {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return key || `${fallback}-${Date.now()}`;
};

const nextDisplayOrder = (items: Array<{ displayOrder: number }>) =>
  items.reduce((highest, item) => Math.max(highest, item.displayOrder), -1) + 1;

const editorExamples: Record<EditorKind, { name: string; description: string }> = {
  category: {
    name: "e.g. General Medicine",
    description: "e.g. Broad consultation area for primary care"
  },
  subcategory: {
    name: "e.g. General Practitioner",
    description: "e.g. Routine adult and family consultations"
  },
  service: {
    name: "e.g. Online doctor consultation",
    description: "e.g. Video consultation with a qualified clinician"
  }
};

const statusClass: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  suspended: "bg-amber-50 text-amber-700",
  archived: "bg-slate-100 text-slate-600"
};

const TelemedicineCatalogPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorCategoryId, setEditorCategoryId] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const categoriesQuery = useQuery({
    queryKey: ["admin", "telemedicine", "categories"],
    queryFn: fetchTelemedicineAdminCategories
  });
  const subcategoriesQuery = useQuery({
    queryKey: ["admin", "telemedicine", "subcategories", selectedCategoryId],
    queryFn: () => fetchTelemedicineAdminSubcategories(selectedCategoryId),
    enabled: Boolean(selectedCategoryId)
  });
  const servicesQuery = useQuery({
    queryKey: ["admin", "telemedicine", "services", selectedSubcategoryId],
    queryFn: () => fetchTelemedicineAdminServices(selectedSubcategoryId),
    enabled: Boolean(selectedSubcategoryId)
  });

  const categories = categoriesQuery.data ?? [];
  const subcategories = subcategoriesQuery.data ?? [];
  const services = servicesQuery.data ?? [];

  useEffect(() => {
    if (!selectedCategoryId && categories[0]) setSelectedCategoryId(categories[0].id);
    if (selectedCategoryId && !categories.some((item) => item.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0]?.id ?? "");
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (!selectedSubcategoryId && subcategories[0]) setSelectedSubcategoryId(subcategories[0].id);
    if (selectedSubcategoryId && !subcategories.some((item) => item.id === selectedSubcategoryId)) {
      setSelectedSubcategoryId(subcategories[0]?.id ?? "");
    }
  }, [selectedSubcategoryId, subcategories]);

  const selectedCategory = categories.find((item) => item.id === selectedCategoryId);
  const selectedSubcategory = subcategories.find((item) => item.id === selectedSubcategoryId);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "telemedicine"] });
  };

  const mutation = useMutation({
    mutationFn: async ({ kind, item, values }: { kind: EditorKind; item?: EditorState["item"]; values: FormState }) => {
      const key = values.key.trim() || slugify(values.name, kind);
      if (kind === "category") {
        const input = { key, name: values.name.trim(), description: values.description.trim() || null, displayOrder: Number(values.displayOrder) || 0, status: values.status };
        return item ? updateTelemedicineCategory(item.id, input) : createTelemedicineCategory(input);
      }
      if (kind === "subcategory") {
        const input = { key, name: values.name.trim(), description: values.description.trim() || null, displayOrder: Number(values.displayOrder) || 0, status: values.status };
        return item
          ? updateTelemedicineSubcategory(item.id, input)
          : createTelemedicineSubcategory({ categoryId: editorCategoryId, ...input });
      }
      const input = {
        key,
        name: values.name.trim(),
        description: values.description.trim() || null,
        basePriceCents: Math.round((Number(values.basePrice) || 0) * 100),
        defaultEstimateMinutes: Math.max(1, Number(values.duration) || 1),
        isEmergencyCapable: values.emergency,
        status: values.status,
        tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      };
      return item
        ? updateTelemedicineCatalogService(item.id, input)
        : createTelemedicineCatalogService(selectedSubcategoryId, input);
    },
    onSuccess: (_data, variables) => {
      if (variables.kind === "subcategory" && editorCategoryId) {
        setSelectedCategoryId(editorCategoryId);
        setSelectedSubcategoryId("");
      }
      refresh();
      setEditor(null);
      toast.showToast({ title: "Telemedicine catalog updated", description: "The latest taxonomy is now available to eligible users.", variant: "success" });
    },
    onError: (error: unknown) => {
      toast.showToast({ title: "Unable to save catalog entry", description: error instanceof Error ? error.message : "Check the entry and try again.", variant: "error" });
    }
  });

  const openEditor = (kind: EditorKind, item?: EditorState["item"]) => {
    const next = { ...EMPTY_FORM };
    if (item) {
      next.key = item.key;
      next.name = item.name;
      next.description = item.description ?? "";
      next.status = item.status;
      next.displayOrder = String("displayOrder" in item ? item.displayOrder : 0);
      if (kind === "service") {
        const service = item as TelemedicineCatalogService;
        next.basePrice = String(service.basePriceCents / 100);
        next.duration = String(service.defaultEstimateMinutes);
        next.emergency = service.isEmergencyCapable;
        next.tags = service.tags.join(", ");
      }
    } else {
      next.displayOrder = String(
        kind === "category"
          ? nextDisplayOrder(categories)
          : kind === "subcategory"
            ? nextDisplayOrder(subcategories)
            : nextDisplayOrder(services)
      );
    }
    setForm(next);
    setEditorCategoryId(
      kind === "subcategory"
        ? item && "categoryId" in item
          ? item.categoryId
          : selectedCategoryId
        : ""
    );
    setEditor({ kind, item });
  };

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const canCreateSubcategory = Boolean(selectedCategoryId);
  const canCreateService = Boolean(selectedSubcategoryId);
  const editorCategories = categories.filter((category) => category.status === "active");
  const editorCategory = categories.find((category) => category.id === editorCategoryId);
  const editorTitle = editor ? `${editor.item ? "Edit" : "Add"} telemedicine ${editor.kind}` : "";
  const selectedServiceCount = useMemo(() => services.length, [services]);

  return (
    <div className="space-y-6">
      <Card title="Telemedicine catalog" description="Maintain consultation areas, specialties, and bookable remote services. Providers are assigned to specialties; clients only see active services." badge={`${categories.length} areas`}>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Changes here affect future discovery and assignment. Existing appointments retain their selected service details.
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1fr_1.25fr]">
        <Card title="Consultation areas" padding="none">
          <div className="flex justify-end px-6 pt-6"><Button size="sm" onClick={() => openEditor("category")}>Add area</Button></div>
          <div className="space-y-2 px-6 pb-6 pt-4">
            {categories.map((category) => (
              <button key={category.id} type="button" onClick={() => { setSelectedCategoryId(category.id); setSelectedSubcategoryId(""); }} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${selectedCategoryId === category.id ? "border-primary-300 bg-primary-50" : "border-slate-200 bg-white"}`}>
                <span className="block font-semibold text-slate-900">{category.name}</span>
                <span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${statusClass[category.status] ?? statusClass.archived}`}>{category.status}</span>
              </button>
            ))}
            {!categoriesQuery.isFetching && !categories.length && <p className="py-6 text-sm text-slate-500">No consultation areas configured.</p>}
          </div>
        </Card>

        <Card title="Specialties" subtitle={selectedCategory?.name ?? "Select an area"} padding="none">
          <div className="flex justify-end px-6 pt-6"><Button size="sm" disabled={!canCreateSubcategory} onClick={() => openEditor("subcategory")}>Add specialty</Button></div>
          <div className="space-y-2 px-6 pb-6 pt-4">
            {subcategories.map((subcategory) => (
              <button key={subcategory.id} type="button" onClick={() => setSelectedSubcategoryId(subcategory.id)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${selectedSubcategoryId === subcategory.id ? "border-primary-300 bg-primary-50" : "border-slate-200 bg-white"}`}>
                <span className="block font-semibold text-slate-900">{subcategory.name}</span>
                <span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${statusClass[subcategory.status] ?? statusClass.archived}`}>{subcategory.status}</span>
              </button>
            ))}
            {selectedCategoryId && !subcategoriesQuery.isFetching && !subcategories.length && <p className="py-6 text-sm text-slate-500">No specialties configured for this area.</p>}
          </div>
        </Card>

        <Card title="Consultation services" subtitle={selectedSubcategory ? `${selectedCategory?.name ?? ""} / ${selectedSubcategory.name}` : "Select a specialty"} badge={`${selectedServiceCount} services`} padding="none">
          <div className="flex justify-end px-6 pt-6"><Button size="sm" disabled={!canCreateService} onClick={() => openEditor("service")}>Add service</Button></div>
          <div className="space-y-3 px-6 pb-6 pt-4">
            {services.map((service) => (
              <div key={service.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-semibold text-slate-900">{service.name}</h3><p className="text-xs text-slate-500">{service.currency} {(service.basePriceCents / 100).toLocaleString()} · {service.defaultEstimateMinutes} min</p></div>
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${statusClass[service.status] ?? statusClass.archived}`}>{service.status}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500"><span>{service.isEmergencyCapable ? "Emergency capable" : "Routine consultation"}</span><Button size="sm" variant="outline" onClick={() => openEditor("service", service)}>Edit</Button></div>
              </div>
            ))}
            {selectedSubcategoryId && !servicesQuery.isFetching && !services.length && <p className="py-6 text-sm text-slate-500">No services configured for this specialty.</p>}
          </div>
        </Card>
      </div>

      <Modal open={Boolean(editor)} onClose={() => !mutation.isPending && setEditor(null)} title={editorTitle}>
        {editor && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!form.name.trim() || (editor.kind === "subcategory" && !editorCategoryId)) return; mutation.mutate({ kind: editor.kind, item: editor.item, values: form }); }}>
          {editor.kind === "subcategory" && <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            <span>Consultation area</span>
            {editor.item ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700">{editorCategory?.name ?? "Selected consultation area"}</div> : <select value={editorCategoryId} onChange={(event) => setEditorCategoryId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900" required>
              <option value="">Select a consultation area</option>
              {editorCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>}
            <span className="text-xs text-slate-500">This specialty will be listed under the selected consultation area.</span>
          </label>}
          <Input label="Name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder={editorExamples[editor.kind].name} required />
          <Input label="Description" value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder={editorExamples[editor.kind].description} />
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">Status<select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="active">Active</option><option value="suspended">Suspended</option><option value="archived">Archived</option></select><span className="text-xs text-slate-500">Only active entries appear in new discovery and assignment.</span></label>
          {editor.kind === "service" && <>
            <div className="grid gap-4 sm:grid-cols-2"><Input label="Base price (KES)" type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => updateForm("basePrice", event.target.value)} placeholder="e.g. 2500" required /><Input label="Duration (minutes)" type="number" min="1" value={form.duration} onChange={(event) => updateForm("duration", event.target.value)} placeholder="e.g. 30" required /></div>
            <Input label="Tags" value={form.tags} onChange={(event) => updateForm("tags", event.target.value)} placeholder="e.g. remote, oncology" hint="Separate tags with commas." />
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.emergency} onChange={(event) => updateForm("emergency", event.target.checked)} /> Emergency capable</label>
          </>}
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setEditor(null)}>Cancel</Button><Button type="submit" loading={mutation.isPending}>{editor.item ? "Save changes" : "Create entry"}</Button></div>
        </form>}
      </Modal>
    </div>
  );
};

export default TelemedicineCatalogPage;
