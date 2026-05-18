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
            "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition-all",
            "focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20",
            "placeholder:text-slate-400",
            error && "border-red-400 focus:border-red-400 focus:ring-red-400/20",
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
