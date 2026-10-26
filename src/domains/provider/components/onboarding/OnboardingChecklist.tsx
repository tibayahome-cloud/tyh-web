import { useState } from "react";
import { Camera, Check, ChevronDown, Eye, FileText, Stethoscope, Upload, User, Wallet } from "lucide-react";

import { Button } from "../../../../shared/components/Button";
import { groupChecklistItems, itemsLeft, type DocumentGroupId } from "../../utils/onboardingGroups";
import { itemStatusLabel } from "../../utils/onboardingStatus";

export type ChecklistItem = {
  id: string;
  /** The requirement's key, used to group it and to pick the right hint for typed answers. */
  requirementKey?: string | null;
  label: string;
  inputType: "file" | "image" | "text";
  status: string;
  valueText: string | null;
  hasFile: boolean;
  reviewerNote: string | null;
  required: boolean;
  /** A licence or cover that runs out: its end date is asked for with the upload. */
  hasExpiry: boolean;
  expiresOn: string | null;
};

type Props = {
  items: ChecklistItem[];
  /** Id of the item being saved or uploaded right now, so only its buttons wait. */
  busyItemId: string | null;
  onUpload: (itemId: string, file: File, expiresOn?: string) => void;
  onSaveText: (itemId: string, text: string) => void;
  onView: (itemId: string) => void;
};

const PILL: Record<string, string> = {
  pending: "bg-sky-100 text-sky-900",
  submitted: "bg-sky-100 text-sky-900",
  verified: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900"
};

const GROUP_ICONS: Record<DocumentGroupId, React.ReactNode> = {
  identity: <User aria-hidden="true" className="h-5 w-5" />,
  professional: <Stethoscope aria-hidden="true" className="h-5 w-5" />,
  payments: <Wallet aria-hidden="true" className="h-5 w-5" />,
  other: <FileText aria-hidden="true" className="h-5 w-5" />
};

// Typed answers with a known shape get a one-line box and an example, not a blank text area.
const TYPED_HINTS: Record<string, { placeholder: string; inputMode: "text" | "tel"; maxLength: number }> = {
  "kra-pin": { placeholder: "A123456789B", inputMode: "text", maxLength: 11 },
  "payout-details": { placeholder: "0712 345 678", inputMode: "tel", maxLength: 16 }
};
const DEFAULT_HINT = { placeholder: "Type your answer", inputMode: "text" as const, maxLength: 200 };

const outlineButton =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-tiba-blue";

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50";

