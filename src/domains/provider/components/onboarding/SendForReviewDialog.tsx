import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

import { Button } from "../../../../shared/components/Button";
import type { ChecklistItem } from "./OnboardingChecklist";

type Props = {
  open: boolean;
  items: ChecklistItem[];
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const PROVIDED = new Set(["pending", "submitted", "verified"]);

/** The last look before sending: everything that will go to the reviewer, and a plain confirmation that it is right. */
export const SendForReviewDialog = ({ open, items, submitting, onConfirm, onClose }: Props) => {
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!open) setConfirmed(false);
  }, [open]);

  const provided = items.filter((item) => PROVIDED.has(item.status));
  const required = provided.filter((item) => item.required);
  const optional = provided.filter((item) => !item.required);

  const line = (item: ChecklistItem) => (
    <li key={item.id} className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm font-medium text-slate-900">{item.label}</span>
      <span className="truncate text-sm text-slate-700">
        {item.inputType === "text" ? item.valueText : item.expiresOn ? `Expires ${item.expiresOn}` : "Uploaded"}
      </span>
    </li>
  );

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm" aria-labelledby="send-review-title">
      <DialogTitle id="send-review-title">Check before you send</DialogTitle>
      <DialogContent>
        <p className="text-sm text-slate-800">This is what our team will check. Make sure each one is the right document and easy to read.</p>

        <h3 className="mt-4 text-sm font-semibold text-slate-900">Required</h3>
        <ul aria-label="Required documents you are sending" className="mt-1">
          {required.map(line)}
        </ul>

        {optional.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">Also included</h3>
            <ul aria-label="Other documents you are sending" className="mt-1">
              {optional.map(line)}
            </ul>
          </>
        )}

        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
          After you send, you can view your documents but not change them while we check. Your CV, licence, ID and payout number you can
          still update any time.
        </p>

        <label className="mt-4 flex min-h-[44px] items-start gap-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-slate-400"
          />
          <span className="text-sm text-slate-900">These documents are mine and everything above is correct.</span>
        </label>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button type="button" variant="secondary" className="min-h-[44px]" disabled={submitting} onClick={onClose}>
          Go back
        </Button>
        <Button type="button" className="min-h-[44px]" disabled={!confirmed} loading={submitting} onClick={onConfirm}>
          Send for review
        </Button>
      </DialogActions>
    </Dialog>
  );
};
