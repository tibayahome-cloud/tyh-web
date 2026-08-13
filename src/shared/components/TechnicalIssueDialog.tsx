import { useState } from "react";

import { ConfirmDialog } from "./ConfirmDialog";
import { Input } from "./Input";
import { ApiErrorBanner } from "./ApiErrorBanner";
import { useReportTechnicalIssueMutation } from "../hooks/useTelemedicine";
import { classifyApiError, type ClassifiedApiError } from "../utils/errors";

type TechnicalIssueDialogProps = {
  open: boolean;
  bookingId: string;
  onClose: () => void;
  onReported?: () => void;
};

// This is a review flag, not a financial or dispute decision -- reporting never approves a
// refund, and the record's status is owned entirely by admin review, not by anything here.
export const TechnicalIssueDialog = ({ open, bookingId, onClose, onReported }: TechnicalIssueDialogProps) => {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<ClassifiedApiError | null>(null);
  const reportMutation = useReportTechnicalIssueMutation();

  const handleClose = () => {
    if (reportMutation.isPending) return;
    setCategory("");
    setDescription("");
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      await reportMutation.mutateAsync({
        bookingId,
        category: category.trim() || undefined,
        description: description.trim() || undefined
      });
      setCategory("");
      setDescription("");
      onReported?.();
      onClose();
    } catch (submitError) {
      setError(classifyApiError(submitError, "Unable to report this issue."));
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={handleClose}
      onConfirm={handleSubmit}
      loading={reportMutation.isPending}
      title="Report a technical issue"
      description="Let admin.ops know about audio, video, or connection problems with this consultation. This is a review flag -- it doesn't request a refund by itself."
      confirmLabel="Report issue"
      confirmVariant="secondary"
    >
      <div className="space-y-3 pt-2">
        <Input
          label="What kind of issue? (optional)"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="e.g. audio, video, connection"
        />
        <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
          <span>Details (optional)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition-all focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20 placeholder:text-slate-400"
            placeholder="Briefly describe what happened"
          />
        </label>
        {error && <ApiErrorBanner category={error.category} message={error.message} />}
      </div>
    </ConfirmDialog>
  );
};

export default TechnicalIssueDialog;
