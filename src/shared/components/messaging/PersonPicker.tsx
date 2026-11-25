import classNames from "classnames";
import { useMemo, useState } from "react";

export type PickerPerson = {
  id: string;
  name: string;
  /** A second line under the name, e.g. the latest booking. */
  detail?: string;
  /** Short text shown on the row, e.g. "Continue conversation" or "Available now". Text, never colour alone. */
  note?: string;
};

type Props = {
  people: PickerPerson[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** The one line that says who is listed. */
  helper: string;
  /** Name for the search box and the group, e.g. "clients". */
  noun: string;
  groupName: string;
  /** A search appears above this many people. */
  searchFrom?: number;
};

const initials = (name: string) =>
  name
    .replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

/**
 * Who to write to: one line of explanation, a search once the list is long (kept in view), and the people, one row each,
 * with their initials, the latest booking and a short note. Only the list scrolls; the parent keeps its buttons below.
 */
export const PersonPicker = ({ people, selectedId, onSelect, helper, noun, groupName, searchFrom = 5 }: Props) => {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? people.filter((person) => `${person.name} ${person.detail ?? ""}`.toLowerCase().includes(needle)) : people;
  }, [people, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="shrink-0 text-sm text-slate-700">{helper}</p>
      {people.length > searchFrom && (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={`Search ${noun}`}
          placeholder={`Search ${noun}`}
          className="h-11 w-full shrink-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
        />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {shown.length === 0 ? (
          <p role="status" className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            No one matches &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="sr-only">{`Choose from ${noun}`}</legend>
            {shown.map((person) => {
              const selected = selectedId === person.id;
              return (
                <label
                  key={person.id}
                  className={classNames(
                    "flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl border p-3 focus-within:ring-2 focus-within:ring-tiba-blue/40",
                    selected ? "border-tiba-blue bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <input
                    type="radio"
                    name={groupName}
                    checked={selected}
                    onChange={() => onSelect(person.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={classNames(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      selected ? "bg-tiba-blue text-white" : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {initials(person.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{person.name}</span>
                    {person.detail && <span className="block text-sm text-slate-700">{person.detail}</span>}
                    {/* On a phone the note sits under the name so the name keeps its width. */}
                    {person.note && <span className="mt-1 inline-block text-xs font-semibold text-tiba-blue sm:hidden">{person.note}</span>}
                  </span>
                  {person.note && (
                    <span className="hidden shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 sm:inline-block">
                      {person.note}
                    </span>
                  )}
                </label>
              );
            })}
          </fieldset>
        )}
      </div>
    </div>
  );
};
