import api from "./api";
import type {
  TelemedicineAssignmentBooking,
  TelemedicineHold,
  TelemedicineSessionJoin,
  TelemedicineSlot
} from "../schemas/telemedicine";
import {
  mapTelemedicineAssignmentBookings,
  mapTelemedicineHold,
  mapTelemedicineSessionJoin,
  mapTelemedicineSlots
} from "../schemas/telemedicine";

export type RemoteFacility = {
  id: string;
  name: string;
  facilityType: string | null;
  address: string | null;
  county: string | null;
  facilityServiceId: string;
  priceCents: number;
  currency: string;
  estimateDurationMinutes: number | null;
};

export const discoverRemoteFacilities = async (
  serviceId: string,
  countryCode?: string
): Promise<RemoteFacility[]> => {
  const response = await api.get("/facilities/discover-remote", {
    params: { service_id: serviceId, ...(countryCode ? { country_code: countryCode } : {}) }
  });
  const payload = (response.data ?? {}) as Record<string, unknown>;
  const data = Array.isArray(payload.data) ? payload.data : [];
  return data
    .map((entry: Record<string, unknown>) => {
      const service = (entry.service ?? {}) as Record<string, unknown>;
      const facilityServiceId = service.facility_service_id;
      if (typeof entry.id !== "string" || typeof facilityServiceId !== "string") {
        return null;
      }
      return {
        id: entry.id,
        name: typeof entry.name === "string" ? entry.name : "",
        facilityType: typeof entry.facility_type === "string" ? entry.facility_type : null,
        address: typeof entry.address === "string" ? entry.address : null,
        county: typeof entry.county === "string" ? entry.county : null,
        facilityServiceId,
        priceCents: typeof service.price_cents === "number" ? service.price_cents : 0,
        currency: typeof service.currency === "string" ? service.currency : "KES",
        estimateDurationMinutes:
          typeof service.estimate_duration_minutes === "number" ? service.estimate_duration_minutes : null
      } satisfies RemoteFacility;
    })
    .filter((entry): entry is RemoteFacility => Boolean(entry));
};

export const fetchAvailableSlots = async (
  facilityId: string,
  facilityServiceId: string,
  startDate: string,
  endDate?: string
): Promise<TelemedicineSlot[]> => {
  const response = await api.get(`/facilities/${facilityId}/telemedicine/available-slots`, {
    params: {
      facility_service_id: facilityServiceId,
      start_date: startDate,
      end_date: endDate ?? startDate
    }
  });
  return mapTelemedicineSlots(response.data?.data);
};

export const createHold = async (
  facilityId: string,
  input: { facilityServiceId: string; startAt: string; idempotencyKey?: string }
): Promise<TelemedicineHold> => {
  const response = await api.post(`/facilities/${facilityId}/telemedicine/holds`, {
    facility_service_id: input.facilityServiceId,
    start_at: input.startAt,
    idempotency_key: input.idempotencyKey
  });
  const hold = mapTelemedicineHold(response.data?.data);
  if (!hold) {
    throw new Error("Failed to create telemedicine hold");
  }
  return hold;
};

export const getHold = async (holdId: string): Promise<TelemedicineHold> => {
  const response = await api.get(`/telemedicine/holds/${holdId}`);
  const hold = mapTelemedicineHold(response.data?.data);
  if (!hold) {
    throw new Error("Telemedicine hold not found");
  }
  return hold;
};

export const releaseHold = async (holdId: string): Promise<TelemedicineHold> => {
  const response = await api.post(`/telemedicine/holds/${holdId}/release`);
  const hold = mapTelemedicineHold(response.data?.data);
  if (!hold) {
    throw new Error("Failed to release telemedicine hold");
  }
  return hold;
};

export const initiateHoldPayment = async (
  holdId: string,
  options: { phone?: string; method?: string } = {}
): Promise<{ hold: TelemedicineHold; paymentId?: string; paymentStatus?: string }> => {
  const response = await api.post(`/telemedicine/holds/${holdId}/payment`, {
    phone: options.phone,
    method: options.method
  });
  const hold = mapTelemedicineHold(response.data?.data);
  if (!hold) {
    throw new Error("Failed to initiate telemedicine payment");
  }
  return {
    hold,
    paymentId: response.data?.meta?.payment_id,
    paymentStatus: response.data?.meta?.payment_status
  };
};

export const joinSession = async (bookingId: string): Promise<TelemedicineSessionJoin> => {
  const response = await api.post(`/telemedicine/bookings/${bookingId}/session/join`);
  const join = mapTelemedicineSessionJoin(response.data?.data);
  if (!join) {
    throw new Error("Failed to join telemedicine session");
  }
  return join;
};

// Call only once Jitsi actually reports a successful connection (videoConferenceJoined) --
// issuing a token above proves authorization, not that the participant ever reached the room.
export const confirmSessionJoin = async (bookingId: string): Promise<{ sessionId: string; status: string }> => {
  const response = await api.post(`/telemedicine/bookings/${bookingId}/session/confirm-join`);
  const data = (response.data?.data ?? {}) as Record<string, unknown>;
  return {
    sessionId: typeof data.session_id === "string" ? data.session_id : "",
    status: typeof data.status === "string" ? data.status : ""
  };
};

export const endSession = async (
  bookingId: string
): Promise<{ sessionId: string; status: string; endedAt: string | null }> => {
  const response = await api.post(`/telemedicine/bookings/${bookingId}/session/end`);
  const data = (response.data?.data ?? {}) as Record<string, unknown>;
  return {
    sessionId: typeof data.session_id === "string" ? data.session_id : "",
    status: typeof data.status === "string" ? data.status : "",
    endedAt: typeof data.ended_at === "string" ? data.ended_at : null
  };
};

export const reportNoShow = async (
  bookingId: string
): Promise<{ disputeId: string; disputeType: string; status: string; bookingStatus: string }> => {
  const response = await api.post(`/telemedicine/bookings/${bookingId}/no-show`);
  const data = (response.data?.data ?? {}) as Record<string, unknown>;
  return {
    disputeId: typeof data.dispute_id === "string" ? data.dispute_id : "",
    disputeType: typeof data.dispute_type === "string" ? data.dispute_type : "",
    status: typeof data.status === "string" ? data.status : "",
    bookingStatus: typeof data.booking_status === "string" ? data.booking_status : ""
  };
};

export const fetchAssignmentQueue = async (): Promise<TelemedicineAssignmentBooking[]> => {
  const response = await api.get("/telemedicine/assignments");
  return mapTelemedicineAssignmentBookings(response.data?.data);
};

export const assignProvider = async (
  bookingId: string,
  providerUserId: string
): Promise<{ id: string; status: string; providerUserId: string | null }> => {
  const response = await api.post(`/telemedicine/bookings/${bookingId}/assign`, {
    provider_user_id: providerUserId
  });
  const data = (response.data?.data ?? {}) as Record<string, unknown>;
  return {
    id: typeof data.id === "string" ? data.id : bookingId,
    status: typeof data.status === "string" ? data.status : "",
    providerUserId: typeof data.provider_user_id === "string" ? data.provider_user_id : null
  };
};
