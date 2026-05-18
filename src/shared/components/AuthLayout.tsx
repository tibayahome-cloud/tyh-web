import type { PropsWithChildren, ReactNode } from "react";
import classNames from "classnames";
import logoImage from "../../assets/images/logo.jpeg";

type AuthLayoutProps = {
    title?: string;
    subtitle?: string;
    footer?: ReactNode;
    maxWidth?: string;
};

export const AuthLayout = ({
    children,
    title,
    subtitle,
    footer,
    maxWidth = "max-w-md"
}: PropsWithChildren<AuthLayoutProps>) => {
    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-50 selection:bg-brand-100 selection:text-brand-900">
            {/* Background radial glow */}
            <div className="pointer-events-none fixed inset-0 z-0 bg-brand-radial" aria-hidden="true" />

            {/* Main container */}
            <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
                <div className={classNames("w-full transition-all duration-500", maxWidth)}>
                    {/* Logo Section */}
                    <div className="mb-10 flex flex-col items-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card ring-1 ring-slate-100/50">
                            <img src={logoImage} alt="Tiba Ya Home" className="h-10 w-10 object-contain" />
                        </div>
                        {title && (
                            <h1 className="type-h1 mt-8 text-center text-tiba-blue">
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
                    <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-elevated backdrop-blur-xl sm:p-10">
                        {children}
                    </div>

                    {/* Footer Section */}
                    {footer && (
                        <div className="mt-8 text-center">
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
