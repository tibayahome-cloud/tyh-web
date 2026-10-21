import { useState } from "react";
import { Camera, Eye, Upload } from "lucide-react";

import { Button } from "../../../../shared/components/Button";
import { itemStatusLabel } from "../../utils/onboardingStatus";

export type ChecklistItem = {
  id: string;
  label: string;
  inputType: "file" | "image" | "text";
  status: string;
  valueText: string | null;
  hasFile: boolean;
  reviewerNote: string | null;
};

type Props = {
  items: ChecklistItem[];
  /** Id of the item being saved or uploaded right now, so only its buttons wait. */
  busyItemId: string | null;
  onUpload: (itemId: string, file: File) => void;
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

const outlineButton =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-tiba-blue";

const Row = ({ item, busy, onUpload, onSaveText, onView }: { item: ChecklistItem; busy: boolean } & Omit<Props, "items" | "busyItemId">) => {
  const [text, setText] = useState(item.valueText ?? "");
  const isText = item.inputType === "text";
  const approved = item.status === "verified";

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onUpload(item.id, file);
    event.target.value = "";
  };

  return (
    <li className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{item.label}</h3>
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

      {isText ? (
        <div className="space-y-2">
          <label className="block">
            <span className="sr-only">{item.label}</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              disabled={approved || busy}
              placeholder="Type your answer"
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40 disabled:bg-slate-50"
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
                <input type="file" accept="image/*,.pdf,.doc,.docx" className="sr-only" disabled={busy} onChange={pick} />
              </label>
              <label className={outlineButton}>
                <Camera aria-hidden="true" size={16} />
                Take a photo
                <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={pick} />
              </label>
            </>
          )}
        </div>
      )}
    </li>
  );
};

/** One row per document: what it is, where it stands in words, and the one action it needs. */
export const OnboardingChecklist = ({ items, busyItemId, onUpload, onSaveText, onView }: Props) => (
  <ul aria-label="Documents" className="space-y-3">
    {items.map((item) => (
      <Row key={item.id} item={item} busy={busyItemId === item.id} onUpload={onUpload} onSaveText={onSaveText} onView={onView} />
    ))}
  </ul>
);
