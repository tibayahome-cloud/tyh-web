import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link, Navigate } from "react-router-dom";
import BusinessIcon from "@mui/icons-material/BusinessOutlined";

import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import { fetchFacilities } from "../../../../shared/libs/facilities";
import type { Facility } from "../../../../shared/schemas/facility";

type FacilityWorkspaceResolution =
  | { kind: "workspace"; to: string }
  | { kind: "scope_error" }
  | { kind: "empty" };

/** Resolve the tenant workspace route from the backend-scoped facility list. */
export const resolveFacilityWorkspaceRoute = (facilities: Facility[]): FacilityWorkspaceResolution => {
  if (facilities.length === 1) {
    return { kind: "workspace", to: `/admin/facilities/${facilities[0].id}` };
  }
  if (facilities.length > 1) {
    return { kind: "scope_error" };
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

const FacilityHomePage = () => {
  const facilitiesQuery = useQuery({
    queryKey: ["admin", "facility-home"],
    queryFn: () => fetchFacilities({ pageSize: 5 })
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
            <p className="mt-1 text-sm text-danger-600">{extractErrorMessage(facilitiesQuery.error)}</p>
          </div>
        </div>
      </Card>
    );
  }

  const facilities = facilitiesQuery.data?.facilities ?? [];
  const resolution = resolveFacilityWorkspaceRoute(facilities);

  if (resolution.kind === "workspace") {
    return <Navigate to="/admin/facility/overview" replace />;
  }

  const hasScopeError = resolution.kind === "scope_error";

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <BusinessIcon className="mt-0.5 text-slate-400" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Facility</h1>
            <p className="mt-1 text-sm text-slate-600">
              {hasScopeError
                ? "Your admin ops account is linked to more than one facility. Access is blocked until the facility assignment is corrected."
                : "No active facility is linked to your admin ops account yet."}
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
