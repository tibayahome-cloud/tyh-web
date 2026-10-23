import api from "./api";

// Whether clients can book a video consultation with a facility or a provider, and what is in the way.
// The server decides; this only reads the answer. `fix` names the screen that resolves a blocker, and each
// screen decides what to link it to (a facility admin and a provider fix different things).

export type LiveBlocker = {
  code: string;
  message: string;
  fix: string;
};

export type LiveStatus = {
  live: boolean;
  firstBlocker: LiveBlocker | null;
  blockers: LiveBlocker[];
  /** ISO time of the earliest free appointment in the next days; facilities only. */
  nextOpenAt: string | null;
  lookaheadDays: number | null;
};

const toBlocker = (value: unknown): LiveBlocker | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.code !== "string" || typeof raw.message !== "string") return null;
  return { code: raw.code, message: raw.message, fix: typeof raw.fix === "string" ? raw.fix : "" };
};

export const mapLiveStatus = (payload: unknown): LiveStatus => {
  const envelope = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const raw = (envelope.data && typeof envelope.data === "object" ? envelope.data : envelope) as Record<string, unknown>;
  const blockers = (Array.isArray(raw.blockers) ? raw.blockers : [])
    .map(toBlocker)
    .filter((blocker): blocker is LiveBlocker => blocker !== null);
  return {
    live: raw.live === true,
    firstBlocker: toBlocker(raw.first_blocker) ?? blockers[0] ?? null,
    blockers,
    nextOpenAt: typeof raw.next_open_at === "string" ? raw.next_open_at : null,
    lookaheadDays: typeof raw.lookahead_days === "number" ? raw.lookahead_days : null
  };
};

export const fetchFacilityLiveStatus = async (facilityId: string): Promise<LiveStatus> => {
  const response = await api.get(`/facilities/${facilityId}/telemedicine/readiness`);
  return mapLiveStatus(response.data);
};

export const fetchProviderLiveStatus = async (userId: string): Promise<LiveStatus> => {
  const response = await api.get(`/providers/${userId}/readiness`);
  return mapLiveStatus(response.data);
};
