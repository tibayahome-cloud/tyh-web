import { useState } from "react";

import { ConfirmDialog } from "./ConfirmDialog";
import { ApiErrorBanner } from "./ApiErrorBanner";
import { useReportTechnicalIssueMutation } from "../hooks/useTelemedicine";
import { classifyApiError, type ClassifiedApiError } from "../utils/errors";
import { TECHNICAL_ISSUE_CATEGORIES, TECHNICAL_ISSUE_CATEGORY_LABEL, type TechnicalIssueCategory } from "../schemas/telemedicine";

type TechnicalIssueDialogProps = {
  open: boolean;
  bookingId: string;
  onClose: () => void;
  onReported?: () => void;
};

// This is a review flag, not a financial or dispute decision -- reporting never approves a
// refund, and the record's status is owned entirely by admin review, not by anything here.
// Both fields are required by the backend (report_technical_issue in telemedicine_service.py):
// category must be one of TECHNICAL_ISSUE_CATEGORIES or it 400s, description cannot be empty.
export const TechnicalIssueDialog = ({ open, bookingId, onClose, onReported }: TechnicalIssueDialogProps) => {
  const [category, setCategory] = useState<TechnicalIssueCategory | "">("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<ClassifiedApiError | null>(null);
  const reportMutation = useReportTechnicalIssueMutation();

  const descriptionError = touched && !description.trim() ? "Describe what happened." : null;
  const categoryError = touched && !category ? "Choose the kind of issue." : null;

  const handleClose = () => {
    if (reportMutation.isPending) return;
    setCategory("");
    setDescription("");
    setTouched(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setTouched(true);
    setError(null);
    if (!category || !description.trim()) {
      return;
    }
    try {
      await reportMutation.mutateAsync({ bookingId, category, description: description.trim() });
      setCategory("");
      setDescription("");
      setTouched(false);
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
      description="Let admin.ops know about a problem with this consultation. This is a review flag -- it doesn't request a refund by itself."
      confirmLabel="Report issue"
      confirmVariant="secondary"
    >
      <div className="space-y-3 pt-2">
        <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
          <span>What kind of issue?</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as TechnicalIssueCategory)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition-all focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
          >
            <option value="">Select an issue type</option>
            {TECHNICAL_ISSUE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {TECHNICAL_ISSUE_CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
          {categoryError && <span className="text-xs text-red-500">{categoryError}</span>}
        </label>
        <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
          <span>Details</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition-all focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20 placeholder:text-slate-400"
            placeholder="Briefly describe what happened"
          />
          {descriptionError && <span className="text-xs text-red-500">{descriptionError}</span>}
        </label>
        {error && <ApiErrorBanner category={error.category} message={error.message} />}
      </div>
    </ConfirmDialog>
  );
};

export default TechnicalIssueDialog;
