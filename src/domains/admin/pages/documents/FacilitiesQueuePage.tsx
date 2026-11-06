import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/SearchOutlined";

import ApiErrorBanner from "../../../../shared/components/ApiErrorBanner";
import { Button } from "../../../../shared/components/Button";
import { Skeleton } from "../../../../shared/components/Skeleton";
import { classifyApiError } from "../../../../shared/utils/errors";
import { facilityQueueKey, fetchFacilityQueue, type FacilityQueueRow } from "./facilityDocumentsApi";
import { describeFacilityDue, describeFacilityRow } from "./facilityDocumentsDisplay";
import { REVIEW_STATES, type ReviewState } from "./reviewApi";
import { STATE_CHIP_LABEL, STATE_TAB_LABEL } from "./reviewDisplay";

const CHIP_TONE: Record<ReviewState, string> = {
  waiting: "bg-amber-50 text-amber-800 border-amber-200",
  sent_back: "bg-rose-50 text-rose-700 border-rose-200",
  incomplete: "bg-slate-100 text-slate-700 border-slate-200",
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200"
};

const EMPTY: Record<ReviewState, { title: string; hint: string }> = {
  waiting: { title: "Nothing is waiting for you", hint: "When a facility sends documents for review, they appear here." },
  sent_back: { title: "No documents are with a facility", hint: "Documents you send back for a change appear here until the facility replaces them." },
  incomplete: { title: "Every facility has sent what is needed", hint: "Facilities that have not finished their documents appear here." },
  complete: { title: "No facility is fully approved yet", hint: "Facilities whose required documents are all approved appear here." }
};

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue";
const isState = (value: string | null): value is ReviewState => REVIEW_STATES.includes(value as ReviewState);
const timeLabel = (millis: number): string =>
  millis ? new Date(millis).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }) : "";

const Row = ({ row }: { row: FacilityQueueRow }) => {
  const due = row.state === "complete" ? null : describeFacilityDue(row);
  return (
    <li>
      <Link
        to={`/admin/documents/facilities/${row.facility_id}`}
        className={`flex min-h-[72px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-tiba-blue ${focusRing}`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{row.facility_name}</p>
          <p className="mt-1 text-sm text-slate-600">{describeFacilityRow(row)}</p>
          {due && <p className="mt-0.5 text-xs font-medium text-amber-800">{due}</p>}
        </div>
        <span className={`hidden shrink-0 rounded-full border px-3 py-1 text-xs font-medium sm:inline-block ${CHIP_TONE[row.state]}`}>{STATE_CHIP_LABEL[row.state]}</span>
        <ChevronRightIcon aria-hidden className="shrink-0 text-slate-400" />
      </Link>
    </li>
  );
};

/** Facilities by whose turn it is, so the ones waiting for the super admin are always first. */
export const FacilitiesQueuePage = () => {
  const [params, setParams] = useSearchParams();
  const stateParam = params.get("state");
  const state: ReviewState = isState(stateParam) ? stateParam : "waiting";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (search.trim() === q.trim()) return;
      const next = new URLSearchParams(params);
      if (search.trim()) next.set("q", search.trim());
      else next.delete("q");
      next.delete("page");
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = useQuery({
    queryKey: facilityQueueKey({ state, search: q, page }),
    queryFn: () => fetchFacilityQueue({ state, search: q, page }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000
  });

  const go = (next: Partial<{ state: ReviewState; page: number }>) => {
    const target = new URLSearchParams(params);
    if (next.state) {
      target.set("state", next.state);
      target.delete("page");
    }
    if (next.page) target.set("page", String(next.page));
    setParams(target);
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!move) return;
    event.preventDefault();
    const nextIndex = (index + move + REVIEW_STATES.length) % REVIEW_STATES.length;
    go({ state: REVIEW_STATES[nextIndex] });
    tabRefs.current[nextIndex]?.focus();
  };

  const counts = query.data?.counts;
  const rows = query.data?.rows ?? [];
  const totalPages = query.data?.page.total_pages ?? 1;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Facility documents</h1>
        <p className="mt-1 text-sm text-slate-600">Every facility's documents. Open one to approve its documents, send one back, or add one for the facility.</p>
      </header>

      <div role="tablist" aria-label="Facilities by who is next" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {REVIEW_STATES.map((tab, index) => {
          const selected = tab === state;
          return (
            <button
              key={tab}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`facilities-tab-${tab}`}
              aria-selected={selected}
              aria-controls="facilities-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => go({ state: tab })}
              onKeyDown={(event) => onTabKey(event, index)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium ${focusRing} ${
                selected ? "border-tiba-blue bg-tiba-blue text-white" : "border-slate-200 bg-white text-slate-700 hover:border-tiba-blue"
              }`}
            >
              {STATE_TAB_LABEL[tab]}
              {counts && (
                <span aria-label={`${counts[tab]} facilities`} className={`rounded-full px-2 py-0.5 text-xs ${selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
                  {counts[tab]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <label className="relative block">
        <span className="sr-only">Search facilities by name</span>
        <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fontSize="small" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by facility name"
          className={`min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-500 ${focusRing}`}
        />
      </label>

      <section id="facilities-panel" role="tabpanel" aria-labelledby={`facilities-tab-${state}`} aria-live="polite">
        {query.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading facilities">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} height={88} rounded="lg" />
            ))}
          </div>
        ) : query.isError && !query.data ? (
          <ApiErrorBanner {...classifyApiError(query.error, "We couldn't load the facilities' documents.")} onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-semibold text-slate-900">{q ? "No facilities match your search" : EMPTY[state].title}</p>
            <p className="mt-1 text-sm text-slate-600">{q ? "Try a different name." : EMPTY[state].hint}</p>
          </div>
        ) : (
          <>
            {query.isError && (
              <div className="mb-3">
                <ApiErrorBanner {...classifyApiError(query.error, "We couldn't refresh the list. Showing what we had.")} onRetry={() => query.refetch()} />
              </div>
            )}
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <Row key={row.facility_id} row={row} />
              ))}
            </ul>
          </>
        )}
      </section>

      {totalPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <Button type="button" variant="secondary" size="sm" className="min-h-[44px]" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <Button type="button" variant="secondary" size="sm" className="min-h-[44px]" disabled={page >= totalPages} onClick={() => go({ page: page + 1 })}>
            Next
          </Button>
        </nav>
      )}

      <footer className="flex items-center justify-between text-xs text-slate-500">
        <span>{query.dataUpdatedAt ? `Updated ${timeLabel(query.dataUpdatedAt)} (Nairobi time)` : ""}</span>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className={`inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 font-medium text-tiba-blue disabled:opacity-60 ${focusRing}`}
        >
          <RefreshIcon aria-hidden fontSize="small" />
          {query.isFetching ? "Refreshing" : "Refresh"}
        </button>
      </footer>
    </div>
  );
};

export default FacilitiesQueuePage;