const Row = ({ item, busy, onUpload, onSaveText, onView }: { item: ChecklistItem; busy: boolean } & Omit<Props, "items" | "busyItemId">) => {
  const approved = item.status === "verified";
  const sent = item.status === "pending" || item.status === "submitted";
  const [open, setOpen] = useState(item.status === "rejected");
  const [text, setText] = useState(item.valueText ?? "");
  const [expiresOn, setExpiresOn] = useState(item.expiresOn ?? "");
  const isText = item.inputType === "text";
  const hint = TYPED_HINTS[item.requirementKey ?? ""] ?? DEFAULT_HINT;
  const needsDate = item.hasExpiry && !expiresOn;
  const panelId = `doc-${item.id}`;

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onUpload(item.id, file, item.hasExpiry ? expiresOn : undefined);
    event.target.value = "";
  };

  const actionLabel = approved ? "View" : item.status === "missing" ? "Add" : "Replace";

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="flex min-h-[56px] flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          {approved ? (
            <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
          )}
          <h4 className="min-w-0 text-base font-medium text-slate-900">
            {item.label}
            {!item.required && <span className="ml-2 text-sm font-normal text-slate-600">Optional</span>}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {item.status !== "missing" && (
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${PILL[item.status] ?? "bg-slate-100 text-slate-800"}`}>
              {itemStatusLabel(item.status)}
            </span>
          )}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${actionLabel} ${item.label}`}
            onClick={() => (approved && item.hasFile ? onView(item.id) : setOpen((value) => !value))}
            className={`min-h-[44px] rounded-lg px-3 text-base font-semibold text-tiba-blue hover:bg-sky-50 ${focusRing}`}
          >
            {actionLabel}
          </button>
        </div>
      </div>

      {open && !approved && (
        <div id={panelId} className="space-y-3 border-t border-slate-100 px-4 py-4">
          {item.reviewerNote && (
            <p role="note" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
              <span className="font-semibold">From the reviewer: </span>
              {item.reviewerNote}
            </p>
          )}

          {item.hasExpiry && !isText && (
            <div>
              <label className="block">
                <span className="text-sm font-medium text-slate-800">Expiry date</span>
                <input
                  type="date"
                  value={expiresOn}
                  onChange={(event) => setExpiresOn(event.target.value)}
                  disabled={busy}
                  className="mt-1 h-11 w-full max-w-[220px] rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40 disabled:bg-slate-50"
                />
              </label>
              {needsDate && <p className="mt-1 text-sm text-slate-700">Enter the date first, then choose the file.</p>}
            </div>
          )}

          {isText ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="block min-w-0 flex-1">
                <span className="sr-only">{item.label}</span>
                <input
                  type="text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={busy}
                  placeholder={hint.placeholder}
                  inputMode={hint.inputMode}
                  maxLength={hint.maxLength}
                  autoComplete="off"
                  className="h-11 w-full max-w-sm rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40 disabled:bg-slate-50"
                />
              </label>
              <Button type="button" className="min-h-[44px]" loading={busy} disabled={!text.trim()} onClick={() => onSaveText(item.id, text.trim())}>
                Save answer
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {item.hasFile && (
                <button type="button" onClick={() => onView(item.id)} className={outlineButton}>
                  <Eye aria-hidden="true" size={16} />
                  View
                </button>
              )}
              <label className={outlineButton}>
                <Upload aria-hidden="true" size={16} />
                {busy ? "Uploading…" : item.hasFile ? "Replace file" : "Choose a file"}
                <input type="file" accept="image/*,.pdf,.doc,.docx" className="sr-only" disabled={busy || needsDate} onChange={pick} />
              </label>
              <label className={outlineButton}>
                <Camera aria-hidden="true" size={16} />
                Take a photo
                <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy || needsDate} onChange={pick} />
              </label>
            </div>
          )}
          {sent && <p className="text-sm text-slate-700">We have this. Replace it only if it was wrong.</p>}
        </div>
      )}
    </li>
  );
};

/**
 * Documents in a few groups, the way a setup checklist reads: each group says how many required ones are left, opens
 * to its rows, and each row has one action. The first group with something left starts open.
 */
export const OnboardingChecklist = ({ items, busyItemId, onUpload, onSaveText, onView }: Props) => {
  const groups = groupChecklistItems(items);
  const firstOpen = groups.find((entry) => itemsLeft(entry.items) > 0)?.group.id ?? null;
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => opened[id] ?? id === firstOpen;

  return (
    <div className="space-y-3">
      {groups.map(({ group, items: groupItems }) => {
        const left = itemsLeft(groupItems);
        const open = isOpen(group.id);
        const regionId = `group-${group.id}`;
        return (
          <section key={group.id} aria-label={group.title} className={`rounded-2xl border bg-white ${open ? "border-sky-300 shadow-sm" : "border-slate-200"}`}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={regionId}
              onClick={() => setOpened((current) => ({ ...current, [group.id]: !open }))}
              className={`flex min-h-[72px] w-full items-center gap-4 rounded-2xl px-4 py-3 text-left ${focusRing}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-tiba-blue">{GROUP_ICONS[group.id]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-slate-900">{group.title}</span>
                <span className="block text-sm text-slate-700">{group.description}</span>
              </span>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${left > 0 ? "bg-slate-100 text-slate-800" : "bg-emerald-100 text-emerald-900"}`}
              >
                {left > 0 ? `${left} left` : "Done"}
              </span>
              <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-tiba-blue transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <ul id={regionId} aria-label={`Documents in ${group.title}`} className="space-y-2 px-4 pb-4">
                {groupItems.map((item) => (
                  <Row key={item.id} item={item} busy={busyItemId === item.id} onUpload={onUpload} onSaveText={onSaveText} onView={onView} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};
