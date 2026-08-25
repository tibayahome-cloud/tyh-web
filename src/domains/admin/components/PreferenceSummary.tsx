import { useQuery } from "@tanstack/react-query";

import { fetchProviderPreference } from "../../../shared/libs/telemedicineOps";

type Props = { bookingId: string };

const GENDER_LABEL: Record<string, string> = {
  female: "prefers a female clinician",
  male: "prefers a male clinician",
  no_preference: "no clinician preference"
};

const LANGUAGE_LABEL: Record<string, string> = { en: "English", sw: "Kiswahili" };

/**
 * What the client asked for, shown to whoever is choosing their clinician.
 *
 * Renders nothing when no preference was expressed, rather than an empty panel: most bookings
 * have none, and a permanent "No preferences" row trains operators to stop reading the space
 * where a real one would appear.
 *
 * The system can only verify some of this. Gender and language are matched where the provider
 * recorded them; the free-text note is not matched automatically and is shown so an operator can
 * act on it when software cannot.
 */
export const PreferenceSummary = ({ bookingId }: Props) => {
  const { data: preference } = useQuery({
    queryKey: ["telemedicine", "preference", bookingId],
    queryFn: () => fetchProviderPreference(bookingId),
    staleTime: 60_000
  });

  if (!preference) return null;

  const parts = [
    preference.preferredGender ? GENDER_LABEL[preference.preferredGender] : null,
    preference.preferredLanguage
      ? `speaks ${LANGUAGE_LABEL[preference.preferredLanguage] ?? preference.preferredLanguage}`
      : null
  ].filter(Boolean);

  if (!parts.length && !preference.note) return null;

  return (
    <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client asked for</p>
      {parts.length > 0 && <p className="mt-1 text-sm text-slate-700">{parts.join(", ")}</p>}
      {preference.note && (
        <p className="mt-1 text-sm italic text-slate-600">&ldquo;{preference.note}&rdquo;</p>
      )}
      <p className="mt-1 text-xs text-slate-400">
        A request, not a requirement -- assign whoever is right for this appointment.
      </p>
    </div>
  );
};
