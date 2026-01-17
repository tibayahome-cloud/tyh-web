import clsx from "classnames";
import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-brand-650 via-brand-600 to-accent-500 text-white shadow-elevated hover:shadow-lg hover:shadow-brand-900/20 focus-visible:shadow-focus",
  secondary:
    "bg-white text-brand-700 border border-neutral-200 shadow-card hover:-translate-y-0.5 hover:shadow-elevated",
  ghost: "bg-transparent text-brand-600 hover:bg-brand-50/70",
  outline: "border border-brand-200 text-brand-700 hover:bg-brand-50/60"
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base"
};

const spinnerColorByVariant: Record<ButtonVariant, string> = {
  primary: "border-white",
  secondary: "border-brand-600",
  ghost: "border-brand-600",
  outline: "border-brand-600"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...rest }, ref) => {
    const spinnerColor = spinnerColorByVariant[variant];
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition duration-200 ease-emphasized focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading ? "true" : undefined}
        {...rest}
      >
        {loading && (
          <span
            className={clsx("h-4 w-4 animate-spin rounded-full border-2 border-t-transparent", spinnerColor)}
            aria-hidden
          />
        )}
        <span className="inline-flex items-center gap-1">{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";
