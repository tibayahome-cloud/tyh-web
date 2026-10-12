import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { Loading } from "../../../shared/components/Loading";
import { fetchFacilityBookings, type FacilityBookingKindCounts } from "../../../shared/libs/facilities";
import type { Booking } from "../../../shared/schemas/booking";
import { getApiError } from "../../../shared/utils/errors";
import {
  BOOKING_GROUPS,
  BOOKING_GROUP_LABEL,
  canAssignStatus,
  groupCount,
  statusFilterFor,
  statusLabel,
  type BookingGroup
} from "../../../shared/utils/facilityBookings";
import type { ServiceKind } from "../../../shared/utils/facilityServiceKinds";
import { ServiceKindTabs } from "./ServiceKindTabs";

const PAGE_SIZE = 15;
const EMPTY_COUNTS: FacilityBookingKindCounts = { total: 0, byStatus: {} };

const money = (cents: number, currency: string | null | undefined) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: currency || "KES", maximumFractionDigits: 0 }).format(cents / 100);

type Props = {
  facilityId: string;
  // Assign or reassign a provider. Omit to make the list read-only.
  onAssign?: (booking: Booking) => void;
};

const BookingRow = ({ booking, onAssign }: { booking: Booking; onAssign?: (booking: Booking) => void }) => {
  const when = booking.scheduledAt ?? booking.createdAt;
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{booking.service?.name ?? "Service"}</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {booking.client?.fullName ?? "Client"}
            {when ? ` · ${booking.scheduledAt ? "" : "Requested "}${new Date(when).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{statusLabel(booking.status)}</span>
          {booking.isTelemedicine && <span className="rounded-full bg-tiba-blue/10 px-2.5 py-1 text-tiba-blue">Video consultation</span>}
          <span className={`rounded-full px-2.5 py-1 ${booking.paidAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            {booking.paidAt ? "Paid" : "Not paid"}
          </span>
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold text-slate-500">Provider</dt>
          <dd className="mt-0.5 text-slate-800">{booking.provider?.fullName ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500">Amount</dt>
          <dd className="mt-0.5 text-slate-800">{money(booking.priceCents, booking.currency)}</dd>
        </div>
        {booking.isTelemedicine && booking.telemedicineSession && (
          <div>
            <dt className="text-xs font-semibold text-slate-500">Video session</dt>
            <dd className="mt-0.5 text-slate-800">{statusLabel(booking.telemedicineSession.status)}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Link
          to={`/admin/bookings/${booking.id}`}
          aria-label={`View booking for ${booking.client?.fullName ?? "client"}, ${booking.service?.name ?? "service"}`}
          className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-tiba-blue hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-tiba-blue/30"
        >
          View booking
        </Link>
        {onAssign && canAssignStatus(booking.status) && (
          <Button size="sm" variant="outline" onClick={() => onAssign(booking)}>
            {booking.provider ? "Reassign provider" : "Assign provider"}
          </Button>
        )}
      </div>
    </li>
  );
};

// A facility's bookings, home-based care and telemedicine apart, filtered by what needs doing. For
// a super admin acting as support when a facility admin is stuck; the facility's own admins see
// the same list for their facility.
export const FacilityBookingsPanel = ({ facilityId, onAssign }: Props) => {
  const [kind, setKind] = useState<ServiceKind | null>(null);
  const [group, setGroup] = useState<BookingGroup>("attention");
  const [page, setPage] = useState(1);
  const activeKind: ServiceKind = kind ?? "home";

  const query = useQuery({
    queryKey: ["admin", "facilities", facilityId, "bookings", "list", activeKind, group, page],
    queryFn: () =>
      fetchFacilityBookings(facilityId, {
        page,
        pageSize: PAGE_SIZE,
        status: statusFilterFor(group),
        isTelemedicine: activeKind === "telemedicine"
      }),
    placeholderData: keepPreviousData
  });

  const counts = query.data?.counts ?? null;
  const kindCounts = counts ? counts[activeKind === "home" ? "home" : "telemedicine"] : EMPTY_COUNTS;

  // Open on telemedicine when the facility has only telemedicine bookings, once that is known.
  useEffect(() => {
    if (kind === null && counts && counts.home.total === 0 && counts.telemedicine.total > 0) setKind("telemedicine");
  }, [kind, counts]);

  const tabCounts = useMemo(
    () => ({
      home: { active: groupCount("attention", counts?.home.byStatus ?? {}, 0), total: counts?.home.total ?? 0 },
      telemedicine: { active: groupCount("attention", counts?.telemedicine.byStatus ?? {}, 0), total: counts?.telemedicine.total ?? 0 }
    }),
    [counts]
  );
  // An API that predates the kind filter ignores it and sends no counts: both tabs would then list
  // every booking, so say so rather than let the split look real.
  const splitUnsupported = Boolean(query.data) && query.data?.counts === null;
  const bookings = query.data?.bookings ?? [];
  const totalPages = query.data?.meta?.page?.totalPages ?? 1;

  const select = (next: () => void) => {
    next();
    setPage(1);
  };

  return (
    <Card title="Facility bookings" description="Home-based care and telemedicine bookings for this facility, apart.">
      <ServiceKindTabs
        active={activeKind}
        counts={tabCounts}
        label="Booking type"
        panelId="facility-bookings-panel"
        caption={(_kindName, value) => (counts ? `${value.active} need attention of ${value.total}` : "")}
        onChange={(next) => select(() => setKind(next))}
      />
      <div id="facility-bookings-panel" role="tabpanel" aria-labelledby={`facility-bookings-panel-${activeKind}`}>
        {splitUnsupported && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
            This server cannot yet separate telemedicine from home-based care, so both tabs list every booking.
          </p>
        )}
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Booking status">
          {BOOKING_GROUPS.map((value) => {
            const selected = group === value;
            const count = counts ? groupCount(value, kindCounts.byStatus, kindCounts.total) : null;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => select(() => setGroup(value))}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition focus:outline-none focus:ring-2 focus:ring-tiba-blue/40 ${selected ? "bg-tiba-blue text-white ring-tiba-blue" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}
              >
                {BOOKING_GROUP_LABEL[value]}
                {count !== null && <span className="ml-1.5 opacity-80">{count}</span>}
              </button>
            );
          })}
        </div>

        {query.isLoading ? (
          <Loading />
        ) : query.isError && !query.data ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-danger-600" role="alert">
              {getApiError(query.error, "We could not load the bookings.")}
            </p>
            <Button size="sm" variant="outline" loading={query.isFetching} onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        ) : bookings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-600">
            {group === "all"
              ? `No ${activeKind === "telemedicine" ? "telemedicine" : "home-based care"} bookings for this facility yet.`
              : `No ${activeKind === "telemedicine" ? "telemedicine" : "home-based care"} bookings in "${BOOKING_GROUP_LABEL[group]}".`}
          </p>
        ) : (
          <>
            {query.isError && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                We could not refresh the bookings. Showing the last results that loaded.
              </p>
            )}
            <ul className={`grid gap-3 ${query.isPlaceholderData ? "opacity-60" : ""}`} aria-label="Bookings" aria-busy={query.isPlaceholderData}>
              {bookings.map((booking) => (
                <BookingRow key={booking.id} booking={booking} onAssign={onAssign} />
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={page <= 1 || query.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    Previous
                  </Button>
                  <Button size="sm" variant="secondary" disabled={page >= totalPages || query.isFetching} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
};
