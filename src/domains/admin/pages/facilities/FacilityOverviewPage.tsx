import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import BusinessIcon from "@mui/icons-material/BusinessOutlined";
import PeopleIcon from "@mui/icons-material/PeopleOutlineOutlined";
import RoomIcon from "@mui/icons-material/RoomOutlined";
import ScheduleIcon from "@mui/icons-material/ScheduleOutlined";

import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import { Button } from "../../../../shared/components/Button";
import { ApiErrorBanner } from "../../../../shared/components/ApiErrorBanner";
import { fetchFacilityOverview } from "../../../../shared/libs/facilities";
import { LiveStatusCard, type LiveFix } from "../../../../shared/components/LiveStatusCard";
import { useFacilityLiveStatus } from "../../../../shared/hooks/useLiveStatus";
import type { LiveBlocker } from "../../../../shared/libs/liveStatus";
import { classifyApiError } from "../../../../shared/utils/errors";
import type { FacilityOverview } from "../../../../shared/schemas/facility";
import { useAdminFacilityScope } from "../finance/paymentAccess";

type Attention = NonNullable<FacilityOverview["metrics"]["needsAttention"]>;

// Each row is one thing a person has to act on, with the screen where they do it.
const attentionRows = (attention: Attention) => [
  {
    key: "unassigned",
    count: attention.unassignedConsultations,
    label: "Paid consultations waiting for a provider",
    to: "/admin/telemedicine?tab=queue"
  },
  {
    key: "unattended",
    count: attention.unattendedConsultations,
    label: "Consultations nobody joined",
    to: "/admin/telemedicine?tab=queue"
  },
  {
    key: "review",
    count: attention.paymentReview,
    label: "Paid bookings cancelled and waiting for a payment decision",
    to: "/admin/telemedicine?tab=review"
  },
  {
    key: "awaiting",
    count: attention.awaitingResponse,
    label: "New times offered and waiting for an answer",
    to: "/admin/telemedicine?tab=consultations"
  }
];

