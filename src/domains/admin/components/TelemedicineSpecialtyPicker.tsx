import { useMemo, useState } from "react";

import { Input } from "../../../shared/components/Input";

type Specialty = { id: string; name: string; category?: { id: string; name?: string | null } | null };

type Props = {
  specialties: Specialty[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  // Names of the services this facility offers under each specialty.
  offered: Map<string, string[]>;
  // How many of the facility's providers hold each specialty.
  holders: Map<string, number>;
};

const matches = (text: string, query: string) => text.toLowerCase().includes(query);

// Specialties for one provider. The ones this facility already offers come first and say which service
// they carry and whether any provider holds them yet, so an admin who has just added a service can find
// its specialty at once instead of searching a list of every specialty on the platform.
export const TelemedicineSpecialtyPicker = ({ specialties, selectedIds, onToggle, offered, holders }: Props) => {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      specialties.filter(
        (item) =>
          !needle ||
          matches(item.name, needle) ||
          matches(item.category?.name ?? "", needle) ||
          (offered.get(item.id) ?? []).some((name) => matches(name, needle))
      ),
    [specialties, needle, offered]
  );
  const offeredHere = visible.filter((item) => (offered.get(item.id) ?? []).length > 0);
  const others = useMemo(() => {
    const groups = new Map<string, { name: string; items: Specialty[] }>();
    visible
      .filter((item) => (offered.get(item.id) ?? []).length === 0)
      .forEach((item) => {
        const key = item.category?.id ?? "uncategorized";
        const group = groups.get(key) ?? { name: item.category?.name ?? "Other", items: [] };
        group.items.push(item);
        groups.set(key, group);
      });
    return Array.from(groups.values());
  }, [visible, offered]);

  const option = (item: Specialty) => {
    const services = offered.get(item.id) ?? [];
    const count = holders.get(item.id) ?? 0;
    return (
      <label key={item.id} className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
        <input type="checkbox" className="mt-1" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} />
        <span className="min-w-0">
          <span className="block font-medium text-slate-900">{item.name}</span>
          {services.length > 0 && <span className="block break-words text-xs text-slate-600">Offered here: {services.join(", ")}</span>}
          {services.length > 0 && (
            <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${count === 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
              {count === 0 ? "No provider holds this yet" : `${count} provider${count === 1 ? "" : "s"} hold this`}
            </span>
          )}
        </span>
      </label>
    );
  };

  return (
    <div className="space-y-3">
      <Input aria-label="Search specialties" placeholder="Search specialties or services" value={query} onChange={(event) => setQuery(event.target.value)} />
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">
          {needle ? `No specialty or service matches "${query.trim()}".` : "No active telemedicine subcategories are available."}
        </p>
      ) : (
        <>
          {offeredHere.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-700">Offered at this facility</p>
              <div className="grid gap-2 sm:grid-cols-2">{offeredHere.map(option)}</div>
            </div>
          )}
          {others.map((group) => (
            <div key={group.name}>
              <p className="mb-1 text-xs font-semibold text-slate-500">{group.name}</p>
              <div className="grid gap-2 sm:grid-cols-2">{group.items.map(option)}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
