import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
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

const nextDisplayOrder = (items: Array<{ displayOrder?: number }>) =>
  items.reduce((highest, item) => Math.max(highest, item.displayOrder ?? 0), -1) + 1;

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
  active: "bg-emerald-50 text-emerald-800",
  suspended: "bg-amber-50 text-amber-800",
  archived: "bg-slate-100 text-slate-700"
};
const statusLabel: Record<string, string> = { active: "Active", suspended: "Suspended", archived: "Archived" };

const StatusPill = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusClass[status] ?? statusClass.archived}`}>
    {statusLabel[status] ?? status}
  </span>
);

const formatKes = (cents: number) => `KES ${(cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

const TelemedicineCatalogPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorCategoryId, setEditorCategoryId] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [mobileView, setMobileView] = useState<"areas" | "detail">("areas");

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
            : services.length
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

  const query = search.trim().toLowerCase();
  const shownCategories = query ? categories.filter((category) => category.name.toLowerCase().includes(query)) : categories;
  const shownServices = query ? services.filter((service) => service.name.toLowerCase().includes(query)) : services;
  const duplicateNames = useMemo(() => {
    const seen = new Map<string, number>();
    subcategories.forEach((item) => seen.set(item.name.trim().toLowerCase(), (seen.get(item.name.trim().toLowerCase()) ?? 0) + 1));
    return seen;
  }, [subcategories]);

  const pickCategory = (id: string) => {
    setSelectedCategoryId(id);
    setSelectedSubcategoryId("");
    setMobileView("detail");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Telemedicine catalogue</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Pick an area, then a specialty, then manage its services. Providers are assigned to specialties; clients only see active services.
          </p>
        </div>
        <label className="block sm:w-64">
          <span className="sr-only">Search the catalogue</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search areas and services"
            className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/30"
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section aria-label="Consultation areas" className={`${mobileView === "detail" ? "hidden" : ""} rounded-2xl border border-slate-200 bg-white lg:block`}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Areas <span className="font-normal text-slate-500">({categories.length})</span></h3>
            <Button size="sm" onClick={() => openEditor("category")}>Add area</Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {shownCategories.map((category) => (
              <li key={category.id} className={`flex items-center gap-1 ${selectedCategoryId === category.id ? "bg-sky-50" : ""}`}>
                <button
                  type="button"
                  aria-current={selectedCategoryId === category.id ? "true" : undefined}
                  onClick={() => pickCategory(category.id)}
                  className="flex min-h-[44px] min-w-0 flex-1 items-center justify-between gap-2 px-4 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tiba-blue"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-slate-900">{category.name}</span>
                  {category.status !== "active" && <StatusPill status={category.status} />}
                </button>
                <button
                  type="button"
                  aria-label={`Edit ${category.name}`}
                  onClick={() => openEditor("category", category)}
                  className="mr-2 min-h-[44px] rounded-lg px-3 text-sm font-medium text-tiba-blue hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
          {!categoriesQuery.isFetching && !shownCategories.length && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">{query ? "No area matches your search." : "No consultation areas yet. Add the first one."}</p>
          )}
        </section>

        <section aria-label="Specialties and services" className={`${mobileView === "areas" ? "hidden" : ""} min-w-0 space-y-4 lg:block`}>
          <button
            type="button"
            onClick={() => setMobileView("areas")}
            className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-tiba-blue lg:hidden"
          >
            <span aria-hidden="true">←</span> All areas
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-900">{selectedCategory?.name ?? "Select an area"}</h3>
                <p className="text-xs text-slate-500">{subcategories.length} {subcategories.length === 1 ? "specialty" : "specialties"}</p>
              </div>
              <Button size="sm" disabled={!canCreateSubcategory} onClick={() => openEditor("subcategory")}>Add specialty</Button>
            </div>
            <div role="tablist" aria-label="Specialties" className="flex flex-wrap gap-2 p-4">
              {subcategories.map((subcategory) => {
                const active = selectedSubcategoryId === subcategory.id;
                const duplicate = (duplicateNames.get(subcategory.name.trim().toLowerCase()) ?? 0) > 1;
                return (
                  <button
                    key={subcategory.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedSubcategoryId(subcategory.id)}
                    className={`min-h-[44px] rounded-full border px-4 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue ${active ? "border-tiba-blue bg-tiba-blue text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}
                  >
                    {subcategory.name}
                    {duplicate && <span className="ml-2 text-xs opacity-80">(duplicate name)</span>}
                    {subcategory.status !== "active" && <span className="ml-2 text-xs opacity-80">({statusLabel[subcategory.status] ?? subcategory.status})</span>}
                  </button>
                );
              })}
              {selectedCategoryId && !subcategoriesQuery.isFetching && !subcategories.length && (
                <p className="py-2 text-sm text-slate-500">No specialties in this area yet. Add one to start listing services.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-900">{selectedSubcategory ? `${selectedSubcategory.name} services` : "Services"}</h3>
                <p className="text-xs text-slate-500">
                  {selectedSubcategory ? `${services.length} ${services.length === 1 ? "service" : "services"} · new services are added under ${selectedSubcategory.name}` : "Choose a specialty to see its services."}
                </p>
              </div>
              <Button size="sm" disabled={!canCreateService} onClick={() => openEditor("service")}>Add service</Button>
            </div>
            <ul className="divide-y divide-slate-100">
              {shownServices.map((service) => (
                <li key={service.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-sm font-medium text-slate-900">{service.name}</p>
                    <p className="text-sm text-slate-600">{formatKes(service.basePriceCents)} · {service.defaultEstimateMinutes} min{service.isEmergencyCapable ? " · Emergency capable" : ""}</p>
                  </div>
                  <StatusPill status={service.status} />
                  <button
                    type="button"
                    aria-label={`Edit ${service.name}`}
                    onClick={() => openEditor("service", service)}
                    className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-tiba-blue hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                  >
                    Edit
                  </button>
                </li>
              ))}
            </ul>
            {selectedSubcategoryId && !servicesQuery.isFetching && !shownServices.length && (
              <p className="px-4 py-8 text-center text-sm text-slate-500">{query ? "No service matches your search." : "No services in this specialty yet. Add the first one."}</p>
            )}
          </div>
        </section>
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
          {editor.kind === "service" && selectedSubcategory && <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <p className="font-semibold">Creating service under</p>
            <p className="mt-1">{selectedCategory?.name ?? "Consultation area"} <span aria-hidden="true">→</span> {selectedSubcategory.name}</p>
            <p className="mt-1 text-xs text-sky-800">This parent relationship is saved automatically when you create the service.</p>
          </div>}
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
