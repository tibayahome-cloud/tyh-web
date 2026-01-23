import { coerceDate, coerceId, coerceNumber, coerceString, toObject } from "./helpers";
import { type UserResource, mapUserResource } from "./user";

export interface ProviderService {
    id: string;
    serviceId: string;
    name: string;
    key: string;
    active: boolean;
    priceCents: number;
    estimateMinutes: number | null;
}

export interface ProviderAvailability {
    id: string;
    weekday: number;
    startTime: string;
    endTime: string;
    effectiveFrom: string | null;
    effectiveTo: string | null;
}

export interface ProviderBlackout {
    id: string;
    startAt: string;
    endAt: string;
    reason: string | null;
}

export interface Provider {
    id: string;
    userId: string;
    verified: boolean;
    verifiedAt: string | null;
    isAvailable: boolean;
    dailyRequestLimit: number;
    canEmergency: boolean;
    ratingAvg: number;
    ratingCount: number;
    timezone: string | null;
    homeLat: number | null;
    homeLng: number | null;
    currentLat: number | null;
    currentLng: number | null;
    locationUpdatedAt: string | null;
    zoneId: string | null;
    priorityScore: number | null;
    user?: UserResource | null;
    services: ProviderService[];
    availability: ProviderAvailability[];
    blackouts: ProviderBlackout[];
}

export const mapProviderService = (payload: unknown): ProviderService | null => {
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    // Flatten nested service details if present
    const serviceDetail = toObject(raw.service);
    if (!id) return null;
    return {
        id,
        serviceId: coerceId(raw.service_id),
        name: coerceString(serviceDetail.name) || "",
        key: coerceString(serviceDetail.key) || "",
        active: Boolean(raw.active),
        priceCents: Number(serviceDetail.base_price_cents) || 0,
        estimateMinutes: Number(serviceDetail.default_estimate_minutes) || null
    };
};

export const mapProvider = (payload: unknown): Provider | null => {
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    if (!id) return null;

    const servicesRaw = Array.isArray(raw.services) ? raw.services : [];
    const availabilityRaw = Array.isArray(raw.availability) ? raw.availability : [];
    const blackoutsRaw = Array.isArray(raw.blackouts) ? raw.blackouts : [];

    return {
        id,
        userId: coerceId(raw.user_id),
        verified: Boolean(raw.verified),
        verifiedAt: coerceDate(raw.verified_at),
        isAvailable: Boolean(raw.is_available),
        dailyRequestLimit: Number(raw.daily_request_limit) || 0,
        canEmergency: Boolean(raw.can_emergency),
        ratingAvg: Number(raw.rating_avg) || 0,
        ratingCount: Number(raw.rating_count) || 0,
        timezone: coerceString(raw.timezone),
        homeLat: coerceNumber(raw.home_lat),
        homeLng: coerceNumber(raw.home_lng),
        currentLat: coerceNumber(raw.current_lat),
        currentLng: coerceNumber(raw.current_lng),
        locationUpdatedAt: coerceDate(raw.location_updated_at),
        zoneId: coerceString(raw.zone_id),
        priorityScore: coerceNumber(raw.priority_score),
        user: raw.user ? mapUserResource(raw.user) : null,
        services: servicesRaw
            .map((s) => mapProviderService(s))
            .filter((s): s is ProviderService => Boolean(s)),
        availability: availabilityRaw.map((a: any) => ({
            id: coerceId(a.id),
            weekday: Number(a.weekday) || 0,
            startTime: coerceString(a.start_time) || "00:00",
            endTime: coerceString(a.end_time) || "00:00",
            effectiveFrom: coerceDate(a.effective_from),
            effectiveTo: coerceDate(a.effective_to)
        })),
        blackouts: blackoutsRaw.map((b: any) => ({
            id: coerceId(b.id),
            startAt: coerceDate(b.start_at) || "",
            endAt: coerceDate(b.end_at) || "",
            reason: coerceString(b.reason)
        }))
    };
};
