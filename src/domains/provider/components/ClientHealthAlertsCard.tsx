import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, ShieldCheck, Activity } from "lucide-react";
import classNames from "classnames";

import { Card } from "../../../shared/components/Card";
import { Button } from "../../../shared/components/Button";
import { Spinner } from "../../../shared/components/Spinner";
import { useSelfCareAlerts } from "../../../shared/hooks/useSelfCare";

const riskTone: Record<string, string> = {
    low: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    moderate: "bg-amber-50 text-amber-700 ring-amber-100",
    high: "bg-orange-50 text-orange-700 ring-orange-100",
    emergency: "bg-rose-50 text-rose-700 ring-rose-100"
};

export const ClientHealthAlertsCard = () => {
    const navigate = useNavigate();
    const { data: alerts, isLoading } = useSelfCareAlerts({
        status: "new",
        limit: 3
    });

    if (isLoading) {
        return (
            <Card className="flex h-48 items-center justify-center border-none bg-white/50 backdrop-blur-sm shadow-sm ring-1 ring-slate-100">
                <Spinner />
            </Card>
        );
    }

    if (!alerts || alerts.length === 0) {
        return (
            <Card className="relative overflow-hidden border-none bg-emerald-50/50 p-6 shadow-sm ring-1 ring-emerald-100">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl" />
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Health Monitoring</h3>
                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">All Clients Clear</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                        Your clients' AI-monitored health and wellness trends are currently stable. We'll alert you here if anything needs your attention.
                    </p>
                    <Button
                        variant="ghost"
                        className="w-full rounded-xl h-10 text-xs font-bold bg-white/80 hover:bg-white text-emerald-700 shadow-sm"
                        onClick={() => navigate("/pro/selfcare")}
                    >
                        View Alert History
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card className="relative overflow-hidden border-none bg-white p-6 shadow-md ring-1 ring-slate-100">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-500/5 blur-3xl opacity-50" />

            <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-100">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-sm font-bold text-slate-900">Active Health Alerts</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action Required</p>
                        </div>
                    </div>
                    <div className="flex -space-x-2">
                        {alerts.slice(0, 3).map((alert, i) => (
                            <div
                                key={alert.id}
                                className="h-6 w-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600"
                                title={alert.client?.fullName || "Client"}
                            >
                                {alert.client?.fullName?.charAt(0) || "C"}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    {alerts.slice(0, 2).map((alert) => {
                        const riskLabel = (alert.riskLevel || "moderate").toLowerCase();
                        const tone = riskTone[riskLabel] ?? riskTone.moderate;

                        return (
                            <div
                                key={alert.id}
                                className="group relative flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 transition-all hover:bg-white hover:shadow-sm"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-bold text-slate-900 truncate">
                                        {alert.client?.fullName || "Client Update"}
                                    </p>
                                    <span className={classNames(
                                        "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1",
                                        tone
                                    )}>
                                        {riskLabel}
                                    </span>
                                </div>
                                <p className="text-[11px] font-medium text-slate-500 leading-snug line-clamp-2">
                                    {alert.reason || "Unusual wellness trend detected."}
                                </p>
                            </div>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => navigate("/pro/selfcare")}
                    className="group flex items-center justify-between rounded-2xl bg-slate-900 p-4 text-white shadow-lg shadow-slate-200 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 group-hover:bg-white/20 transition-colors">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <p className="text-xs font-bold">Manage All Alerts</p>
                    </div>
                    <ArrowRight className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                </button>
            </div>
        </Card>
    );
};
