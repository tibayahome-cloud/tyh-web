import { useState } from "react";

import type { ProviderPreference } from "../../../shared/libs/telemedicineOps";

type Props = {
  value: Partial<ProviderPreference>;
  onChange: (next: Partial<ProviderPreference>) => void;
  disabled?: boolean;
};

const GENDER_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "female", label: "A female clinician" },
  { value: "male", label: "A male clinician" }
];

const LANGUAGE_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "en", label: "English" },
  { value: "sw", label: "Kiswahili" }
];

const NOTE_MAX_LENGTH = 500;

/**
 * Optional preferences a client may express about who sees them.
 *
 * Two constraints shape this. Clients never see the provider directory, so there is nothing to
 * browse and no names anywhere -- only attributes. And a preference is a request the facility
 * takes into account, not a guarantee, which the copy says plainly rather than burying: telling
 * someone they will get a female clinician and then assigning otherwise is worse than being
 * clear that it may not be possible.
 */
export const ProviderPreferenceFields = ({ value, onChange, disabled }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const note = value.note ?? "";

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={disabled}
        className="w-full rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-left text-sm text-slate-600 hover:border-tiba-blue hover:text-tiba-blue disabled:opacity-50"
      >
        Add a preference for your clinician <span className="text-slate-400">(optional)</span>
      </button>
    );
  }

  return (
    <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-semibold text-slate-900">
        Preferences <span className="font-normal text-slate-500">(optional)</span>
      </legend>

      <p className="text-xs text-slate-500">
        We pass these to the care site when they choose your clinician. They will do their best,
        but we cannot promise a match.
      </p>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Clinician</span>
        <select
          value={value.preferredGender ?? ""}
          onChange={(event) => onChange({ ...value, preferredGender: event.target.value || null })}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          {GENDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Language</span>
        <select
          value={value.preferredLanguage ?? ""}
          onChange={(event) => onChange({ ...value, preferredLanguage: event.target.value || null })}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">
          Anything else they should know?
        </span>
        <textarea
          value={note}
          maxLength={NOTE_MAX_LENGTH}
          rows={3}
          onChange={(event) => onChange({ ...value, note: event.target.value || null })}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="For example, you use a wheelchair, or you would rather not be seen by someone you know."
        />
        <span className="mt-1 block text-right text-xs text-slate-400">
          {note.length}/{NOTE_MAX_LENGTH}
        </span>
      </label>

      {/* Not a medical history field. Anything clinical belongs in the record, where it is
          protected properly, rather than in a note the care site reads while rostering. */}
      <p className="text-xs text-slate-400">
        Please do not include medical details here -- your clinician will ask during the call.
      </p>
    </fieldset>
  );
};
