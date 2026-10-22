import { Star, Trophy, Target, Zap } from "lucide-react";

import { KpiCard } from "../../../shared/components/KpiCard";
import { WidgetError } from "../../../shared/components/WidgetError";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useProviderAnalytics } from "../hooks/useProviderAnalytics";

export const PerformanceStats = () => {
    const { user } = useAuth();
    const { data: analytics, isLoading, isError, refetch } = useProviderAnalytics(user?.id);

    if (isLoading) {
        return <div className="h-[180px] animate-pulse rounded-xl bg-slate-100" aria-hidden />;
    }

    // A failed request is not a provider with no reviews, no rank and no services.
    if (isError || !analytics) {
        return <WidgetError what="your performance" onRetry={() => void refetch()} />;
    }

    const hasRatings = (analytics.rating_count ?? 0) > 0;

    return (
        <section aria-labelledby="performance-heading" className="space-y-3">
            <h2 id="performance-heading" className="text-base font-semibold text-slate-900">Your performance</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label="Rating"
                    // No reviews is not a rating of 0.0.
                    value={hasRatings ? analytics.rating_avg.toFixed(1) : "\u2014"}
                    caption={hasRatings ? `${analytics.rating_count} reviews` : "No ratings yet"}
                    icon={<Star className="h-5 w-5" />}
                />
                <KpiCard
                    label="Rank"
                    value={analytics.rank ? `#${analytics.rank}` : "\u2014"}
                    caption={analytics.rank ? `of ${analytics.total_providers} pros` : "Not ranked yet"}
                    icon={<Trophy className="h-5 w-5" />}
                />
                <KpiCard
                    label="Active services"
                    value={analytics.active_services}
                    caption="You can be booked for"
                    icon={<Zap className="h-5 w-5" />}
                />
                <KpiCard
                    label="Daily request limit"
                    value={analytics.daily_request_limit}
                    caption="Requests offered to you a day"
                    icon={<Target className="h-5 w-5" />}
                />
            </div>
        </section>
    );
};
