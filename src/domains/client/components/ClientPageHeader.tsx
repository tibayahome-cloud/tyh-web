import { useMemo, type ReactNode } from "react";
import classNames from "classnames";
import ChatIcon from "@mui/icons-material/ChatBubbleOutline";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../shared/hooks/useAuth";
import { useNotificationBadge } from "../../../shared/hooks/useNotificationBadge";

type ClientPageHeaderProps = {
    overline?: string;
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    showGreeting?: boolean;
    className?: string;
    gradientVariant?: "blue" | "linear";
    hideInbox?: boolean;
    hideBackground?: boolean;
};

export const ClientPageHeader = ({
    overline,
    title,
    subtitle,
    actions,
    showGreeting = false,
    className,
    gradientVariant = "linear",
    hideInbox = false,
    hideBackground = false
}: ClientPageHeaderProps) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const notificationBadge = useNotificationBadge();

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    }, []);

    const firstName = user?.fullName?.split(" ")[0] || "there";

    return (
        <section className={classNames(
            "relative",
            !hideBackground && "-mx-4 -mt-8 overflow-hidden px-4 pb-10 pt-12 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 lg:-mt-12 lg:pb-12 lg:pt-16",
            hideBackground && "pt-8 pb-4",
            className
        )}>
            {/* Background Gradients */}
            {!hideBackground && (
                <>
                    {gradientVariant === "blue" ? (
                        <>
                            <div className="absolute inset-0 bg-tiba-blue" />
                            <div className="absolute inset-0 bg-gradient-to-br from-tiba-blue via-tiba-blue/95 to-blue-900" />
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-brand-linear opacity-90" />
                    )}

                    {/* Glow Effects */}
                    <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl opacity-50 sm:opacity-100" />
                    <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-2xl opacity-50 sm:opacity-100" />
                </>
            )}

            <div className="relative z-10 font-medium">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 sm:gap-4">
                    <div className="flex flex-col gap-1.5 min-w-0">
                        {showGreeting && (
                            <p className={classNames(
                                "type-overline",
                                hideBackground ? "text-slate-400" : "text-white/50"
                            )}>
                                {greeting}
                            </p>
                        )}
                        {overline && !showGreeting && (
                            <p className={classNames(
                                "type-overline",
                                hideBackground ? "text-slate-400" : "text-white/50"
                            )}>
                                {overline}
                            </p>
                        )}

                        <h1 className={classNames(
                            "type-h1 leading-tight break-words",
                            hideBackground ? "text-slate-900" : "text-white"
                        )}>
                            {showGreeting ? (
                                <>Hello, <span className={hideBackground ? "text-tiba-blue" : "text-white/80"}>{firstName}</span></>
                            ) : (
                                title
                            )}
                        </h1>

                        {subtitle && (
                            <p className={classNames(
                                "mt-2 max-w-sm type-body leading-relaxed lg:max-w-md",
                                hideBackground ? "text-slate-500" : "text-white/60"
                            )}>
                                {subtitle}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3 sm:shrink-0">
                        {actions}
                        {!hideInbox && (
                            <button
                                onClick={() => navigate("/app/inbox")}
                                className={classNames(
                                    "relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl transition-all active:scale-95",
                                    hideBackground
                                        ? "bg-slate-50 text-slate-600 border border-slate-100"
                                        : "bg-white/10 text-white backdrop-blur-xl ring-1 ring-white/20"
                                )}
                            >
                                <ChatIcon />
                                {notificationBadge.unread > 0 && (
                                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 type-overline text-white shadow-lg">
                                        {notificationBadge.unread}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};
