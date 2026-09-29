import type { PropsWithChildren, ReactNode } from "react";
import classNames from "classnames";
import logoImage from "../../assets/images/logo.jpeg";

type AuthLayoutProps = {
    // Small label above the title that names the portal (e.g. "Facility portal").
    eyebrow?: ReactNode;
    title?: string;
    subtitle?: string;
    footer?: ReactNode;
    maxWidth?: string;
    // Tighter vertical rhythm for short forms (sign in) so the primary action stays on screen.
    compact?: boolean;
};

export const AuthLayout = ({
    children,
    eyebrow,
    title,
    subtitle,
    footer,
    maxWidth = "max-w-md",
    compact = false
}: PropsWithChildren<AuthLayoutProps>) => {
    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-50 selection:bg-brand-100 selection:text-brand-900">
            {/* Background radial glow */}
            <div className="pointer-events-none fixed inset-0 z-0 bg-brand-radial" aria-hidden="true" />

            {/* Main container */}
            <div className={classNames("relative z-10 flex min-h-screen flex-col items-center justify-center px-4", compact ? "py-8" : "py-12")}>
                <div className={classNames("w-full transition-all duration-500", maxWidth)}>
                    {/* Logo Section */}
                    <div className={classNames("flex flex-col items-center", compact ? "mb-6" : "mb-10")}>
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card ring-1 ring-slate-100/50">
                            <img src={logoImage} alt="Tiba Ya Home" className="h-10 w-10 object-contain" />
                        </div>
                        {eyebrow && <div className="mt-5">{eyebrow}</div>}
                        {title && (
                            <h1 className={classNames("type-h1 text-center text-tiba-blue", compact ? "mt-5" : "mt-8")}>
                                {title}
                            </h1>
                        )}
                        {subtitle && (
                            <p className="type-body mt-2 text-center text-slate-500">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    {/* Form Content Wrapper */}
                    <div className={classNames("relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-elevated backdrop-blur-xl", compact ? "sm:p-8" : "sm:p-10")}>
                        {children}
                    </div>

                    {/* Footer Section */}
                    {footer && (
                        <div className={classNames("text-center", compact ? "mt-4" : "mt-8")}>
                            {footer}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom accent (optional) */}
            <div className="fixed bottom-8 left-0 right-0 z-10 hidden text-center lg:block">
                <p className="text-[10px] font-medium tracking-[0.2em] text-slate-400 uppercase">
                    &copy; {new Date().getFullYear()} Tiba Ya Home • Premium Care Experience
                </p>
            </div>
        </div>
    );
};
