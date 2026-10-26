import { useState } from "react";
import { Camera, Eye, Upload } from "lucide-react";

import { Button } from "../../../../shared/components/Button";
import { itemStatusLabel } from "../../utils/onboardingStatus";

export type ChecklistItem = {
  id: string;
  /** The requirement's key, used to pick the right hint for typed answers. */
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
  missing: "bg-slate-100 text-slate-800",
  pending: "bg-sky-100 text-sky-900",
  submitted: "bg-sky-100 text-sky-900",
  verified: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900"
};

// Typed answers with a known shape get a one-line box and an example, not a blank text area.
const TYPED_HINTS: Record<string, { placeholder: string; inputMode: "text" | "tel"; maxLength: number }> = {
  "kra-pin": { placeholder: "A123456789B", inputMode: "text", maxLength: 11 },
  "payout-details": { placeholder: "0712 345 678", inputMode: "tel", maxLength: 16 }
};
const DEFAULT_HINT = { placeholder: "Type your answer", inputMode: "text" as const, maxLength: 200 };

const outlineButton =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-tiba-blue";

const Row = ({ item, busy, onUpload, onSaveText, onView }: { item: ChecklistItem; busy: boolean } & Omit<Props, "items" | "busyItemId">) => {
  const [text, setText] = useState(item.valueText ?? "");
  const [expiresOn, setExpiresOn] = useState(item.expiresOn ?? "");
  const isText = item.inputType === "text";
  const hint = TYPED_HINTS[item.requirementKey ?? ""] ?? DEFAULT_HINT;
  const approved = item.status === "verified";
  const needsDate = item.hasExpiry && !expiresOn;

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onUpload(item.id, file, item.hasExpiry ? expiresOn : undefined);
    event.target.value = "";
  };

  return (
    <li className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">
          {item.label}
          {!item.required && <span className="ml-2 text-sm font-normal text-slate-600">Optional</span>}
        </h3>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${PILL[item.status] ?? "bg-slate-100 text-slate-800"}`}>
          {itemStatusLabel(item.status)}
        </span>
      </div>

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
              disabled={approved || busy}
              className="mt-1 h-11 w-full max-w-[220px] rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40 disabled:bg-slate-50"
            />
          </label>
          {needsDate && !approved && <p className="mt-1 text-sm text-slate-700">Enter the date first, then choose the file.</p>}
        </div>
      )}

      {isText ? (
        <div className="space-y-2">
          <label className="block">
            <span className="sr-only">{item.label}</span>
            <input
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={approved || busy}
              placeholder={hint.placeholder}
              inputMode={hint.inputMode}
              maxLength={hint.maxLength}
              autoComplete="off"
              className="h-11 w-full max-w-sm rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40 disabled:bg-slate-50"
            />
          </label>
          {!approved && (
            <Button type="button" className="min-h-[44px]" loading={busy} disabled={!text.trim()} onClick={() => onSaveText(item.id, text.trim())}>
              Save answer
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {item.hasFile && (
            <button type="button" onClick={() => onView(item.id)} className={outlineButton}>
              <Eye aria-hidden="true" size={16} />
              View
            </button>
          )}
          {!approved && (
            <>
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
            </>
          )}
        </div>
      )}
    </li>
  );
};

/** One row per document, required ones first: what it is, where it stands in words, and the one action it needs. */
export const OnboardingChecklist = ({ items, busyItemId, onUpload, onSaveText, onView }: Props) => {
  const required = items.filter((item) => item.required);
  const optional = items.filter((item) => !item.required);
  const list = (group: ChecklistItem[], label: string) => (
    <ul aria-label={label} className="space-y-3">
      {group.map((item) => (
        <Row key={item.id} item={item} busy={busyItemId === item.id} onUpload={onUpload} onSaveText={onSaveText} onView={onView} />
      ))}
    </ul>
  );
  // Nothing marked required (an older server): one plain list, as before.
  if (required.length === 0) return list(items, "Documents");
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Required to be verified</h3>
        {list(required, "Documents")}
      </div>
      {optional.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Also helpful</h3>
          {list(optional, "Other documents")}
        </div>
      )}
    </div>
  );
};
