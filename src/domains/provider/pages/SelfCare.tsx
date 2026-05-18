import { useEffect, useMemo, useState } from "react";
import { MessageCircle, CheckCircle2, XCircle, Activity, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import classNames from "classnames";

import { Card } from "../../../shared/components/Card";
import { Button } from "../../../shared/components/Button";
import { Spinner } from "../../../shared/components/Spinner";
import { useToast } from "../../../shared/components/ToastProvider";
import {
  useSelfCareAlerts,
  useSelfCareProfile,
  useSelfCareCheckins,
  useAcknowledgeSelfCareAlertMutation,
  useCloseSelfCareAlertMutation
} from "../../../shared/hooks/useSelfCare";
import type { SelfCareAlert, SelfCareCheckin } from "../../../shared/schemas/selfcare";
import { useCreateThread } from "../../../shared/hooks/useMessaging";
import { useAuth } from "../../../shared/hooks/useAuth";

const riskTone: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  moderate: "bg-amber-50 text-amber-700 ring-amber-100",
  high: "bg-orange-50 text-orange-700 ring-orange-100",
  emergency: "bg-rose-50 text-rose-700 ring-rose-100"
};

const statusTone: Record<string, string> = {
  new: "bg-brand-50 text-brand-700 ring-brand-100",
  acknowledged: "bg-slate-100 text-slate-700 ring-slate-200",
  in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  closed: "bg-slate-200 text-slate-700 ring-slate-300"
};

