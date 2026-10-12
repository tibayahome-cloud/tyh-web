import { useRef, type KeyboardEvent } from "react";

import { SERVICE_KIND_LABEL, type ServiceKind } from "../../../shared/utils/facilityServiceKinds";

type Props = {
  active: ServiceKind;
  counts: Record<ServiceKind, { active: number; total: number }>;
  onChange: (kind: ServiceKind) => void;
};

const KINDS: ServiceKind[] = ["home", "telemedicine"];

// Home-based care and telemedicine services are managed separately, so each has its own tab with
// its own count. Arrow keys, Home and End move between them.
export const ServiceKindTabs = ({ active, counts, onChange }: Props) => {
  const refs = useRef<Record<ServiceKind, HTMLButtonElement | null>>({ home: null, telemedicine: null });

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % KINDS.length;
    if (event.key === "ArrowLeft") next = (index - 1 + KINDS.length) % KINDS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = KINDS.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(KINDS[next]);
    refs.current[KINDS[next]]?.focus();
  };

  return (
    <div role="tablist" aria-label="Service type" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-grid sm:min-w-[360px]">
      {KINDS.map((kind, index) => {
        const selected = active === kind;
        return (
          <button
            key={kind}
            ref={(node) => {
              refs.current[kind] = node;
            }}
            type="button"
            role="tab"
            id={`service-kind-${kind}`}
            aria-selected={selected}
            aria-controls="service-kind-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(kind)}
            onKeyDown={(event) => move(event, index)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-tiba-blue/40 ${selected ? "bg-white text-tiba-blue shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            {SERVICE_KIND_LABEL[kind]}
            <span className="ml-1.5 text-xs font-medium text-slate-500">
              {counts[kind].active} active{counts[kind].total !== counts[kind].active ? ` of ${counts[kind].total}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
};
