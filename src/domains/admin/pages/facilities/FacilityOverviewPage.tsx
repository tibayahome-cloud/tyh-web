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
import { fetchFacilities, fetchFacilityOverview } from "../../../../shared/libs/facilities";

const Metric = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
  <Card className="min-w-0" padding="default">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      </div>
      <span className="rounded-xl bg-slate-100 p-2 text-tiba-blue" aria-hidden>
        {icon}
      </span>
    </div>
  </Card>
);

const FacilityOverviewPage = () => {
  const facilitiesQuery = useQuery({
    queryKey: ["admin", "facility-scope"],
    queryFn: () => fetchFacilities({ pageSize: 5 })
  });
  const facilityId = facilitiesQuery.data?.facilities.length === 1 ? facilitiesQuery.data.facilities[0].id : undefined;
  const overviewQuery = useQuery({
    queryKey: ["admin", "facility-overview", facilityId],
    queryFn: () => fetchFacilityOverview(facilityId as string),
    enabled: Boolean(facilityId)
  });

  if (facilitiesQuery.isLoading || overviewQuery.isLoading) return <Loading fullHeight />;
  if (facilitiesQuery.isError || overviewQuery.isError) {
    return <Card title="Overview" description="The facility overview could not be loaded." />;
  }
  if (!facilityId || !overviewQuery.data) {
    return <Card title="Overview" description="Your admin.ops account is not linked to exactly one facility." />;
  }

  const { facility, metrics, readiness } = overviewQuery.data;
  const readinessItems = [
    { label: "Location", ready: readiness.locationReady, icon: <RoomIcon fontSize="small" /> },
    { label: "Contacts", ready: readiness.contactReady, icon: <BusinessIcon fontSize="small" /> },
    { label: "Operating hours", ready: readiness.operatingHoursConfigured, icon: <ScheduleIcon fontSize="small" /> }
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-tiba-blue">Admin ops</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">{facility.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Today&apos;s operational picture</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/facility/providers"><Button size="sm">Manage providers</Button></Link>
          <Link to="/admin/bookings"><Button size="sm" variant="outline">Open queue</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Open bookings" value={metrics.openBookings} icon={<AssignmentIcon />} />
        <Metric label="Needs assignment" value={metrics.unassignedBookings} icon={<AssignmentIcon />} />
        <Metric label="Providers" value={metrics.providersTotal} icon={<PeopleIcon />} />
        <Metric label="Active services" value={metrics.activeServices} icon={<BusinessIcon />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="Provider availability" subtitle="Current facility capacity">
          <div className="flex flex-wrap items-end gap-8">
            <div><p className="text-3xl font-bold text-slate-950">{metrics.providersAvailable}</p><p className="text-sm text-slate-500">Available now</p></div>
            <div><p className="text-3xl font-bold text-warning-600">{metrics.providersPendingVerification}</p><p className="text-sm text-slate-500">Awaiting verification</p></div>
          </div>
        </Card>
        <Card title="Facility readiness" subtitle="Complete these items to improve discovery and operations">
          <div className="space-y-3">
            {readinessItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-slate-700">{item.icon}{item.label}</span>
                <span className={item.ready ? "font-semibold text-emerald-600" : "font-semibold text-warning-600"}>{item.ready ? "Ready" : "Needs attention"}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FacilityOverviewPage;
