import api, { type CursorResponse, type CursorMeta } from "./api";
import {
  mapSelfCareAlert,
  mapSelfCareCheckin,
  mapSelfCareProfile,
  type SelfCareAlert,
  type SelfCareAlertFilters,
  type SelfCareCheckin,
  type SelfCareCheckinInput,
  type SelfCareProfile,
  type SelfCareProfileUpdateInput
} from "../schemas/selfcare";

const buildUserParams = (userId?: string | null) => (userId ? { user_id: userId } : undefined);

export const fetchSelfCareProfile = async (userId?: string | null): Promise<SelfCareProfile> => {
  const response = await api.get("/selfcare/profile", {
    params: buildUserParams(userId)
  });
  const profile = mapSelfCareProfile(response.data?.data);
  if (!profile) {
    throw new Error("Profile not found");
  }
  return profile;
};

export const updateSelfCareProfile = async (
  input: SelfCareProfileUpdateInput,
  userId?: string | null
): Promise<SelfCareProfile> => {
  const payload: Record<string, unknown> = {};
  if (input.status) {
    payload.status = input.status;
  }
  if (input.consentAi !== undefined) {
    payload.consent_selfcare_ai = input.consentAi;
  }
  if (input.consentDataSharing !== undefined) {
    payload.consent_data_sharing = input.consentDataSharing;
  }
  if (input.primaryGoals !== undefined) {
    payload.primary_goals = input.primaryGoals;
  }
  if (input.currentConditions) {
    payload.current_conditions = input.currentConditions;
  }
  if (input.medications) {
    payload.medications = input.medications;
  }
  if (input.riskFactors) {
    payload.risk_factors = input.riskFactors;
  }
  if (input.preferences) {
    payload.preferences = input.preferences;
  }
  if (input.primaryProviderUserId !== undefined) {
    payload.primary_provider_user_id = input.primaryProviderUserId;
  }

  const response = await api.post("/selfcare/profile", payload, {
    params: buildUserParams(userId)
  });
  const profile = mapSelfCareProfile(response.data?.data);
  if (!profile) {
    throw new Error("Profile update failed");
  }
  return profile;
};

const toSymptomPayload = (symptoms?: string[]) =>
  (symptoms ?? [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((label) => ({
      label,
      source: "manual"
    }));

const toVitalsPayload = (vitals: SelfCareCheckinInput["vitals"]) => {
  if (!vitals) {
    return undefined;
  }
  const payload: Record<string, number> = {};
  if (vitals.bpSystolic != null) {
    payload.bp_systolic = vitals.bpSystolic;
  }
  if (vitals.bpDiastolic != null) {
    payload.bp_diastolic = vitals.bpDiastolic;
  }
  if (vitals.heartRate != null) {
    payload.hr = vitals.heartRate;
  }
  if (vitals.temperature != null) {
    payload.temp = vitals.temperature;
  }
  if (vitals.spo2 != null) {
    payload.spo2 = vitals.spo2;
  }
  return payload;
};

export const createSelfCareCheckin = async (
  input: SelfCareCheckinInput,
  userId?: string | null
): Promise<SelfCareCheckin> => {
  const payload: Record<string, unknown> = {
    mood: input.mood,
    note: input.note,
    symptoms: toSymptomPayload(input.symptoms)
  };
  if (input.checkedAt) {
    payload.checked_at = input.checkedAt;
  }
  const vitalsPayload = toVitalsPayload(input.vitals);
  if (vitalsPayload && Object.keys(vitalsPayload).length > 0) {
    payload.vitals = vitalsPayload;
  }
  const response = await api.post("/selfcare/checkins", payload, {
    params: buildUserParams(userId)
  });
  const checkin = mapSelfCareCheckin(response.data?.data);
  if (!checkin) {
    throw new Error("Unable to record check-in");
  }
  return checkin;
};

export const fetchSelfCareCheckins = async (
  params: { userId?: string | null; limit?: number; cursor?: string | null } = {}
): Promise<CursorResponse<SelfCareCheckin>> => {
  const response = await api.get("/selfcare/checkins", {
    params: {
      ...buildUserParams(params.userId),
      limit: params.limit ?? 20,
      cursor: params.cursor
    }
  });
  const entries = Array.isArray(response.data?.data) ? response.data.data : [];
  const meta = response.data?.meta as CursorMeta;

  const data = entries
    .map((entry: any) => mapSelfCareCheckin(entry))
    .filter((entry: any): entry is SelfCareCheckin => Boolean(entry));

  return {
    data,
    meta: meta || { limit: params.limit ?? 20, next_cursor: null }
  };
};

const normalizeAlertFilters = (filters: SelfCareAlertFilters = {}) => ({
  status: filters.status ?? null,
  riskLevel: filters.riskLevel ?? null,
  clientId: filters.clientId ?? null,
  limit: filters.limit ?? 50
});

export const fetchSelfCareAlerts = async (filters: SelfCareAlertFilters = {}): Promise<SelfCareAlert[]> => {
  const normalized = normalizeAlertFilters(filters);
  const params: Record<string, unknown> = {
    limit: normalized.limit
  };
  if (normalized.status) {
    params.status = normalized.status;
  }
  if (normalized.riskLevel) {
    params.risk_level = normalized.riskLevel;
  }
  if (normalized.clientId) {
    params.client_id = normalized.clientId;
  }
  const response = await api.get("/selfcare/alerts", { params });
  const entries = Array.isArray(response.data?.data) ? response.data.data : [];
  return entries
    .map((entry) => mapSelfCareAlert(entry))
    .filter((entry): entry is SelfCareAlert => Boolean(entry));
};

export const acknowledgeSelfCareAlert = async (alertId: string): Promise<SelfCareAlert> => {
  const response = await api.post(`/selfcare/alerts/${alertId}/ack`);
  const alert = mapSelfCareAlert(response.data?.data);
  if (!alert) {
    throw new Error("Unable to acknowledge alert");
  }
  return alert;
};

export const closeSelfCareAlert = async (alertId: string, reason?: string): Promise<SelfCareAlert> => {
  const response = await api.post(`/selfcare/alerts/${alertId}/close`, { reason });
  const alert = mapSelfCareAlert(response.data?.data);
  if (!alert) {
    throw new Error("Unable to close alert");
  }
  return alert;
};
