import classNames from "classnames";

type MetricCardProps = {
  title: string;
  value: number | string;
  helper?: string;
  loading?: boolean;
};

const numberFormatter = new Intl.NumberFormat();

export const MetricCard = ({ title, value, helper, loading }: MetricCardProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        {loading ? (
          <span className="h-6 w-16 animate-pulse rounded bg-slate-200" aria-hidden />
        ) : (
          <span className="text-2xl font-semibold text-slate-900">
            {typeof value === "number" ? numberFormatter.format(value) : value}
          </span>
        )}
      </div>
      <p
        className={classNames(
          "mt-1 text-xs text-slate-500",
          loading && "h-3 w-24 animate-pulse rounded bg-slate-200 text-transparent"
        )}
      >
        {helper}
      </p>
    </div>
  );
};

export default MetricCard;
