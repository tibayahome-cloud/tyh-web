import classNames from "classnames";

import { PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS, type PasswordRequirementId } from "../utils/passwordPolicy";

type PasswordHintProps = {
  id: string;
  password: string;
  // True once a submit was refused: the same line turns red and is announced, instead of a second error line appearing.
  invalid?: boolean;
};

// What to do next, in the voice of a helper rather than a checklist.
const NEXT_STEP: Record<PasswordRequirementId, string> = {
  length: `Keep going: at least ${PASSWORD_MIN_LENGTH} characters.`,
  uppercase: "Add an uppercase letter.",
  lowercase: "Add a lowercase letter.",
  digit: "Add a number.",
  special: "Add a symbol, like ! or @."
};

/**
 * One line under the password field instead of a five-row checklist.
 *
 * Before anything is typed it says what a good password looks like; while typing it names the one thing still missing;
 * when the password is acceptable it says so. The line is the field's description (aria-describedby={id}) and a polite
 * status announces the moment the password becomes acceptable, so a screen reader hears it without hearing every key.
 */
export const PasswordHint = ({ id, password, invalid = false }: PasswordHintProps) => {
  const unmet = PASSWORD_REQUIREMENTS.find(({ test }) => !test(password));
  const done = !unmet;
  const text = done
    ? "Good. That works."
    : password.length === 0
      ? `At least ${PASSWORD_MIN_LENGTH} characters, with upper and lower case, a number and a symbol.`
      : NEXT_STEP[unmet.id];

  return (
    <div id={id}>
      <p
        role={invalid && !done ? "alert" : undefined}
        className={classNames("text-sm", done ? "font-medium text-emerald-700" : invalid ? "font-medium text-red-600" : "text-slate-600")}
      >
        {text}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {done ? "Password meets every requirement." : ""}
      </p>
    </div>
  );
};
