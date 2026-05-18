import clsx from "classnames";
import type { PropsWithChildren } from "react";

type CardTone = "default" | "muted" | "brand";

interface CardProps {
  className?: string;
  title?: React.ReactNode;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;
  padding?: "default" | "none";
  tone?: CardTone;
}

export const Card = ({
  className,
  title,
  subtitle,
  description,
  badge,
  padding = "default",
  tone = "default",
  children
}: PropsWithChildren<CardProps>) => {
  const paddingClass = padding === "none" ? "p-0" : "p-4 sm:p-6";
  const toneClass =
    tone === "brand"
      ? "bg-tiba-blue text-white border-transparent shadow-elevated"
      : tone === "muted"
        ? "bg-slate-50 text-slate-900 border border-slate-100 shadow-card"
        : "bg-white text-slate-900 border border-slate-100 shadow-card";

  return (
    <div className={clsx("rounded-3xl transition duration-200 hover:-translate-y-0.5", toneClass, paddingClass, className)}>
      {(title || subtitle || description || badge) && (
        <div className={clsx(padding === "none" ? "px-6 pt-6" : "", "mb-4 space-y-2")}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {title && <h2 className={clsx("text-base font-bold", tone === "brand" ? "text-white" : "text-neutral-900")}>{title}</h2>}
              {subtitle && (
                <p className={clsx("text-sm", tone === "brand" ? "text-white/80" : "text-neutral-500")}>{subtitle}</p>
              )}
            </div>
            {badge && (
              <span
                className={clsx(
                  "whitespace-nowrap rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
                  tone === "brand" ? "bg-white/20 text-white" : "bg-tiba-gold-soft text-tiba-gold ring-1 ring-tiba-gold/20"
                )}
              >
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className={clsx("text-sm", tone === "brand" ? "text-white/80" : "text-neutral-600")}>{description}</p>
          )}
        </div>
      )}
      <div className={clsx(padding === "none" ? "px-6 pb-6" : "")}>{children}</div>
    </div>
  );
};
