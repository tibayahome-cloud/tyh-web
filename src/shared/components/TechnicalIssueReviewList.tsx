import { useState } from "react";

import { Button } from "./Button";
import { ApiErrorBanner } from "./ApiErrorBanner";
import { Loading } from "./Loading";
import { useToast } from "./ToastProvider";
import { useReviewTechnicalIssueMutation } from "../hooks/useTelemedicine";
import { classifyApiError, type ClassifiedApiError } from "../utils/errors";
import type { TelemedicineTechnicalIssue } from "../schemas/telemedicine";

const TECHNICAL_ISSUE_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved"
};

const ReviewFlagRow = ({ issue }: { issue: TelemedicineTechnicalIssue }) => {
  const toast = useToast();
  const [reviewError, setReviewError] = useState<ClassifiedApiError | null>(null);
  const reviewMutation = useReviewTechnicalIssueMutation();

  const handleReview = async (status: "under_review" | "resolved") => {
    setReviewError(null);
    try {
      await reviewMutation.mutateAsync({ issueId: issue.id, status });
      toast.showToast({ title: status === "resolved" ? "Marked resolved" : "Marked under review", variant: "success" });
    } catch (error) {
      setReviewError(classifyApiError(error, "Unable to update this report."));
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{issue.category ?? "Technical issue"}</p>
          <p className="text-xs text-slate-500">Reported by {issue.reporterRole} · Booking {issue.bookingId}</p>
          {issue.description && <p className="mt-1 text-sm text-slate-600">{issue.description}</p>}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {TECHNICAL_ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
          </span>
          {issue.status !== "resolved" && (
            <div className="flex flex-wrap gap-2">
              {issue.status === "open" && (
                <Button size="sm" variant="ghost" loading={reviewMutation.isPending} onClick={() => handleReview("under_review")}>
                  Start review
                </Button>
              )}
              <Button size="sm" variant="secondary" loading={reviewMutation.isPending} onClick={() => handleReview("resolved")}>
                Mark resolved
              </Button>
            </div>
          )}
        </div>
      </div>
      {reviewError && (
        <div className="mt-3">
          <ApiErrorBanner category={reviewError.category} message={reviewError.message} />
        </div>
      )}
    </div>
  );
};

type TechnicalIssueReviewListProps = {
  issues: TelemedicineTechnicalIssue[];
  isLoading: boolean;
  emptyLabel?: string;
};

// Shared between the facility-scoped admin.ops queue and the platform-wide super-admin view --
// the backend scopes GET /telemedicine/technical-issues per caller role, so the same list UI
// works for both; only which issues are fetched differs.
export const TechnicalIssueReviewList = ({ issues, isLoading, emptyLabel = "No open reports." }: TechnicalIssueReviewListProps) => {
  const openIssues = issues.filter((issue) => issue.status !== "resolved");

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Loading label="Loading review flags…" />
      </div>
    );
  }
  if (openIssues.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      {openIssues.map((issue) => (
        <ReviewFlagRow key={issue.id} issue={issue} />
      ))}
    </div>
  );
};

export default TechnicalIssueReviewList;
