import clsx from "classnames";
import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, hint, id, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700" htmlFor={inputId}>
        {label && <span>{label}</span>}
        <input
          id={inputId}
          ref={ref}
          className={clsx(
            "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50",
            error && "border-red-400 focus:border-red-400 focus:ring-red-400/50",
            className
          )}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </label>
    );
  }
);

Input.displayName = "Input";
