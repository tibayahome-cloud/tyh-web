import clsx from "classnames";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

import { withoutOverriddenColours } from "../utils/overrideClasses";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** Decorative icon shown before the label. Give the button a text label too. */
  icon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-tiba-blue text-white shadow-elevated hover:bg-blue-800 focus-visible:ring-tiba-blue/40",
  secondary:
    "bg-tiba-gold text-white shadow-card hover:opacity-90 active:scale-[0.98]",
  ghost: "bg-transparent text-tiba-blue hover:bg-slate-50",
  outline: "border-2 border-slate-200 text-slate-700 hover:border-tiba-blue hover:text-tiba-blue"
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, fullWidth, icon, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95",
          // The caller's background, text and border colours replace the variant's, so a page can restyle a
          // button without the variant's own colour winning in the stylesheet.
          withoutOverriddenColours(variantStyles[variant], className),
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading ? "true" : undefined}
        {...rest}
      >
        {loading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        )}
        {icon && (
          <span className="inline-flex shrink-0" aria-hidden>
            {icon}
          </span>
        )}
        <span className="inline-flex items-center gap-1">{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";
