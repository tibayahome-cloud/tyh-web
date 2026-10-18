import { Star, Trophy, Target, Zap } from "lucide-react";
import { useProviderAnalytics } from "../hooks/useProviderAnalytics";
import { useAuth } from "../../../shared/hooks/useAuth";
import classNames from "classnames";

import { WidgetError } from "../../../shared/components/WidgetError";

export const PerformanceStats = () => {
    const { user } = useAuth();
    const { data: analytics, isLoading, isError, refetch } = useProviderAnalytics(user?.id);

    if (isLoading) {
        return (
            <div className="h-[180px] animate-pulse rounded-[32px] bg-white/40 backdrop-blur-md ring-1 ring-black/5" />
        );
    }

    // A failed request is not a provider with no reviews, no rank and no services.
    if (isError || !analytics) {
        return <WidgetError what="your performance" onRetry={() => void refetch()} />;
    }

    const hasRatings = (analytics.rating_count ?? 0) > 0;
    const stats = [
        {
            label: "Mission Rating",
            // No reviews is not a rating of 0.0.
            value: hasRatings ? analytics.rating_avg.toFixed(1) : "—",
            caption: hasRatings ? `${analytics.rating_count} reviews` : "No ratings yet",
            icon: <Star className="h-5 w-5" />,
            color: "text-amber-500",
            bg: "bg-amber-500/10"
        },
        {
            label: "Fleet Rank",
            value: analytics.rank ? `#${analytics.rank}` : "—",
            caption: analytics.rank ? `of ${analytics.total_providers} pros` : "Not ranked yet",
            icon: <Trophy className="h-5 w-5" />,
            color: "text-sky-500",
            bg: "bg-sky-500/10"
        },
        {
            label: "Capability",
            value: analytics.active_services,
            caption: "Active services",
            icon: <Zap className="h-5 w-5" />,
            color: "text-brand-500",
            bg: "bg-brand-500/10"
        },
        {
            label: "Daily Limit",
            value: analytics.daily_request_limit,
            caption: "Target capacity",
            icon: <Target className="h-5 w-5" />,
            color: "text-rose-500",
            bg: "bg-rose-500/10"
        }
    ];

    return (
        <div className="rounded-[40px] border border-white/80 bg-white/40 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
            <div className="flex items-center gap-2 mb-8">
                <div className="p-2 rounded-xl bg-slate-900 text-white shadow-lg">
                    <Trophy className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900">Performance Intelligence</h3>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="group relative">
                        <div className="flex items-center gap-3">
                            <div className={classNames(
                                "flex h-10 w-10 items-center justify-center rounded-2xl transition-all group-hover:scale-110",
                                stat.bg,
                                stat.color
                            )}>
                                {stat.icon}
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold text-slate-900">{stat.value}</span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{stat.caption}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
