import clsx from "classnames";
import type { InputHTMLAttributes} from "react";
import { forwardRef, useState } from "react";
import { Input } from "./Input";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  error?: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, className, ...rest }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className={clsx("relative flex flex-col gap-1", className)}>
        <Input {...rest} ref={ref} type={visible ? "text" : "password"} label={label} error={error} />
        <button
          type="button"
          className="absolute right-3 top-9 text-xs font-semibold text-primary-600 transition hover:text-primary-700 focus:outline-none"
          aria-pressed={visible}
          onClick={() => setVisible((prev) => !prev)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    );
  }
);

PasswordField.displayName = "PasswordField";
