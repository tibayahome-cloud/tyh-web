import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { useAuth } from "../../../shared/hooks/useAuth";
import { useToast } from "../../../shared/components/ToastProvider";
import api from "../../../shared/libs/api";
import { SUPPORTED_COUNTRIES } from "../../../shared/constants/region";

type ProfileFormState = {
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
};

const buildInitialForm = (user?: {
  fullName: string;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
}): ProfileFormState => ({
  fullName: user?.fullName ?? "",
  email: user?.email ?? "",
  phone: user?.phone ?? "",
  countryCode: user?.countryCode ?? ""
});

const ProviderProfile = () => {
  const { user, bootstrapMe } = useAuth();
  const toast = useToast();
  const [formState, setFormState] = useState<ProfileFormState>(() => buildInitialForm(user ?? undefined));

  useEffect(() => {
    setFormState(buildInitialForm(user ?? undefined));
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: async (payload: ProfileFormState) => {
      if (!user?.id) {
        throw new Error("Missing user id");
      }
      await api.patch(`/users/${user.id}`, {
        full_name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        country_code: payload.countryCode || null
      });
    },
    onSuccess: async () => {
      await bootstrapMe();
      toast.showToast({
        title: "Profile updated",
        description: "Your contact information was saved."
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update profile",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    }
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    profileMutation.mutate(formState);
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Profile</p>
        <h1 className="text-2xl font-semibold text-slate-900">Personal details</h1>
        <p className="text-sm text-slate-500">Update your public information and contact preferences.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="grid gap-6" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Full name
            <input
              type="text"
              placeholder="Your legal name"
              value={formState.fullName}
              onChange={(event) => setFormState((prev) => ({ ...prev, fullName: event.target.value }))}
              className="rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Phone number
            <input
              type="tel"
              placeholder="+254..."
              value={formState.phone}
              onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
              className="rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              placeholder="name@example.com"
              value={formState.email}
              onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
              className="rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Country
            <select
              value={formState.countryCode}
              onChange={(event) => setFormState((prev) => ({ ...prev, countryCode: event.target.value }))}
              className="rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Select your country</option>
              {SUPPORTED_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-slate-500">
              Required to become eligible for remote (telemedicine) consultations.
            </span>
          </label>
          <button
            type="submit"
            disabled={profileMutation.isPending}
            className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {profileMutation.isPending ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default ProviderProfile;
