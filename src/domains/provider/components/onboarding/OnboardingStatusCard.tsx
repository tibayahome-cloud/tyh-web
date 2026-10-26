import { CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../../shared/components/Button";
import { describeOnboarding, type OnboardingSummary, type StatusTone } from "../../utils/onboardingStatus";

type Props = {
  summary: OnboardingSummary;
  starting: boolean;
  submitting: boolean;
  onStart: () => void;
  onSubmit: () => void;
  /** Whether the document list is already on the page below. */
  checklistShown?: boolean;
};

const TONES: Record<StatusTone, { box: string; icon: React.ReactNode }> = {
  neutral: { box: "border-slate-200 bg-white", icon: <FileText aria-hidden="true" className="h-6 w-6 text-slate-600" /> },
  info: { box: "border-sky-200 bg-sky-50", icon: <Clock aria-hidden="true" className="h-6 w-6 text-sky-700" /> },
  warning: { box: "border-amber-200 bg-amber-50", icon: <AlertTriangle aria-hidden="true" className="h-6 w-6 text-amber-700" /> },
  success: { box: "border-emerald-200 bg-emerald-50", icon: <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-emerald-700" /> }
};

/** The one status at the top of the page, in words, with the one thing to do next. */
export const OnboardingStatusCard = ({ summary, starting, submitting, onStart, onSubmit, checklistShown = false }: Props) => {
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
            <div className="mt-3">
              <div
                role="progressbar"
                aria-label="Documents provided"
                aria-valuemin={0}
                aria-valuemax={summary.requiredTotal}
                aria-valuenow={summary.requiredDone}
                className="h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-slate-200"
              >
                <div className="h-full rounded-full bg-tiba-blue" style={{ width: `${(summary.requiredDone / summary.requiredTotal) * 100}%` }} />
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {summary.requiredDone} of {summary.requiredTotal} required provided
              </p>
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
