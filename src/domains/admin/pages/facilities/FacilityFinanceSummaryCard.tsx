import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import { Button } from "../../../../shared/components/Button";
import { fetchFacilityEarningsSummary } from "../../../../shared/libs/wallet";

const formatKES = (cents: number | undefined | null) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(
    (cents ?? 0) / 100
  );

/**
 * A one-line finance summary for the facility detail page. The full wallet, payout
 * destination, withdrawal, and payment history experience lives on the Payments tab
 * (see FacilityFinancePanel) -- this card exists only so the detail page doesn't need
 * its own copy of that workspace, keeping the facility page short.
 */
export const FacilityFinanceSummaryCard = ({ facilityId }: { facilityId: string }) => {
  const walletQuery = useQuery({
    queryKey: ["admin", "facilities", facilityId, "wallet-summary"],
    queryFn: () => fetchFacilityEarningsSummary(facilityId)
  });

  return (
    <Card
      title="Finance"
      description="Wallet balance, payouts, and payment history for this facility."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {walletQuery.isLoading ? (
          <Loading />
        ) : walletQuery.isError ? (
          <p className="text-sm text-slate-500">Finance summary is unavailable right now.</p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <span className="font-semibold text-slate-900">{formatKES(walletQuery.data?.availableBalanceCents)}</span>{" "}
              <span className="text-slate-500">available</span>
            </span>
            <span>
              <span className="font-semibold text-slate-900">{formatKES(walletQuery.data?.pendingEarningsCents)}</span>{" "}
              <span className="text-slate-500">pending</span>
            </span>
          </div>
        )}
        <Link to={`/admin/finance/payments?facilityId=${facilityId}`}>
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
            Manage funds
          </Button>
        </Link>
      </div>
    </Card>
  );
};

export default FacilityFinanceSummaryCard;
