import { useQuery } from "@tanstack/react-query";

import { Card } from "../../../../shared/components/Card";
import { fetchFacilities } from "../../../../shared/libs/facilities";

export const canUseGlobalPaymentLedger = (roles: string[]): boolean => {
  const roleSet = new Set(roles);
  return roleSet.has("admin.super") || roleSet.has("admin");
};

export const useAdminFacilityScope = (enabled: boolean) => {
  const query = useQuery({
    queryKey: ["admin", "facility-scope"],
    queryFn: () => fetchFacilities({ pageSize: 2 }),
    enabled
  });
  const facilities = query.data?.facilities ?? [];
  return {
    ...query,
    facility: facilities.length === 1 ? facilities[0] : null,
    hasInvalidScope: !query.isLoading && facilities.length !== 1
  };
};

export const FinanceScopeNotice = ({
  title = "Finance",
  description = "Facility finance summary is not available for this account.",
  detail = "Open Payments or Withdrawals to review facility-scoped records where available."
}: {
  title?: string;
  description?: string;
  detail?: string;
}) => (
  <Card>
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600">{description}</p>
      <p className="text-sm text-slate-500">{detail}</p>
    </div>
  </Card>
);
