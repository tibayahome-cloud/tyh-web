import { Check, X } from "lucide-react";
import classNames from "classnames";

import { evaluatePassword, PASSWORD_MIN_LENGTH } from "../utils/passwordPolicy";

type PasswordRequirementsProps = {
  id: string;
  password: string;
  // Pass the confirmation to add a live "Passwords must match" line. Omit it on forms with one field.
  confirmPassword?: string;
};

const Row = ({ label, met }: { label: string; met: boolean }) => (
  <li className="flex items-center gap-3 text-sm text-slate-700">
    <span
      className={classNames(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white transition-colors",
        met ? "bg-emerald-600" : "bg-slate-400"
      )}
      aria-hidden="true"
    >
      {met ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
    </span>
    <span>
      {label}
      {/* The tick and cross are not the only signal: screen readers hear the state too. */}
      <span className="sr-only">: {met ? "met" : "not met"}</span>
    </span>
  </li>
);

// A short list shown before anything is submitted that updates as the person types: a green tick
// for a rule that is met, a grey cross for one that is not. Upper and lower case are one line to
// keep it short. The list is the fields' description (aria-describedby={id}), and a polite status
// announces when the password becomes acceptable.
export const PasswordRequirements = ({ id, password, confirmPassword }: PasswordRequirementsProps) => {
  const status = Object.fromEntries(evaluatePassword(password).map(({ id: rule, met }) => [rule, met])) as Record<
    string,
    boolean
  >;
  const allMet = Object.values(status).every(Boolean);
  const hasConfirmation = confirmPassword !== undefined;
  const matches = hasConfirmation && password.length > 0 && confirmPassword === password;

  return (
    <div id={id}>
      <ul className="space-y-2" aria-label="Requirements for your password">
        <Row label={`Password must be at least ${PASSWORD_MIN_LENGTH} characters`} met={status.length} />
        <Row label="Password must contain 1 number" met={status.digit} />
        <Row label="Password must contain 1 special character" met={status.special} />
        <Row
          label="Password must contain 1 upper case and 1 lower case letter"
          met={status.uppercase && status.lowercase}
        />
        {hasConfirmation && <Row label="Passwords must match" met={matches} />}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">
        {allMet ? "Password meets every requirement." : ""}
        {hasConfirmation && matches ? " Passwords match." : ""}
      </p>
    </div>
  );
};
