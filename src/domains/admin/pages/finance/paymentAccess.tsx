import { Card } from "../../../../shared/components/Card";

export const canUseGlobalPaymentLedger = (roles: string[]): boolean => {
  const roleSet = new Set(roles);
  return roleSet.has("admin.super") || roleSet.has("admin");
};

export const FinanceScopeNotice = () => (
  <Card>
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-slate-900">Finance</h1>
      <p className="text-sm text-slate-600">
        Facility-scoped payment reporting is not available from the backend yet.
      </p>
      <p className="text-sm text-slate-500">
        Facility wallet and automatic facility payout views stay hidden until the backend exposes scoped settlement data.
      </p>
    </div>
  </Card>
);
