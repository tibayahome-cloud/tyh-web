import React from "react";
import { Sparkles, ArrowRight, Activity, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import classNames from "classnames";

import { Card } from "../../../shared/components/Card";
import { Button } from "../../../shared/components/Button";
import { Spinner } from "../../../shared/components/Spinner";
import { useSelfCareCheckins } from "../../../shared/hooks/useSelfCare";

const riskTone: Record<string, string> = {
    low: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    moderate: "bg-amber-50 text-amber-700 ring-amber-100",
    high: "bg-orange-50 text-orange-700 ring-orange-100",
    emergency: "bg-rose-50 text-rose-700 ring-rose-100"
};

export const AIRecommendationsCard = () => {
    const navigate = useNavigate();
    const { data: checkins, isLoading } = useSelfCareCheckins(undefined, { limit: 1 });

    const latestCheckin = checkins?.[0] || null;
    const recommendation = latestCheckin?.recommendation || null;

    const riskLabel = (recommendation?.riskLevel || "low").toLowerCase();
    const tone = riskTone[riskLabel] ?? riskTone.low;

    if (isLoading) {
        return (
            <Card className="flex h-48 items-center justify-center border-none bg-white/50 backdrop-blur-sm shadow-sm ring-1 ring-slate-100">
                <Spinner />
            </Card>
        );
    }

    if (!recommendation) {
        return (
            <Card className="relative overflow-hidden border-none bg-indigo-50/50 p-6 shadow-sm ring-1 ring-indigo-100">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-500/5 blur-2xl" />
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-200">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="type-title text-slate-900">Unlock AI Insights</h3>
                            <p className="type-overline text-slate-500">Health Wellness</p>
                        </div>
                    </div>

                    <p className="type-body text-slate-600 font-medium">
                        Start your first health check-in to get personalized care recommendations powered by AI.
                    </p>

                    <Button
                        variant="secondary"
                        className="w-full rounded-xl h-10 type-overline border-none bg-white shadow-sm hover:bg-slate-50 text-indigo-600"
                        onClick={() => navigate("/app/selfcare")}
                    >
                        Get Started
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card className="relative overflow-hidden border-none bg-white p-6 shadow-md ring-1 ring-slate-100">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-tiba-blue/5 blur-3xl opacity-50" />

            <div className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-tiba-blue text-white shadow-lg shadow-tiba-blue/10">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="type-title text-slate-900">AI Wellness Insight</h3>
                            <p className="type-overline text-slate-400">Personalized Recommendation</p>
                        </div>
                    </div>
                    <div className={classNames(
                        "rounded-full px-2.5 py-0.5 type-overline ring-1",
                        tone
                    )}>
                        {riskLabel} Risk
                    </div>
                </div>

                {/* Summary */}
                <div className="relative">
                    <div className="absolute -left-3 top-0 bottom-0 w-1 rounded-full bg-tiba-gold/30" />
                    <p className="type-body font-bold text-slate-800">
                        {recommendation.summary}
                    </p>
                </div>

                {/* Key Steps */}
                <div className="space-y-2">
                    {recommendation.steps.slice(0, 2).map((step: { title: string; description: string }, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 transition-colors hover:bg-slate-100/80">
                            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-tiba-gold text-[10px] font-bold text-white">
                                {idx + 1}
                            </div>
                            <div>
                                <p className="type-body font-bold text-slate-900">{step.title}</p>
                                <p className="mt-1 type-caption text-slate-500">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Card Action - Always Visible */}
                <div className="mt-2 pt-4 border-t border-slate-50">
                    <button
                        type="button"
                        onClick={() => navigate("/app/selfcare")}
                        className="w-full group flex items-center justify-between rounded-2xl bg-slate-900 p-4 text-white shadow-xl shadow-slate-200 transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 group-hover:bg-white/20 transition-colors">
                                <Activity className="h-4 w-4" />
                            </div>
                            <p className="type-caption font-bold">View Full Care Plan</p>
                        </div>
                        <ArrowRight className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </button>
                </div>
            </div>
        </Card>
    );
};
