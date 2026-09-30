// Mirrors the API's password policy (app/utils/validation.py, PASSWORD_PATTERN):
// 10 or more characters with an upper-case letter, a lower-case letter, a digit and a special
// character. The API is the authority; this only tells people what it will ask for before they
// submit, so keep the two in step.
export const PASSWORD_MIN_LENGTH = 10;

export type PasswordRequirementId = "length" | "uppercase" | "lowercase" | "digit" | "special";

export type PasswordRequirement = {
  id: PasswordRequirementId;
  label: string;
  // Sentence used as the validation message when this is the first unmet rule.
  message: string;
  test: (password: string) => boolean;
};

export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH
  },
  {
    id: "uppercase",
    label: "One uppercase letter (A-Z)",
    message: "Password needs an uppercase letter",
    test: (password) => /[A-Z]/.test(password)
  },
  {
    id: "lowercase",
    label: "One lowercase letter (a-z)",
    message: "Password needs a lowercase letter",
    test: (password) => /[a-z]/.test(password)
  },
  {
    id: "digit",
    label: "One number (0-9)",
    message: "Password needs a number",
    test: (password) => /\d/.test(password)
  },
  {
    id: "special",
    label: "One special character, such as ! @ # $ %",
    message: "Password needs a special character",
    test: (password) => /[^A-Za-z0-9]/.test(password)
  }
];

export type PasswordRequirementStatus = { id: PasswordRequirementId; label: string; met: boolean };

export const evaluatePassword = (password: string): PasswordRequirementStatus[] =>
  PASSWORD_REQUIREMENTS.map(({ id, label, test }) => ({ id, label, met: test(password) }));

export const isPasswordValid = (password: string): boolean =>
  PASSWORD_REQUIREMENTS.every(({ test }) => test(password));

// The first unmet rule, phrased as a message. Null when the password meets every rule.
export const firstPasswordProblem = (password: string): string | null =>
  PASSWORD_REQUIREMENTS.find(({ test }) => !test(password))?.message ?? null;