const formatLoggerName = (entry: SelfCareCheckin) => {
  return entry.user?.fullName || entry.user?.email || "Client";
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) {
    return "N/A";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const AlertListItem = ({
  alert,
  isActive,
  onSelect
}: {
  alert: SelfCareAlert;
  isActive: boolean;
  onSelect: (alertId: string) => void;
}) => {
  const riskLabel = alert.riskLevel?.toLowerCase() ?? "moderate";
  return (
    <button
      type="button"
      onClick={() => onSelect(alert.id)}
      className={classNames(
        "group w-full rounded-2xl border p-4 text-left transition-all duration-300",
        isActive
          ? "border-brand-200 bg-brand-50/40 shadow-lg ring-1 ring-brand-500/10"
          : "border-white/60 bg-white/40 hover:bg-white/60 hover:shadow-md backdrop-blur-sm"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
            {alert.client?.fullName ?? "Client"}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500 line-clamp-1">
            {alert.reason ?? "AI flagged a concern"}
          </p>
        </div>
        <span className={classNames(
          "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1",
          riskTone[riskLabel] ?? riskTone.moderate
        )}>
          {riskLabel}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
        <span className={classNames("rounded-full px-2 py-0.5 ring-1", statusTone[alert.status] ?? statusTone.new)}>
          {alert.status.replace(/_/g, " ")}
        </span>
        <span>{formatDateTime(alert.createdAt)}</span>
      </div>
    </button>
  );
};

const ProviderSelfCarePage = () => {
  const [statusFilter, setStatusFilter] = useState<"new" | "acknowledged" | "closed" | "all">("new");
  const [riskFilter, setRiskFilter] = useState<"all" | "moderate" | "high" | "emergency">("all");
  const alertsQuery = useSelfCareAlerts({
    status: statusFilter === "all" ? undefined : statusFilter,
    riskLevel: riskFilter === "all" ? undefined : riskFilter,
    limit: 50
  });
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const acknowledgeAlert = useAcknowledgeSelfCareAlertMutation();
  const closeAlert = useCloseSelfCareAlertMutation();
  const createThread = useCreateThread();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const acknowledgingId = acknowledgeAlert.variables;
  const closingAlertId = (closeAlert.variables as { alertId?: string } | undefined)?.alertId ?? null;

  const alerts = alertsQuery.data ?? [];
  const selectedAlert = useMemo(() => {
    const source = alertsQuery.data ?? [];
    if (!selectedAlertId) {
      return source[0] ?? null;
    }
    return source.find((alert) => alert.id === selectedAlertId) ?? source[0] ?? null;
  }, [alertsQuery.data, selectedAlertId]);

  useEffect(() => {
    const source = alertsQuery.data ?? [];
    if (source.length && !selectedAlertId) {
      setSelectedAlertId(source[0].id);
    }
  }, [alertsQuery.data, selectedAlertId]);

  const profileQuery = useSelfCareProfile(selectedAlert?.clientUserId ?? null, {
    enabled: Boolean(selectedAlert?.clientUserId)
  });
  const historyQuery = useSelfCareCheckins(selectedAlert?.clientUserId ?? null, {
    limit: 5,
    enabled: Boolean(selectedAlert?.clientUserId)
  });

  const handleAcknowledge = (alert: SelfCareAlert | null) => {
    if (!alert) {
      return;
    }
    acknowledgeAlert
      .mutateAsync(alert.id)
      .then(() => {
        showToast({
          title: "Alert acknowledged",
          description: "We'll keep it in focus until you close it.",
          variant: "success"
        });
      })
      .catch((error) => {
        showToast({
          title: "Unable to acknowledge alert",
          description: error instanceof Error ? error.message : "Try again in a moment.",
          variant: "error"
        });
      });
  };

  const handleClose = (alert: SelfCareAlert | null) => {
    if (!alert) {
      return;
    }
    const reason = window.prompt("Add context for closing this alert");
    closeAlert
      .mutateAsync({ alertId: alert.id, reason: reason ?? undefined })
      .then(() => {
        showToast({
          title: "Alert closed",
          description: "The history timeline now reflects your update.",
          variant: "success"
        });
      })
      .catch((error) => {
        showToast({
          title: "Unable to close alert",
          description: error instanceof Error ? error.message : "Try again in a moment.",
          variant: "error"
        });
      });
  };

  const handleMessageClient = (alert: SelfCareAlert | null) => {
    if (!alert?.clientUserId || !user?.id) {
      return;
    }
    createThread
      .mutateAsync({
        scope: "provider_support",
        title: `Self-care alert ${alert.id.slice(0, 6)}`,
        participants: [
          { userId: user.id, roleHint: "provider" },
          { userId: alert.clientUserId, roleHint: "client" }
        ]
      })
      .then(() => {
        showToast({
          title: "Conversation created",
          description: "Head to your inbox to follow up.",
          variant: "info"
        });
        navigate("/pro/inbox");
      })
      .catch((error) => {
        showToast({
          title: "Unable to start chat",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error"
        });
      });
  };

  const renderHistory = () => {
    if (historyQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      );
    }
    const history = historyQuery.data ?? [];
    if (!history.length) {
      return <p className="text-sm text-slate-500">No recent check-ins from this client.</p>;
    }
    return (
      <ol className="space-y-3">
        {history.map((entry) => (
          <li key={entry.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span>{formatDateTime(entry.checkedAt)}</span>
              <span className="text-xs uppercase text-slate-500">{entry.mood ?? "mood unknown"}</span>
            </div>
            <p className="text-xs text-slate-500">Logged by {formatLoggerName(entry)}</p>
            {(entry.symptoms ?? []).length > 0 && (
              <p className="mt-1 text-sm text-slate-600">Symptoms: {(entry.symptoms ?? []).join(", ")}</p>
            )}
            {entry.vitals && (entry.vitals.bpSystolic || entry.vitals.bpDiastolic) && (
              <p className="mt-1 text-xs text-slate-500">
                BP {entry.vitals.bpSystolic}/{entry.vitals.bpDiastolic ?? "--"} • HR {entry.vitals.heartRate ?? "--"} • Temp{" "}
                {entry.vitals.temperature ?? "--"}
              </p>
            )}
          </li>
        ))}
      </ol>
    );
  };

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-[40px] border border-white/80 bg-white/40 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-linear text-white shadow-lg shadow-brand-100">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">Health Alerts</h1>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Self-care Monitoring</p>
                </div>
              </div>
            </div>
            <p className="max-w-md text-sm font-medium leading-relaxed text-slate-600">
              Stay ahead of risk trends across your active clients and provide proactive support.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <select
              className="h-11 rounded-2xl border-none bg-white/60 px-4 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-black/5 backdrop-blur-sm focus:ring-brand-500"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            >
              <option value="new">New</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="closed">Closed</option>
              <option value="all">All Statuses</option>
            </select>
            <select
              className="h-11 rounded-2xl border-none bg-white/60 px-4 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-black/5 backdrop-blur-sm focus:ring-brand-500"
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}
            >
              <option value="all">Any Risk</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="space-y-4 lg:col-span-1 border-none shadow-xl ring-1 ring-black/5"
          title="Active alerts"
          description="Tap to review details, message clients, and resolve items."
        >
          {alertsQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          )}
          {!alertsQuery.isLoading && !alerts.length && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-bold text-slate-900">All clear</p>
              <p className="text-xs font-medium text-slate-500">New alerts will land here in real time.</p>
            </div>
          )}
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertListItem
                key={alert.id}
                alert={alert}
                isActive={alert.id === selectedAlert?.id}
                onSelect={setSelectedAlertId}
              />
            ))}
          </div>
        </Card>

        <Card
          className="space-y-6 lg:col-span-2 border-none shadow-xl ring-1 ring-black/5"
          title={selectedAlert ? selectedAlert.client?.fullName ?? "Client alert" : "Select an alert"}
          description={selectedAlert?.reason ?? "Insights will appear once you choose an alert."}
          badge={selectedAlert && (
            <span className={classNames(
              "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
              statusTone[selectedAlert.status] ?? statusTone.new
            )}>
              {selectedAlert.status.replace(/_/g, " ")}
            </span>
          )}
        >
          {!selectedAlert && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
              <Activity className="h-10 w-10 opacity-10" />
              <p className="mt-4 text-sm font-medium">Pick an alert from the list to get started.</p>
            </div>
          )}
          {selectedAlert && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-4 py-4 border-y border-slate-50">
                <RiskBadge risk={selectedAlert.riskLevel} />
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Created {formatDateTime(selectedAlert.createdAt)}</span>
                </div>
              </div>

              {selectedAlert.recommendation && (
                <div className="relative overflow-hidden rounded-3xl bg-slate-50/50 p-6 ring-1 ring-black/5">
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-500/5 blur-2xl" />
                  <div className="relative">
                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3">AI Support Analysis</p>
                    <p className="text-sm font-medium text-slate-600 leading-relaxed">{selectedAlert.recommendation.summary}</p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      {(selectedAlert.recommendation.steps ?? []).map((step) => (
                        <div key={step.title} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition-transform hover:scale-[1.02]">
                          <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">{step.title}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">{step.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  className="rounded-xl h-10 shadow-lg shadow-brand-100"
                  onClick={() => handleAcknowledge(selectedAlert)}
                  loading={acknowledgeAlert.isPending && acknowledgingId === selectedAlert.id}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Acknowledge Alert
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-xl h-10 border-none bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-black/10"
                  onClick={() => handleMessageClient(selectedAlert)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Message Client
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-xl h-10 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                  onClick={() => handleClose(selectedAlert)}
                  loading={closeAlert.isPending && closingAlertId === selectedAlert.id}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Close Case
                </Button>
              </div>

              <div className="grid gap-6 md:grid-cols-1">
                <div className="rounded-[32px] border-none bg-white p-6 shadow-xl ring-1 ring-black/5">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-900">Client context</p>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Snapshot</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>

                  {profileQuery.isLoading && (
                    <div className="flex items-center justify-center py-6">
                      <Spinner />
                    </div>
                  )}
                  {!profileQuery.isLoading && profileQuery.data && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Status</p>
                        <p className="text-xs font-bold text-slate-900">{profileQuery.data.status}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Last Check-in</p>
                        <p className="text-xs font-bold text-slate-900">{formatDateTime(profileQuery.data.lastCheckinAt)}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Primary Goals</p>
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">{profileQuery.data.primaryGoals || "Not set"}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-[32px] border-none bg-white p-6 shadow-xl ring-1 ring-black/5">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-900">Recent check-ins</p>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">History</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                      <Activity className="h-5 w-5" />
                    </div>
                  </div>
                  {renderHistory()}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const RiskBadge = ({ risk }: { risk?: string | null }) => {
  const label = (risk ?? "moderate").toLowerCase();
  return (
    <span className={classNames(
      "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1",
      riskTone[label] ?? riskTone.moderate
    )}>
      {label}
    </span>
  );
};

export default ProviderSelfCarePage;
