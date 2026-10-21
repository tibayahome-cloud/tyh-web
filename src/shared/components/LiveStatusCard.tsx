import { CheckCircle2, CircleAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "./Card";
import { Loading } from "./Loading";
import { WidgetError } from "./WidgetError";
import type { LiveBlocker, LiveStatus } from "../libs/liveStatus";

// Where a blocker is fixed, from the point of view of whoever is looking. A facility admin can open the
// providers tab; a provider can only open their own hours. Return `hint` instead of a link when the person
// cannot fix it themselves, so they are told who can.
export type LiveFix = { label: string; to?: string; onClick?: () => void } | { hint: string };

type LiveStatusCardProps = {
  title: string;
  /** "facility" or "provider", used in the wording of the live message. */
  subject: "facility" | "provider";
  status: LiveStatus | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  resolveFix: (blocker: LiveBlocker) => LiveFix;
  className?: string;
};

const formatNextOpen = (iso: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const FixAction = ({ fix }: { fix: LiveFix }) => {
  if ("hint" in fix) return <span className="text-xs text-slate-600">{fix.hint}</span>;
  const className =
    "shrink-0 text-sm font-semibold text-tiba-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50";
  if (fix.to) {
    return (
      <Link to={fix.to} className={className}>
        {fix.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={fix.onClick} className={className}>
      {fix.label}
    </button>
  );
};

// One answer to "can clients book video consultations here, and if not, why?" It shows Live or Not live,
// the first thing in the way, every other blocker, and where to fix each. A failed request says so and offers
// a retry; it never reads as "Live" or "Not live".
export const LiveStatusCard = ({
  title,
  subject,
  status,
  isLoading,
  isError,
  onRetry,
  resolveFix,
  className
}: LiveStatusCardProps) => {
  if (isLoading) {
    return (
      <Card title={title} className={className}>
        <Loading label="Checking whether clients can book…" />
      </Card>
    );
  }
  if (isError || !status) {
    return (
      <Card title={title} className={className}>
        <WidgetError what="the live status" onRetry={onRetry} />
      </Card>
    );
  }

  const nextOpen = formatNextOpen(status.nextOpenAt);

  if (status.live) {
    return (
      <Card title={title} className={className}>
        <div className="flex items-start gap-3" role="status">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} aria-hidden />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Live</p>
            <p className="text-sm text-slate-700">
              Clients can book video consultations with this {subject}.
              {nextOpen ? ` Next free time: ${nextOpen}.` : ""}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title={title} className={className}>
      <div className="flex items-start gap-3" role="status">
        <CircleAlert className="mt-0.5 shrink-0 text-amber-600" size={20} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-amber-900">Not live</p>
          <p className="text-sm text-slate-700">
            Clients cannot book video consultations with this {subject} yet.
            {status.blockers.length > 1 ? ` ${status.blockers.length} things need fixing.` : ""}
          </p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-amber-100 rounded-xl bg-amber-50 ring-1 ring-amber-100">
        {status.blockers.map((blocker) => (
          <li key={blocker.code} className="flex items-center justify-between gap-3 px-3 py-3">
            <span className="text-sm text-slate-900">{blocker.message}</span>
            <FixAction fix={resolveFix(blocker)} />
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default LiveStatusCard;
