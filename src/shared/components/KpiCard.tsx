import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type KpiAction = { label: string; to: string };

type KpiCardProps = {
  // What the number is, in the person's words.
  label: string;
  value: ReactNode;
  // What the number is measured against or covers: "of 12 providers", "All time", "Right now".
  caption?: string;
  action?: KpiAction;
  icon?: ReactNode;
  className?: string;
  // Supporting figures for the same subject, shown under the main number.
  children?: ReactNode;
};

// One shape for a headline number everywhere: label, value, what it covers, and what to do about it. A bare
// number is unfinished, so a caption is expected; the action is for the one thing a person would do next.
export const KpiCard = ({ label, value, caption, action, icon, className = "", children }: KpiCardProps) => (
  <div role="group" aria-label={label} className={`min-w-0 rounded-xl bg-white p-4 ring-1 ring-slate-200 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
        {caption && <p className="mt-0.5 text-sm text-slate-600">{caption}</p>}
      </div>
      {icon && (
        <span className="shrink-0 rounded-lg bg-slate-100 p-2 text-tiba-blue" aria-hidden>
          {icon}
        </span>
      )}
    </div>
    {children && <div className="mt-3 border-t border-slate-100 pt-3">{children}</div>}
    {action && (
      <Link
        to={action.to}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-tiba-blue px-4 text-sm font-semibold text-white hover:bg-tiba-blue/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50 focus-visible:ring-offset-2"
      >
        {action.label}
      </Link>
    )}
  </div>
);

export default KpiCard;
