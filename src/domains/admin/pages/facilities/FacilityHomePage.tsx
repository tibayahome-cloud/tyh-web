import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link, Navigate } from "react-router-dom";
import BusinessIcon from "@mui/icons-material/BusinessOutlined";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import { fetchFacilities } from "../../../../shared/libs/facilities";
import type { Facility } from "../../../../shared/schemas/facility";

type FacilityWorkspaceResolution =
  | { kind: "workspace"; to: string }
  | { kind: "select"; options: Array<{ id: string; to: string }> }
  | { kind: "empty" };

// The API returns only the facilities this account may manage, so the list is the whole of what
// can be offered. Nothing here decides access: each workspace route asks the API again, and a
// facility that is not in the list is never linked to.
export const resolveFacilityWorkspaceRoute = (facilities: Facility[]): FacilityWorkspaceResolution => {
  if (facilities.length === 1) {
    return { kind: "workspace", to: `/admin/facilities/${facilities[0].id}` };
  }
  if (facilities.length > 1) {
    // A selector appears only when there is a real choice to make.
    return {
      kind: "select",
      options: facilities.map((facility) => ({ id: facility.id, to: `/admin/facilities/${facility.id}` }))
    };
  }
  return { kind: "empty" };
};

const extractErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const data = error.response?.data as { data?: { message?: string }; meta?: { message?: string } } | undefined;
    return data?.meta?.message ?? data?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "Request failed";
};

const STATUS_LABEL: Record<string, string> = { active: "Active", pending: "Pending approval", suspended: "Suspended" };

const FacilityHomePage = () => {
  const facilitiesQuery = useQuery({
    queryKey: ["admin", "facility-home"],
    queryFn: () => fetchFacilities({ pageSize: 50 })
  });

  if (facilitiesQuery.isLoading) {
    return (
      <Card>
        <Loading />
      </Card>
    );
  }

  if (facilitiesQuery.isError) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <BusinessIcon className="mt-0.5 text-slate-400" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Facility</h1>
            <p className="mt-1 text-sm text-danger-600" role="alert">
              {extractErrorMessage(facilitiesQuery.error)}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              loading={facilitiesQuery.isFetching}
              onClick={() => void facilitiesQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const facilities = facilitiesQuery.data?.facilities ?? [];
  const resolution = resolveFacilityWorkspaceRoute(facilities);

  if (resolution.kind === "workspace") {
    return <Navigate to={resolution.to} replace />;
  }

  if (resolution.kind === "select") {
    const byId = new Map(facilities.map((facility) => [facility.id, facility]));
    return (
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Choose a facility</h1>
        <p className="mt-1 text-sm text-slate-600">Your account can manage more than one facility. Pick the one to work in.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {resolution.options.map((option) => {
            const facility = byId.get(option.id);
            return (
              <li key={option.id}>
                <Link
                  to={option.to}
                  className="flex min-h-14 flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-tiba-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
                >
                  <span className="text-sm font-semibold text-slate-900">{facility?.name}</span>
                  <span className="mt-0.5 text-xs text-slate-500">
                    {[facility?.county, STATUS_LABEL[facility?.status ?? ""] ?? facility?.status].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <BusinessIcon className="mt-0.5 text-slate-400" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Facility</h1>
            <p className="mt-1 text-sm text-slate-600">
              No active facility is linked to your account yet. Contact support to have one assigned.
            </p>
          </div>
        </div>
        <Link
          to="/admin/conversations"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-tiba-blue px-5 text-sm font-bold text-white shadow-elevated transition hover:bg-blue-800 sm:w-auto"
        >
          Contact support
        </Link>
      </div>
    </Card>
  );
};

export default FacilityHomePage;
