import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "../../../shared/libs/api";
import { Button } from "../../../shared/components/Button";

type Profile = { gender: string | null; genderRecorded: boolean };

const OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" }
];

const fetchProfile = async (): Promise<Profile> => {
  const response = await api.get("/providers/me/profile");
  return {
    gender: response.data?.data?.gender ?? null,
    genderRecorded: Boolean(response.data?.data?.gender_recorded)
  };
};

const saveGender = async (gender: string) => {
  const response = await api.patch("/providers/me/profile", { gender });
  return response.data?.data;
};

type Props = {
  /**
   * Prompt style. "prompt" is the nudge shown to a clinician who has never been asked; it is
   * dismissible and blocks nothing. "field" is the ordinary settings row.
   */
  variant?: "prompt" | "field";
};

/**
 * Where a clinician records their own gender.
 *
 * Used so a client who asks for a female or male clinician can actually be matched. It is never
 * shown to clients -- the provider directory stays hidden either way -- and only affects the
 * order providers are offered to the facility when someone assigns.
 *
 * The prompt variant deliberately does not block anything. Every provider in the system
 * predates this field, and a required answer would lock them out of their own settings until
 * they filled it in, which is a worse outcome than the matching staying inert a while longer.
 */
export const GenderField = ({ variant = "field" }: Props) => {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const { data: profile } = useQuery({ queryKey: ["provider", "me", "profile"], queryFn: fetchProfile });

  const save = useMutation({
    mutationFn: saveGender,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider", "me", "profile"] })
  });

  if (!profile) return null;
  // The nudge is for people who have never answered. Once they have, it is just a setting.
  if (variant === "prompt" && (profile.genderRecorded || dismissed)) return null;

  const choose = (value: string) => save.mutate(value);

  if (variant === "prompt") {
    return (
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <h3 className="text-sm font-semibold text-sky-900">Help us match you to the right patients</h3>
        <p className="mt-1 text-sm text-sky-800">
          Some patients ask to see a female or a male clinician. Telling us lets the care site
          take that into account when assigning you. Patients never see this.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              loading={save.isPending}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </Button>
          ))}
          {/* Dismissal is local and non-destructive: nothing is recorded, the clinician stays
              fully assignable, and the prompt returns next session. */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-full px-3 py-1 text-xs font-medium text-sky-700 underline"
          >
            Not now
          </button>
        </div>
      </section>
    );
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">Gender</span>
      <select
        value={profile.gender ?? ""}
        onChange={(event) => event.target.value && choose(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Select…
        </option>
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-slate-400">
        Used only to match patients who ask for a female or male clinician. Never shown to
        patients.
      </span>
    </label>
  );
};
