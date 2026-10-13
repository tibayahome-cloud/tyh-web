import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "../../../../shared/components/Button";
import { Input } from "../../../../shared/components/Input";
import { Modal } from "../../../../shared/components/Modal";
import { updateFacilityProvider } from "../../../../shared/libs/facilities";
import { fetchSelectableTelemedicineSubcategories } from "../../../../shared/libs/telemedicineCatalog";
import { describeProviderSaveError, findStaleSubcategories } from "../../../../shared/utils/telemedicineSelection";

export type EditableProviderInfo = {
  userId: string;
  facilityId: string;
  fullName: string;
  email: string;
  phone: string;
  activeSpecialtyIds: string[];
  specialtyNames: Record<string, string>;
};

type Props = {
  open: boolean;
  // "details" edits name and contact; "specialties" edits the remote specialties.
  section: "details" | "specialties";
  provider: EditableProviderInfo;
  onClose: () => void;
  onSaved: () => void;
};

// A super admin changing a provider's details or telemedicine specialties on their behalf. Saves
// through the facility provider route, which also tells the provider an administrator changed them.
export const ProviderEditDialog = ({ open, section, provider, onClose, onSaved }: Props) => {
  const [fullName, setFullName] = useState(provider.fullName);
  const [email, setEmail] = useState(provider.email);
  const [phone, setPhone] = useState(provider.phone);
  const [selected, setSelected] = useState<string[]>(provider.activeSpecialtyIds);

  useEffect(() => {
    if (open) {
      setFullName(provider.fullName);
      setEmail(provider.email);
      setPhone(provider.phone);
      setSelected(provider.activeSpecialtyIds);
    }
  }, [open, provider]);

  const catalog = useQuery({
    queryKey: ["telemedicine", "catalog", "subcategories"],
    queryFn: () => fetchSelectableTelemedicineSubcategories(),
    enabled: open && section === "specialties"
  });

  const stale = useMemo(
    () =>
      catalog.isSuccess
        ? findStaleSubcategories(
            selected,
            catalog.data,
            provider.activeSpecialtyIds.map((id) => ({ subcategoryId: id, subcategory: { name: provider.specialtyNames[id] } }))
          )
        : [],
    [catalog.isSuccess, catalog.data, selected, provider]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string }>>();
    (catalog.data ?? []).forEach((item) => {
      const key = item.category?.name ?? "Other";
      map.set(key, [...(map.get(key) ?? []), { id: item.id, name: item.name }]);
    });
    return [...map.entries()];
  }, [catalog.data]);

  const save = useMutation({
    mutationFn: () =>
      updateFacilityProvider(
        provider.facilityId,
        provider.userId,
        section === "details"
          ? { fullName: fullName.trim(), email: email.trim() || null, phone: phone.trim() || null }
          : { telemedicineSubcategoryIds: selected }
      ),
    onSuccess: () => {
      onSaved();
      onClose();
    }
  });

  const detailsInvalid = section === "details" && (!fullName.trim() || (!email.trim() && !phone.trim()));
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={section === "details" ? "Edit provider details" : "Edit remote specialties"}
      description={`Editing on behalf of ${provider.fullName || "this provider"}. They are notified that an administrator made the change.`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {section === "details" ? (
          <div className="grid gap-3">
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <p className="text-xs text-slate-500">Keep at least an email or a phone number so the provider can still sign in and be reached.</p>
          </div>
        ) : catalog.isLoading ? (
          <p className="text-sm text-slate-600">Loading specialties…</p>
        ) : catalog.isError ? (
          <p className="text-sm text-danger-600" role="alert">We could not load the specialties. Close this and try again.</p>
        ) : (
          <div className="space-y-4">
            {stale.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                <p className="font-semibold">Archived specialties are still selected</p>
                <p className="mt-1">{stale.map((item) => item.name).join(", ")}. They can no longer be assigned. Untick them to save.</p>
                {stale.map((item) => (
                  <label key={item.id} className="mt-2 flex items-center gap-2">
                    <input type="checkbox" checked onChange={() => toggle(item.id)} />
                    {item.name}
                  </label>
                ))}
              </div>
            )}
            {groups.map(([category, items]) => (
              <fieldset key={category}>
                <legend className="mb-1 text-sm font-semibold text-slate-700">{category}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                      {item.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}
        {save.error && <p className="text-sm text-danger-600" role="alert">{describeProviderSaveError(save.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button loading={save.isPending} disabled={detailsInvalid || stale.length > 0 || (section === "specialties" && !catalog.isSuccess)} onClick={() => save.mutate()}>
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
};
