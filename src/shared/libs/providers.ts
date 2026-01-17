import api from "./api";
import { buildFieldParams, providerProfile } from "./fieldInclude";

export type ProviderCandidate = {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  canEmergency: boolean;
  distanceM: number | null;
  activeAssignments: number;
  dailyRequestLimit: number;
  lastAssignedAt: string | null;
  nextAvailableAt: string | null;
  priorityScore?: number | null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const mapCandidate = (payload: Record<string, unknown>): ProviderCandidate => {
  const user = toRecord(payload.user);
  const meta = toRecord(payload.candidate_meta);
  return {
    id: String(payload.id),
    userId: String(payload.user_id),
    fullName: (user.full_name as string) ?? "Provider",
    email: (user.email as string) ?? null,
    phone: (user.phone as string) ?? null,
    ratingAvg: payload.rating_avg != null ? Number(payload.rating_avg) : null,
    ratingCount: payload.rating_count != null ? Number(payload.rating_count) : 0,
    canEmergency: Boolean(payload.can_emergency),
    distanceM: meta.distance_m != null ? Number(meta.distance_m) : null,
    activeAssignments: meta.active_assignments != null ? Number(meta.active_assignments) : 0,
    dailyRequestLimit: meta.daily_limit != null ? Number(meta.daily_limit) : (payload.daily_request_limit != null ? Number(payload.daily_request_limit) : 0),
    lastAssignedAt: meta.last_assigned_at ? String(meta.last_assigned_at) : null,
    nextAvailableAt: meta.next_available_at ? String(meta.next_available_at) : null,
    priorityScore: payload.priority_score != null ? Number(payload.priority_score) : null
  };
};

type EligibleParams = {
  search?: string;
  limit?: number;
};

export const fetchEligibleProviders = async (
  bookingId: string,
  params: EligibleParams = {}
): Promise<ProviderCandidate[]> => {
  if (!bookingId) {
    return [];
  }
  const query: Record<string, string | number> = {
    ...buildFieldParams(providerProfile),
    "filter[eligible_for]": bookingId,
    limit: params.limit ?? 25,
    "page[number]": 1,
    "page[size]": params.limit ?? 25
  };
  if (params.search) {
    query["filter[q]"] = params.search;
  }
  const response = await api.get("/providers", { params: query });
  const rows = Array.isArray(response.data?.data) ? response.data.data : [];
  return rows.map((entry: unknown) => mapCandidate(toRecord(entry)));
};

export const updateProviderLocation = async (userId: string, lat: number, lng: number): Promise<void> => {
  await api.post(`/providers/${userId}/location`, { lat, lng });
};

