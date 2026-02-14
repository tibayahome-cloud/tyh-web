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
    "bg-tiba-blue text-white shadow-elevated hover:bg-blue-800 focus-visible:ring-tiba-blue/40",
  secondary:
    "bg-tiba-gold text-white shadow-card hover:opacity-90 active:scale-[0.98]",
  ghost: "bg-transparent text-tiba-blue hover:bg-slate-50",
  outline: "border-2 border-slate-200 text-slate-700 hover:border-tiba-blue hover:text-tiba-blue"
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base"
};

const spinnerColorByVariant: Record<ButtonVariant, string> = {
  primary: "border-white",
  secondary: "border-white",
  ghost: "border-tiba-blue",
  outline: "border-tiba-blue"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...rest }, ref) => {
    const spinnerColor = spinnerColorByVariant[variant];
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95",
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
