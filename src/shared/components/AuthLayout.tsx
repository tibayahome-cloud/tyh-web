import type { PropsWithChildren, ReactNode } from "react";
import classNames from "classnames";
import logoImage from "../../assets/images/logo.jpeg";
import splitImage from "../../assets/images/telemedicine-hero.webp";

type AuthLayoutProps = {
    // Small label above the title that names the portal (e.g. "Facility portal").
    eyebrow?: ReactNode;
    title?: string;
    subtitle?: string;
    footer?: ReactNode;
    maxWidth?: string;
    // Tighter vertical rhythm for short forms (sign in) so the primary action stays on screen.
    compact?: boolean;
    // Two-column sign-in: form and compact card on the left, a tall image panel on the right from
    // the md breakpoint up. Below md it is a single column and the image is not rendered.
    split?: boolean;
};

export const AuthLayout = ({
    children,
    eyebrow,
    title,
    subtitle,
    footer,
    maxWidth = "max-w-md",
    compact = false,
    split = false
}: PropsWithChildren<AuthLayoutProps>) => {
    if (split) {
        return (
            <div className="min-h-screen bg-slate-50 selection:bg-brand-100 selection:text-brand-900">
                <div className="mx-auto grid min-h-screen max-w-[100rem] md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-6 md:p-6 lg:grid-cols-2 lg:gap-10 lg:p-8">
                    <div className="flex min-w-0 flex-col px-4 py-5 md:px-2 md:py-2">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-card ring-1 ring-slate-100/60">
                                <img src={logoImage} alt="" className="h-7 w-7 object-contain" />
                            </span>
                            <span className="text-base font-bold text-tiba-blue">Tiba Ya Home</span>
                        </div>

                        <div className="flex flex-1 items-center justify-center py-8">
                            <div className={classNames("w-full", maxWidth)}>
                                <div className="mb-6 flex flex-col items-center text-center">
                                    {eyebrow}
                                    {title && (
                                        <h1 className={classNames("type-h1 text-tiba-blue", eyebrow && "mt-4")}>{title}</h1>
                                    )}
                                    {subtitle && <p className="type-body mt-2 text-slate-500">{subtitle}</p>}
                                </div>

                                <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
                                    {children}
                                </div>

                                {footer && <div className="mt-4 text-center">{footer}</div>}
                            </div>
                        </div>
                    </div>

                    {/* Decorative: the page's meaning is carried entirely by the text beside it. */}
                    <aside
                        className="relative hidden overflow-hidden rounded-[2rem] bg-slate-200 md:sticky md:top-6 md:block md:h-[calc(100vh-3rem)] lg:top-8 lg:h-[calc(100vh-4rem)]"
                        aria-hidden="true"
                    >
                        <img
                            src={splitImage}
                            alt=""
                            width={1536}
                            height={1024}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover object-[40%_center]"
                        />
                    </aside>
                </div>
            </div>
        );
    }

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
