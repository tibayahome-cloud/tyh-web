import classNames from "classnames";

export type BookingKindFilter = "all" | "video" | "home";

export const KIND_OPTIONS: Array<{ key: BookingKindFilter; label: string }> = [
  { key: "all", label: "All types" },
  { key: "video", label: "Video" },
  { key: "home", label: "Home visit" }
];

/** The server filter for a kind: undefined for all, true for video, false for home visits. */
export const kindToIsTelemedicine = (kind: BookingKindFilter): boolean | undefined =>
  kind === "video" ? true : kind === "home" ? false : undefined;

type Tab<K extends string> = { key: K; label: string; meaning?: string };

type Props<K extends string> = {
  statusTabs: ReadonlyArray<Tab<K>>;
  status: K;
  onStatusChange: (status: K) => void;
  kind: BookingKindFilter;
  onKindChange: (kind: BookingKindFilter) => void;
  /** Resets to the defaults (all statuses, all types). Offered only while something is filtered. */
  onReset: () => void;
  /** The key of the default status tab, so "Clear filters" knows when there is nothing to clear. */
  defaultStatus: K;
  className?: string;
};

// Every filter on a bookings list in one place: what state it is in (tabs) and what kind it is (video or home
// visit), with one Clear. Used by each role's booking list so the filters sit and behave the same everywhere.
export const BookingListFilters = <K extends string>({
  statusTabs,
  status,
  onStatusChange,
  kind,
  onKindChange,
  onReset,
  defaultStatus,
  className
}: Props<K>) => {
  const filtered = status !== defaultStatus || kind !== "all";

  return (
    <div role="group" aria-label="Filter bookings" className={classNames("space-y-2", className)}>
      <div role="tablist" aria-label="Booking status" className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={status === tab.key}
            onClick={() => onStatusChange(tab.key)}
            className={classNames(
              "min-h-[44px] min-w-[84px] flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue",
              status === tab.key ? "bg-white text-tiba-blue shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Booking type" className="flex flex-wrap items-center gap-1.5">
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={kind === option.key}
              onClick={() => onKindChange(option.key)}
              className={classNames(
                "min-h-[40px] rounded-full border px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue",
                kind === option.key
                  ? "border-tiba-blue bg-tiba-blue text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {filtered && (
          <button
            type="button"
            onClick={onReset}
            className="min-h-[40px] px-2 text-sm font-semibold text-tiba-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
};

export default BookingListFilters;
