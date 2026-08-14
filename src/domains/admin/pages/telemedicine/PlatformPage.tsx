import { Link } from "react-router-dom";
import { Activity, Globe2, ShieldCheck } from "lucide-react";

import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import { ApiErrorBanner } from "../../../../shared/components/ApiErrorBanner";
import { TechnicalIssueReviewList } from "../../../../shared/components/TechnicalIssueReviewList";
import { useJitsiHealth, useTechnicalIssues, useTelemedicinePolicy } from "../../../../shared/hooks/useTelemedicine";
import { classifyApiError } from "../../../../shared/utils/errors";

const JITSI_HEALTH_TONE: Record<string, string> = {
  healthy: "bg-emerald-100 text-emerald-700",
  degraded: "bg-amber-100 text-amber-700",
  unavailable: "bg-danger-100 text-danger-600"
};

// Platform-wide telemedicine monitoring for admin.super: policy configuration, Jitsi
// operational status, and platform-scoped review flags. Deliberately does not show room
// identifiers, tokens, or secrets -- and does not add global remote-capability or facility
// shutdown controls, since the backend has no documented contract for those yet.
const TelemedicinePlatformPage = () => {
  const policyQuery = useTelemedicinePolicy();
  const healthQuery = useJitsiHealth({ refetchInterval: 60_000 });
  const issuesQuery = useTechnicalIssues({ refetchInterval: 60_000 });

  const healthTone = healthQuery.data ? JITSI_HEALTH_TONE[healthQuery.data.status] ?? "bg-slate-100 text-slate-700" : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Telemedicine platform health</h1>
        <p className="text-sm text-slate-500">
          Policy configuration and Jitsi operational status across every facility.{" "}
          <Link to="/admin/telemedicine" className="font-medium text-tiba-blue hover:underline">
            View the operational assignment queue
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Remote consultation policy" badge={policyQuery.data?.policyVersion}>
          {policyQuery.isLoading ? (
            <Loading label="Loading policy…" />
          ) : policyQuery.isError ? (
            <ApiErrorBanner {...classifyApiError(policyQuery.error, "Unable to load policy.")} />
          ) : policyQuery.data ? (
            <dl className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Globe2 size={14} className="text-slate-400" />
                <dt className="text-slate-500">Supported countries</dt>
                <dd className="ml-auto font-medium text-slate-900">{policyQuery.data.supportedCountryCodes.join(", ") || "—"}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-slate-500">Display timezone</dt>
                <dd className="ml-auto font-medium text-slate-900">{policyQuery.data.defaultTimezone}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-slate-500">Join window</dt>
                <dd className="ml-auto font-medium text-slate-900">{policyQuery.data.joinWindowBeforeMinutes} min before</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-slate-500">Cancellation cutoff</dt>
                <dd className="ml-auto font-medium text-slate-900">{policyQuery.data.cancellationCutoffMinutes} min before</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-slate-500">Reminders</dt>
                <dd className="ml-auto font-medium text-slate-900">
                  {policyQuery.data.remindersEnabled ? "Enabled" : "Not yet enabled"}
                </dd>
              </div>
            </dl>
          ) : null}
        </Card>

        <Card title="Jitsi operational health">
          {healthQuery.isLoading ? (
            <Loading label="Checking Jitsi health…" />
          ) : healthQuery.isError ? (
            <ApiErrorBanner {...classifyApiError(healthQuery.error, "Unable to reach the Jitsi health check.")} />
          ) : healthQuery.data ? (
            <div className="space-y-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${healthTone}`}>
                <Activity size={12} />
                {healthQuery.data.status}
              </span>
              <dl className="space-y-2 text-sm">
                {healthQuery.data.latencyMs !== null && (
                  <div className="flex items-center gap-2">
                    <dt className="text-slate-500">Latency</dt>
                    <dd className="ml-auto font-medium text-slate-900">{healthQuery.data.latencyMs} ms</dd>
                  </div>
                )}
                {healthQuery.data.checkedAt && (
                  <div className="flex items-center gap-2">
                    <dt className="text-slate-500">Checked</dt>
                    <dd className="ml-auto font-medium text-slate-900">{new Date(healthQuery.data.checkedAt).toLocaleTimeString()}</dd>
                  </div>
                )}
                {healthQuery.data.errorCategory && (
                  <div className="flex items-center gap-2">
                    <dt className="text-slate-500">Issue</dt>
                    <dd className="ml-auto font-medium text-danger-600">{healthQuery.data.errorCategory}</dd>
                  </div>
                )}
              </dl>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck size={12} />
                Status only -- no room, token, or secret data is exposed here.
              </p>
            </div>
          ) : null}
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Platform review flags</h2>
        <p className="text-sm text-slate-500">Technical-issue reports across every facility.</p>
      </div>
      <Card padding="none" className="p-4 sm:p-6">
        <TechnicalIssueReviewList issues={issuesQuery.data ?? []} isLoading={issuesQuery.isLoading} />
      </Card>
    </div>
  );
};

export default TelemedicinePlatformPage;
