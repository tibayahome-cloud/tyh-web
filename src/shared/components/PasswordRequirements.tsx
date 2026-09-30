import { Check, Circle, X } from "lucide-react";
import classNames from "classnames";

import { evaluatePassword } from "../utils/passwordPolicy";

type PasswordRequirementsProps = {
  id: string;
  password: string;
  // Pass the confirmation to add a live "passwords match" row. Omit it on forms with one field.
  confirmPassword?: string;
  // Rules that have not been met turn red only once the person has typed something into the
  // field or tried to submit; before that they stay neutral so the list reads as guidance.
  showFailures?: boolean;
};

type RowState = "met" | "unmet" | "failed";

const STATE_TEXT: Record<RowState, string> = { met: "met", unmet: "not met yet", failed: "not met" };

const Row = ({ label, state }: { label: string; state: RowState }) => (
  <li className="flex items-center gap-2 text-xs">
    {state === "met" && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />}
    {state === "unmet" && <Circle className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />}
    {state === "failed" && <X className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />}
    <span
      className={classNames(
        state === "met" && "text-emerald-700",
        state === "unmet" && "text-slate-600",
        state === "failed" && "text-red-700"
      )}
    >
      {label}
      {/* Colour and icon are not the only signal: screen readers hear the state too. */}
      <span className="sr-only">: {STATE_TEXT[state]}</span>
    </span>
  </li>
);

// The requirements are shown before anything is submitted and update as the person types. The
// list is exposed as the fields' description (aria-describedby={id}); the status text below it
// is a polite live region so a screen reader hears when the password becomes acceptable.
export const PasswordRequirements = ({
  id,
  password,
  confirmPassword,
  showFailures = false
}: PasswordRequirementsProps) => {
  const requirements = evaluatePassword(password);
  const touched = password.length > 0;
  const allMet = requirements.every((requirement) => requirement.met);
  const hasConfirmation = confirmPassword !== undefined;
  const confirmationTouched = hasConfirmation && confirmPassword.length > 0;
  const matches = hasConfirmation && confirmPassword === password && password.length > 0;

  const matchState: RowState = matches
    ? "met"
    : confirmationTouched || showFailures
      ? "failed"
      : "unmet";

  return (
    <div id={id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="mb-2 text-xs font-semibold text-slate-700">Your password needs</p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {requirements.map((requirement) => (
          <Row
            key={requirement.id}
            label={requirement.label}
            state={requirement.met ? "met" : touched || showFailures ? "failed" : "unmet"}
          />
        ))}
        {hasConfirmation && <Row label="Both passwords match" state={matchState} />}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">
        {allMet ? "Password meets every requirement." : ""}
        {hasConfirmation && matches ? " Passwords match." : ""}
      </p>
    </div>
  );
};
