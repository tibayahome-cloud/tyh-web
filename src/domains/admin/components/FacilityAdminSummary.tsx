import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useOnceVisible } from "../../../shared/hooks/useOnceVisible";
import { fetchFacilityAdminAccess } from "../../../shared/libs/facilities";
import { facilityAdminAccessState } from "../../../shared/utils/facilityAdminAccess";

// One line of administrator access for a facility row, e.g. "1 active, 1 setup pending". The
// facilities list endpoint does not carry administrators, so this loads the list once the row is on
// screen and shares its cache with the facility workspace. Removed assignments are not counted.
export const FacilityAdminSummary = ({
  facilityId,
  summary
}: {
  facilityId: string;
  // The counts the facilities list now carries. When present nothing is loaded per row.
  summary?: { active: number; pendingSetup: number; suspended: number } | null;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useOnceVisible(ref);
  const query = useQuery({
    queryKey: ["admin", "facilities", facilityId, "admins"],
    queryFn: () => fetchFacilityAdminAccess(facilityId),
    enabled: visible && !summary,
    staleTime: 60_000
  });

  let content: string;
  let tone = "text-slate-800";
  if (summary) {
    const total = summary.active + summary.pendingSetup + summary.suspended;
    const parts = [
      summary.active ? `${summary.active} active` : null,
      summary.pendingSetup ? `${summary.pendingSetup} setup pending` : null,
      summary.suspended ? `${summary.suspended} suspended` : null
    ].filter(Boolean);
    if (total === 0) {
      content = "No administrator";
      tone = "font-medium text-amber-800";
    } else {
      content = parts.join(", ");
    }
  } else if (!visible || query.isLoading) {
    content = "Loading...";
    tone = "text-slate-400";
  } else if (query.isError) {
    content = "Could not load";
    tone = "text-slate-500";
  } else {
    const states = (query.data ?? []).map(facilityAdminAccessState).filter((state) => state.access !== "Access removed");
    const active = states.filter((s) => s.access === "Access active" && s.account === "Account active").length;
    const pending = states.filter((s) => s.access === "Access active" && (s.account === "Setup pending" || s.account === "Invitation expired")).length;
    const suspended = states.filter((s) => s.access === "Access suspended").length;
    const parts = [
      active ? `${active} active` : null,
      pending ? `${pending} setup pending` : null,
      suspended ? `${suspended} suspended` : null
    ].filter(Boolean);
    if (states.length === 0) {
      content = "No administrator";
      tone = "font-medium text-amber-800";
    } else {
      content = parts.length ? parts.join(", ") : `${states.length} administrator${states.length === 1 ? "" : "s"}`;
    }
  }

  return (
    <span ref={ref} className={tone} aria-live="polite">
      {content}
    </span>
  );
};
