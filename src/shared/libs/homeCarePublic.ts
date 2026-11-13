import type { AxiosError } from "axios";

import { api } from "./api";

/**
 * Home care for a visitor who has no account: the services, which clinics reach a place, a texted code, and the request.
 * The routes are public (tyh-api `public_home_care`); nothing here needs a sign-in.
 */

export type HomeCareService = {
  id: string;
  name: string;
  description?: string | null;
  base_price_cents: number;
  default_estimate_minutes: number;
  category?: { id: string; name: string } | null;
};

export type HomeCareClinic = {
  id: string;
  name: string;
  distance_km: number;
  price_cents: number;
  currency: string;
  estimate_duration_minutes: number;
};

export type HomeCareCoverage = {
  covered: boolean;
  service_id: string;
  facilities: HomeCareClinic[];
};

export type CodeAnswer = {
  status: "sent" | "sign_in";
  expires_in: number;
  resend_after: number;
};

export type HomeCareRequestResult = {
  booking_id: string;
  reference: string;
  status: string;
  scheduled_at: string | null;
  facility: { id: string; name: string };
  price_cents: number;
  currency: string;
  account_created: boolean;
};

type Envelope<T> = { data: T };

export const fetchHomeCareServices = async (): Promise<HomeCareService[]> => {
  const response = await api.get<Envelope<HomeCareService[]>>("/services", {
    params: {
      fields: "id,name,description,base_price_cents,default_estimate_minutes",
      include: "category:id,name",
      "filter[active]": "true",
      "filter[has_active_offering]": "true",
      "filter[care_type]": "home_based"
    }
  });
  return response.data.data;
};

export const fetchHomeCareCoverage = async (
  serviceId: string,
  place: { lat: number; lng: number },
  signal?: AbortSignal
): Promise<HomeCareCoverage> => {
  const response = await api.get<Envelope<HomeCareCoverage>>("/public/home-care/coverage", {
    params: { service_id: serviceId, lat: place.lat, lng: place.lng },
    signal
  });
  return response.data.data;
};

export const sendHomeCareCode = async (body: {
  phone: string;
  service_id: string;
  lat: number;
  lng: number;
  bot_token?: string;
}): Promise<CodeAnswer> => {
  const response = await api.post<Envelope<CodeAnswer>>("/public/home-care/code", body);
  return response.data.data;
};

export const createHomeCareRequest = async (body: {
  phone: string;
  code: string;
  full_name: string;
  service_id: string;
  facility_id?: string;
  lat: number;
  lng: number;
  address_text: string;
  landmark?: string;
  scheduled_at?: string | null;
  legal_documents: Array<{ type: string; version: string }>;
}): Promise<HomeCareRequestResult> => {
  const response = await api.post<Envelope<HomeCareRequestResult>>("/public/home-care/requests", body);
  return response.data.data;
};

/** The stable reason the API gave for a refusal (`not_covered`, `wait`, `codes_unavailable`, `code_wrong`, ...), if any. */
export const homeCareErrorCode = (error: unknown): string | null => {
  const details = (error as AxiosError<{ error?: { details?: { code?: unknown } } }>)?.response?.data?.error?.details;
  return typeof details?.code === "string" ? details.code : null;
};

/** Seconds the API asked the caller to wait before trying again, if it said. */
export const homeCareRetryAfter = (error: unknown): number | null => {
  const details = (error as AxiosError<{ error?: { details?: { retry_after?: unknown } } }>)?.response?.data?.error?.details;
  return typeof details?.retry_after === "number" ? details.retry_after : null;
};
