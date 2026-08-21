import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import api from "../../../shared/libs/api";
import { Button } from "../../../shared/components/Button";

type Setup = {
  gender: string | null;
  genderConfigured: boolean;
  availabilityConfigured: boolean;
  /** The operational toggle. Never used to decide whether hours have been set. */
  currentlyAvailable: boolean;
};

export const fetchSetup = async (): Promise<Setup> => {
  const response = await api.get("/providers/me/profile");
  const data = response.data?.data ?? {};
  return {
    gender: data.gender ?? null,
    genderConfigured: Boolean(data.gender_configured),
    availabilityConfigured: Boolean(data.availability_configured),
    currentlyAvailable: Boolean(data.currently_available)
  };
};

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" }
];

/**
 * The setup tasks a clinician can act on themselves.
 *
 * Only things they can personally fix appear here. Services, verification and telemedicine
 * enablement are the facility's to arrange, and listing work somebody cannot do teaches them to
 * dismiss the card unread -- which then buries the items they could have acted on.
 *
 * Nothing here blocks anything. Every provider predates these fields, so a required answer
 * would lock them out of their own dashboard, which is a worse outcome than the matching
 * staying inert a while longer.
 */
export const ProviderSetupCard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const { data: setup } = useQuery({ queryKey: ["provider", "me", "setup"], queryFn: fetchSetup });

  const saveGender = useMutation({
    mutationFn: (gender: string) => api.patch("/providers/me/profile", { gender }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider", "me", "setup"] })
  });

  if (!setup || dismissed) return null;

  const outstanding = [
    !setup.availabilityConfigured && "availability",
    !setup.genderConfigured && "gender"
  ].filter(Boolean) as string[];

  if (outstanding.length === 0) return null;

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-sky-900">A couple of things to finish</h3>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs font-medium text-sky-700 underline"
        >
          Not now
        </button>
      </div>

      <ul className="mt-3 space-y-3">
        {!setup.availabilityConfigured && (
          <li>
            {/* The consequence is the urgency: this fails silently today, so a provider can
                believe they are live while generating no slots at all. */}
            <p className="text-sm font-medium text-sky-900">
              Clients cannot book you until you set your availability.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              onClick={() => navigate("/pro/availability")}
            >
              Set your hours
            </Button>
          </li>
        )}

        {!setup.genderConfigured && (
          <li>
            <p className="text-sm text-sky-900">
              Some patients ask to see a female or a male clinician. Telling us lets the care
              site take that into account when assigning you. Patients never see this.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={saveGender.isPending}
                  onClick={() => saveGender.mutate(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </li>
        )}
      </ul>
    </section>
  );
};

/** The plain settings row, always available whether or not the card is showing. */
export const GenderSettingRow = () => {
  const queryClient = useQueryClient();
  const { data: setup } = useQuery({ queryKey: ["provider", "me", "setup"], queryFn: fetchSetup });
  const saveGender = useMutation({
    mutationFn: (gender: string) => api.patch("/providers/me/profile", { gender }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider", "me", "setup"] })
  });

  if (!setup) return null;

  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">Gender</span>
      <select
        value={setup.gender ?? ""}
        onChange={(event) => event.target.value && saveGender.mutate(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Select…
        </option>
        {GENDER_OPTIONS.map((option) => (
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
