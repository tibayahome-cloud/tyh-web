import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

import { SegmentedProgress } from "./onboarding/SegmentedProgress";
import { describeDaysLeft } from "../utils/onboardingStatus";
import { useOnboardingStatus } from "../hooks/useOnboardingStatus";

/**
 * Shown on the provider's home only while required documents are still owed. A provider who is already working
 * keeps working until the date; this says when, and takes them to the one place to add them.
 */
export const DocumentsDueCard = () => {
  const { data } = useOnboardingStatus();
  if (!data || data.documentsInOrder || data.documentsDaysLeft === null) return null;

  const days = data.documentsDaysLeft;
  const urgent = days <= 7;
  return (
    <section
      aria-label="Documents due"
      className={`rounded-2xl border p-4 ${urgent ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${urgent ? "text-rose-700" : "text-amber-700"}`} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">Add your documents {describeDaysLeft(days)}</h2>
          <p className="mt-1 text-sm text-slate-800">
            Clients keep booking you until then. After that, new bookings pause until your documents are checked.
          </p>
          {data.requiredTotal > 0 && (
            <div className="mt-3 max-w-xs">
              <p className="mb-1 text-sm font-medium tabular-nums text-slate-900">
                {data.requiredDone} of {data.requiredTotal} required documents sent
              </p>
              <SegmentedProgress done={data.requiredDone} total={data.requiredTotal} label="Required documents sent" />
            </div>
          )}
          <Link
            to="/pro/onboarding"
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-tiba-blue px-5 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-tiba-blue"
          >
            Add documents
          </Link>
        </div>
      </div>
    </section>
  );
};
