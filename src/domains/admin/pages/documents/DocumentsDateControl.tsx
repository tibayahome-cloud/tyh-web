import { useState } from "react";

import { Button } from "../../../../shared/components/Button";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { formatDocumentDate } from "../../../provider/utils/documentDisplay";

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue";
const todayIso = () => new Date().toISOString().slice(0, 10);

type Props = {
  dueOn: string | null;
  /** Who the date is for, in the dialog: "Example Clinic" or "Dr Example". */
  subject: string;
  /** Only the super admin moves a date; everyone else just reads it. */
  canChange: boolean;
  /** Resolves when saved; rejects if it failed (the caller shows why) so the dialog stays open. */
  onSave: (dueOn: string | null) => Promise<void>;
};

/** The date by which documents have to be approved, and for the super admin a way to move it or remove it. */
export const DocumentsDateControl = ({ dueOn, subject, canChange, onSave }: Props) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [remove, setRemove] = useState(false);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setOpen(false);
    setDate("");
    setRemove(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(remove ? null : date);
      close();
    } catch {
      // the caller has said what went wrong; keep the dialog open so nothing is lost
    } finally {
      setSaving(false);
    }
  };

  const formatted = formatDocumentDate(dueOn);
  return (
    <div className="flex flex-wrap items-center gap-x-3 text-sm text-slate-700">
      <span>{formatted ? `Documents date: ${formatted}` : "No documents date"}</span>
      {canChange && (
        <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setOpen(true)}>
          Change date
        </Button>
      )}
      <ConfirmDialog
        open={open}
        title="Change the documents date"
        description={`Move the date for ${subject}, or remove it. Nothing is suspended either way, and they will be told.`}
        confirmLabel="Save date"
        loading={saving}
        confirmDisabled={!remove && !date}
        onConfirm={save}
        onClose={close}
      >
        <div className="flex flex-col gap-3">
          <label className="block text-sm font-medium text-slate-800">
            New date
            <input
              type="date"
              min={todayIso()}
              value={date}
              disabled={remove}
              onChange={(event) => setDate(event.target.value)}
              className={`mt-1 block min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 disabled:bg-slate-100 sm:w-56 ${focusRing}`}
            />
          </label>
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
            <input type="checkbox" checked={remove} onChange={(event) => setRemove(event.target.checked)} className={`h-5 w-5 ${focusRing}`} />
            Remove the date
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
};

export default DocumentsDateControl;
