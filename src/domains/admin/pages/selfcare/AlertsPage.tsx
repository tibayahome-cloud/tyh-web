import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, CheckCircle2, XCircle } from "lucide-react";

import { Card } from "../../../../shared/components/Card";
import { Button } from "../../../../shared/components/Button";
import { Spinner } from "../../../../shared/components/Spinner";
import { useToast } from "../../../../shared/components/ToastProvider";
import {
  useSelfCareAlerts,
  useSelfCareProfile,
  useSelfCareCheckins,
  useAcknowledgeSelfCareAlertMutation,
  useCloseSelfCareAlertMutation
} from "../../../../shared/hooks/useSelfCare";
import type { SelfCareAlert, SelfCareCheckin } from "../../../../shared/schemas/selfcare";
import { useCreateThread } from "../../../../shared/hooks/useMessaging";
import { useAuth } from "../../../../shared/hooks/useAuth";

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "N/A";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const riskTone: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700",
  moderate: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  emergency: "bg-red-50 text-red-700"
};

const formatLoggerName = (entry: SelfCareCheckin) => entry.user?.fullName || entry.user?.email || "Client";

const AdminSelfCareAlertsPage = () => {
  const [statusFilter, setStatusFilter] = useState<"new" | "acknowledged" | "closed" | "all">("new");
  const [riskFilter, setRiskFilter] = useState<"all" | "moderate" | "high" | "emergency">("all");
  const alertsQuery = useSelfCareAlerts({
    status: statusFilter === "all" ? undefined : statusFilter,
    riskLevel: riskFilter === "all" ? undefined : riskFilter,
    limit: 100
  });
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const acknowledgeAlert = useAcknowledgeSelfCareAlertMutation();
  const closeAlert = useCloseSelfCareAlertMutation();
  const createThread = useCreateThread();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

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
    if (!alert) return;
    acknowledgeAlert
      .mutateAsync(alert.id)
      .then(() => {
        showToast({
          title: "Alert acknowledged",
          description: "Providers will see that operations is tracking this.",
          variant: "success"
        });
      })
      .catch((error) => {
        showToast({
          title: "Unable to acknowledge alert",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        });
      });
  };

  const handleClose = (alert: SelfCareAlert | null) => {
    if (!alert) return;
    const reason = window.prompt("Add context for closing this alert (optional)");
    closeAlert
      .mutateAsync({ alertId: alert.id, reason: reason ?? undefined })
      .then(() => {
        showToast({
          title: "Alert closed",
          description: "History updated.",
          variant: "success"
        });
      })
      .catch((error) => {
        showToast({
          title: "Unable to close alert",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        });
      });
  };

  const launchThread = (target: "client" | "provider", alert: SelfCareAlert | null) => {
    if (!alert || !user?.id) {
      return;
    }
    const targetId = target === "client" ? alert.clientUserId : alert.providerUserId;
    if (!targetId) {
      showToast({
        title: `No ${target} assigned`,
        description: "Assign a provider before starting a chat.",
        variant: "error"
      });
      return;
    }
    createThread
      .mutateAsync({
        scope: "admin",
        title: `Self-care alert ${alert.id.slice(0, 6)}`,
        participants: [
          { userId: user.id, roleHint: "admin" },
          { userId: targetId, roleHint: target }
        ]
      })
      .then((thread) => {
        showToast({
          title: "Message thread ready",
          description: "We opened a conversation in your inbox.",
          variant: "info"
        });
        if (thread?.bookingId) {
          window.dispatchEvent(new CustomEvent("chat:open", { detail: { bookingId: thread.bookingId } }));
        } else {
          navigate("/admin/conversations");
        }
      })
      .catch((error) => {
        showToast({
          title: "Unable to start conversation",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error"
        });
      });
  };

  const renderHistory = () => {
    if (historyQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      );
    }
    const history = historyQuery.data ?? [];
    if (!history.length) {
      return <p className="text-sm text-slate-500">No recent check-ins logged.</p>;
    }
    return (
      <ol className="space-y-2">
        {history.map((entry) => (
          <li key={entry.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-900">{formatDateTime(entry.checkedAt)}</span>
              <span className="text-xs uppercase text-slate-500">{entry.mood ?? "mood"}</span>
            </div>
            <p className="text-xs text-slate-500">Logged by {formatLoggerName(entry)}</p>
            {entry.symptoms.length > 0 && (
              <p className="text-xs text-slate-500">Symptoms: {entry.symptoms.map((symptom) => symptom.label).join(", ")}</p>
            )}
          </li>
        ))}
      </ol>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Self-care monitoring</h1>
          <p className="text-sm text-slate-500">Track AI alerts, coordinate providers, and close the loop.</p>
        </div>
        <div className="flex gap-3">
          <select
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="new">New</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
          <select
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}
          >
            <option value="all">Any risk</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Alerts"
          description="Newest signals from clients monitoring symptoms."
          className="space-y-3"
        >
          {alertsQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          )}
          {!alertsQuery.isLoading && !alerts.length && (
            <p className="text-sm text-slate-500">No alerts match your filters.</p>
          )}
          <div className="space-y-3">
            {alerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => setSelectedAlertId(alert.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                  selectedAlert?.id === alert.id ? "border-brand-400 bg-brand-50" : "border-slate-100 bg-white hover:border-brand-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{alert.client?.fullName ?? "Client"}</p>
                    <p className="text-xs text-slate-500">{alert.reason ?? "AI flagged this check-in"}</p>
                    {alert.provider?.fullName && (
                      <p className="text-xs text-slate-400">Provider: {alert.provider.fullName}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${riskTone[alert.riskLevel] ?? riskTone.moderate}`}>
                    {alert.riskLevel}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{formatDateTime(alert.createdAt)}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card
          title={selectedAlert ? selectedAlert.client?.fullName ?? "Client alert" : "Select an alert"}
          description={selectedAlert?.reason ?? "Choose an alert to review details."}
          className="lg:col-span-2 space-y-4"
        >
          {!selectedAlert && <p className="text-sm text-slate-500">Pick an alert from the column on the left.</p>}
          {selectedAlert && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>Status: {selectedAlert.status.replace(/_/g, " ")}</span>
                <span>Channel: {selectedAlert.channel}</span>
                <span>Created {formatDateTime(selectedAlert.createdAt)}</span>
              </div>
              {selectedAlert.recommendation && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">AI summary</p>
                  <p>{selectedAlert.recommendation.summary}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-6 text-slate-600">
                    {selectedAlert.recommendation.steps.map((step) => (
                      <li key={step.title}>
                        <span className="font-medium">{step.title}:</span> {step.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Client profile</p>
                  {profileQuery.isLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Spinner />
                    </div>
                  )}
                  {!profileQuery.isLoading && profileQuery.data && (
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      <li>Status: {profileQuery.data.status}</li>
                      <li>Goals: {profileQuery.data.primaryGoals || "n/a"}</li>
                      <li>Last check-in: {formatDateTime(profileQuery.data.lastCheckinAt)}</li>
                    </ul>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Recent check-ins</p>
                  {renderHistory()}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => handleAcknowledge(selectedAlert)}
                  loading={acknowledgeAlert.isPending && acknowledgeAlert.variables === selectedAlert.id}
                >
                  Acknowledge
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<XCircle className="h-4 w-4" />}
                  onClick={() => handleClose(selectedAlert)}
                  loading={closeAlert.isPending}
                >
                  Close alert
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<MessageCircle className="h-4 w-4" />}
                  onClick={() => launchThread("provider", selectedAlert)}
                >
                  Message provider
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<MessageCircle className="h-4 w-4" />}
                  onClick={() => launchThread("client", selectedAlert)}
                >
                  Message client
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminSelfCareAlertsPage;