const formatUpdated = (iso: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const Metric = ({
  label,
  value,
  icon,
  to,
  hint
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  to: string;
  hint?: string;
}) => (
  <Link
    to={to}
    className="block min-w-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
    aria-label={`${label}: ${value}. Open.`}
  >
    <Card className="h-full min-w-0 transition hover:shadow-md" padding="default">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
        </div>
        <span className="rounded-xl bg-slate-100 p-2 text-tiba-blue" aria-hidden>
          {icon}
        </span>
      </div>
    </Card>
  </Link>
);

const NeedsAttention = ({ attention }: { attention: Attention }) => {
  const rows = attentionRows(attention).filter((row) => row.count > 0);

  if (rows.length === 0) {
    return (
      <section aria-label="Needs attention" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">Nothing needs attention right now.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="needs-attention-heading" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden="true" />
        <h2 id="needs-attention-heading" className="text-sm font-bold text-slate-900">
          Needs attention ({attention.total})
        </h2>
      </div>
      <ul className="mt-3 divide-y divide-amber-100 rounded-xl bg-white ring-1 ring-amber-100">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              to={row.to}
              className="flex items-center justify-between gap-3 px-3 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tiba-blue/50"
            >
              <span className="text-slate-900">{row.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-sm font-bold text-rose-700">{row.count}</span>
                <span className="font-medium text-tiba-blue">Open</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

const FacilityOverviewPage = () => {
  const facilitiesQuery = useAdminFacilityScope(true);
  const facilityId = facilitiesQuery.facility?.id;
  const liveStatusQuery = useFacilityLiveStatus(facilityId);
  const overviewQuery = useQuery({
    queryKey: ["admin", "facility-overview", facilityId],
    queryFn: () => fetchFacilityOverview(facilityId as string),
    enabled: Boolean(facilityId)
  });

  // Each guard below reads only the query it names. Folding overviewQuery's own loading gap
  // into the facilityId check (as this used to) meant a plain "still fetching the overview"
  // moment briefly rendered as "not linked to a facility" -- overviewQuery.isLoading reports
  // false for the one render right after it goes from disabled to enabled, before its fetch has
  // actually started, so `!overviewQuery.data` alone caught that gap and misreported it.
  if (facilitiesQuery.isLoading) return <Loading fullHeight />;
  if (facilitiesQuery.isError) {
    return (
      <Card title="Overview">
        <ApiErrorBanner
          {...classifyApiError(facilitiesQuery.error, "We could not load your facility.")}
          onRetry={() => void facilitiesQuery.refetch()}
        />
      </Card>
    );
  }
  if (!facilityId) {
    return <Card title="Overview" description="Your admin.ops account is not linked to exactly one facility." />;
  }
  if (overviewQuery.isError) {
    return (
      <Card title="Overview">
        <ApiErrorBanner
          {...classifyApiError(overviewQuery.error, "We could not load the facility overview.")}
          onRetry={() => void overviewQuery.refetch()}
        />
      </Card>
    );
  }
  if (overviewQuery.isLoading || !overviewQuery.data) return <Loading fullHeight />;

  const { facility, metrics, readiness } = overviewQuery.data;
  const updated = formatUpdated(metrics.asOf);
  const workspace = `/admin/facilities/${facility.id}`;
  // A facility admin can open services and providers; the rest is a platform admin's to change.
  const resolveLiveFix = (blocker: LiveBlocker): LiveFix => {
    switch (blocker.fix) {
      case "facility_services":
        return { label: "Open services", to: workspace };
      case "facility_providers":
      case "provider_availability":
        return { label: "Open providers", to: "/admin/facility/providers" };
      case "facility_status":
      case "facility_location":
        return { hint: "Ask a platform admin." };
      default:
        return { hint: "Check the facility settings." };
    }
  };
  const readinessItems = [
    { label: "Location", ready: readiness.locationReady, icon: <RoomIcon fontSize="small" /> },
    { label: "Contacts", ready: readiness.contactReady, icon: <BusinessIcon fontSize="small" /> },
    { label: "Operating hours", ready: readiness.operatingHoursConfigured, icon: <ScheduleIcon fontSize="small" /> }
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">{facility.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Open work including telemedicine consultations{updated ? `. Updated ${updated}.` : "."}
            <button
              type="button"
              onClick={() => void overviewQuery.refetch()}
              className="ml-2 font-medium text-tiba-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
            >
              Refresh
            </button>
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/facility/providers"><Button size="sm">Manage providers</Button></Link>
          <Link to="/admin/bookings"><Button size="sm" variant="outline">Open queue</Button></Link>
        </div>
      </div>

      {metrics.needsAttention && <NeedsAttention attention={metrics.needsAttention} />}

      <LiveStatusCard
        title="Live for telemedicine"
        subject="facility"
        status={liveStatusQuery.data}
        isLoading={liveStatusQuery.isLoading}
        isError={liveStatusQuery.isError}
        onRetry={() => void liveStatusQuery.refetch()}
        resolveFix={resolveLiveFix}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Open bookings"
          value={metrics.openBookings}
          icon={<AssignmentIcon />}
          to="/admin/bookings"
          hint="Includes booked consultations"
        />
        <Metric
          label="Needs a provider"
          value={metrics.unassignedBookings}
          icon={<AssignmentIcon />}
          to="/admin/telemedicine?tab=queue"
        />
        <Metric label="Providers" value={metrics.providersTotal} icon={<PeopleIcon />} to="/admin/facility/providers" />
        <Metric label="Active services" value={metrics.activeServices} icon={<BusinessIcon />} to={workspace} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="Provider availability" subtitle="Current facility capacity">
          <div className="flex flex-wrap items-end gap-8">
            <div><p className="text-3xl font-bold text-slate-950">{metrics.providersAvailable}</p><p className="text-sm text-slate-600">Available now</p></div>
            <div><p className="text-3xl font-bold text-warning-600">{metrics.providersPendingVerification}</p><p className="text-sm text-slate-600">Awaiting verification</p></div>
          </div>
        </Card>
        <Card title="Facility readiness" subtitle="Complete these items to improve discovery and operations">
          <div className="space-y-3">
            {readinessItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-slate-700">{item.icon}{item.label}</span>
                {item.ready ? (
                  <span className="font-semibold text-emerald-600">Ready</span>
                ) : (
                  <Link
                    to={workspace}
                    className="font-semibold text-warning-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
                  >
                    Needs attention. Fix it
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FacilityOverviewPage;
