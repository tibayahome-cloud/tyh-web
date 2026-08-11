// Mirrors app/services/region_policy.py -- v1 is Kenya-only. The backend enforces this
// server-side regardless of what the frontend sends; this list only drives the picker UI.
export const SUPPORTED_COUNTRIES = [{ code: "KE", name: "Kenya" }] as const;

export const DEFAULT_COUNTRY_CODE = "KE";

export const isSupportedCountry = (countryCode: string | null | undefined): boolean =>
  Boolean(countryCode) && SUPPORTED_COUNTRIES.some((country) => country.code === countryCode);
