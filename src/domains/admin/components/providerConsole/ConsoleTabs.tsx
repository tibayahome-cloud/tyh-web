import { useRef, type KeyboardEvent } from "react";

export type ConsoleTab<Id extends string> = { id: Id; label: string; badge?: string | null };

type Props<Id extends string> = {
  tabs: ConsoleTab<Id>[];
  active: Id;
  idPrefix: string;
  label: string;
  onChange: (id: Id) => void;
};

// An accessible tab strip: arrow keys move between tabs, Home and End jump to the ends, and only the
// active tab is in the tab order. Panels carry `${idPrefix}-panel-${id}`.
export const ConsoleTabs = <Id extends string>({ tabs, active, idPrefix, label, onChange }: Props<Id>) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    const move = (next: number) => {
      const target = (next + tabs.length) % tabs.length;
      onChange(tabs[target].id);
      refs.current[target]?.focus();
    };
    if (event.key === "ArrowRight") { event.preventDefault(); move(index + 1); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); move(index - 1); }
    else if (event.key === "Home") { event.preventDefault(); move(0); }
    else if (event.key === "End") { event.preventDefault(); move(tabs.length - 1); }
  };

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="-mx-1 flex max-w-full gap-1 overflow-x-auto border-b border-slate-200 px-1">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => { refs.current[index] = element; }}
          id={`${idPrefix}-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tiba-blue ${
            active === tab.id ? "border-tiba-blue text-tiba-blue" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
          }`}
        >
          {tab.label}
          {tab.badge && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
};
