import { CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../../shared/components/Button";
import { SegmentedProgress } from "./SegmentedProgress";
import { describeOnboarding, type OnboardingSummary, type StatusTone } from "../../utils/onboardingStatus";

type Props = {
  summary: OnboardingSummary;
  starting: boolean;
  submitting: boolean;
  onStart: () => void;
  onSubmit: () => void;
  /** Whether the document list is already on the page below. */
  checklistShown?: boolean;
  /** Takes the provider to the document list. */
  onGoToDocuments?: () => void;
};

const TONES: Record<StatusTone, { box: string; icon: React.ReactNode }> = {
  neutral: { box: "border-slate-200 bg-white", icon: <FileText aria-hidden="true" className="h-6 w-6 text-slate-600" /> },
  info: { box: "border-sky-200 bg-sky-50", icon: <Clock aria-hidden="true" className="h-6 w-6 text-sky-700" /> },
  warning: { box: "border-amber-200 bg-amber-50", icon: <AlertTriangle aria-hidden="true" className="h-6 w-6 text-amber-700" /> },
  success: { box: "border-emerald-200 bg-emerald-50", icon: <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-emerald-700" /> }
};

/** The one status at the top of the page, in words, with the one thing to do next. */
export const OnboardingStatusCard = ({ summary, starting, submitting, onStart, onSubmit, checklistShown = false, onGoToDocuments }: Props) => {
  const copy = describeOnboarding(summary);
  const tone = TONES[copy.tone];
  const owesDocuments = !summary.documentsInOrder && summary.documentsDaysLeft !== null;
  const showProgress = summary.requiredTotal > 0 && (owesDocuments || !["verified", "set_up_by_facility"].includes(summary.status));

  return (
    <section aria-label="Verification status" className={`rounded-2xl border p-5 ${tone.box}`}>
      <div className="flex items-start gap-4">
        <span className="mt-0.5 shrink-0">{tone.icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">{copy.title}</h2>
          <p className="mt-1 text-sm text-slate-800">{copy.message}</p>

          {showProgress && (
            <div className="mt-4">
              <p className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-slate-900">
                  {summary.requiredDone} of {summary.requiredTotal}
                </span>
                <span className="text-sm text-slate-800">required documents sent</span>
              </p>
              <div className="mt-2">
                <SegmentedProgress done={summary.requiredDone} total={summary.requiredTotal} label="Documents provided" />
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {summary.status === "not_started" && (
              <Button type="button" className="min-h-[44px]" loading={starting} onClick={onStart}>
                Start verification
              </Button>
            )}
            {summary.status === "documents_needed" && summary.readyToSubmit && (
              <Button type="button" className="min-h-[44px]" loading={submitting} onClick={onSubmit}>
                Send for review
              </Button>
            )}
            {checklistShown && summary.nextItem && onGoToDocuments && ["documents_needed", "needs_changes"].includes(summary.status) && !summary.readyToSubmit && (
              <Button type="button" className="min-h-[44px]" onClick={onGoToDocuments}>
                Go to {summary.nextItem.label}
              </Button>
            )}
            {owesDocuments && !checklistShown && (
              <Button type="button" className="min-h-[44px]" loading={starting} onClick={onStart}>
                Add your documents
              </Button>
            )}
            {(summary.status === "verified" || summary.status === "set_up_by_facility") && (
              <Link
                to="/pro/availability"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-tiba-blue px-5 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-tiba-blue"
              >
                Set your hours
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
