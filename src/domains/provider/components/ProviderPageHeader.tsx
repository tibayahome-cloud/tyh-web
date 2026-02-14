import { useMemo, type ReactNode } from "react";
import classNames from "classnames";
import ChatIcon from "@mui/icons-material/ChatBubbleOutline";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../shared/hooks/useAuth";
import { useNotificationBadge } from "../../../shared/hooks/useNotificationBadge";

type ProviderPageHeaderProps = {
    overline?: string;
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    showGreeting?: boolean;
    className?: string;
    gradientVariant?: "blue" | "linear";
};

export const ProviderPageHeader = ({
    overline,
    title,
    subtitle,
    actions,
    showGreeting = false,
    className,
    gradientVariant = "linear"
}: ProviderPageHeaderProps) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const notificationBadge = useNotificationBadge();

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Systems Online";
        if (hour < 17) return "Operational Peak";
        return "Tactical Watch";
    }, []);

    const name = user?.fullName?.split(" ")[0] || "Agent";

    return (
        <section className={classNames(
            "relative -mx-4 -mt-8 overflow-hidden px-4 pb-10 pt-12 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 lg:-mt-12 lg:pb-12 lg:pt-16",
            className
        )}>
            {/* Background Gradients - Using Slate/Blue for Provider */}
            {gradientVariant === "blue" ? (
                <>
                    <div className="absolute inset-0 bg-slate-900" />
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
                </>
            ) : (
                <div className="absolute inset-0 bg-slate-900 opacity-95" />
            )}

            {/* Glow Effects */}
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-tiba-blue/10 blur-3xl opacity-50 sm:opacity-100" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-brand-500/10 blur-2xl opacity-50 sm:opacity-100" />

            <div className="relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 sm:gap-4">
                    <div className="flex flex-col gap-1.5 min-w-0">
                        {showGreeting && (
                            <p className="type-overline text-white/50">{greeting}</p>
                        )}
                        {overline && !showGreeting && (
                            <p className="type-overline text-white/50">{overline}</p>
                        )}

                        <h1 className="type-h1 text-white leading-tight break-words">
                            {showGreeting ? (
                                <>Hello, <span className="text-white/80">{name}</span></>
                            ) : (
                                title
                            )}
                        </h1>

                        {subtitle && (
                            <p className="mt-2 max-w-sm type-body text-white/60 leading-relaxed lg:max-w-md">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3 sm:shrink-0">
                        {actions}
                        <button
                            onClick={() => navigate("/pro/inbox")}
                            className="relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-xl ring-1 ring-white/20 transition-all active:scale-95"
                        >
                            <ChatIcon />
                            {notificationBadge.unread > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 type-overline text-white shadow-lg">
                                    {notificationBadge.unread}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};
