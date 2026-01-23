import { coerceDate, coerceId, coerceString, toObject } from "./helpers";
import { type UserResource, mapUserResource } from "./user";

export interface SelfCareProfile {
    id: string;
    userId: string;
    nickname: string | null;
    bio: string | null;
    birthDate: string | null;
    gender: string | null;
    bloodType: string | null;
    allergies: string[];
    chronicConditions: string[];
    medications: string[];
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelation: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    user?: UserResource | null;
}

export interface SelfCareCheckin {
    id: string;
    profileId: string;
    mood: string;
    energyLevel: number;
    sleepHours: number | null;
    waterIntakeLens: number | null;
    notes: string | null;
    checkinAt: string;
}

export interface SelfCareAlert {
    id: string;
    profileId: string;
    alertType: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    status: "pending" | "acknowledged" | "resolved";
    resolvedAt: string | null;
    resolvedBy?: string | null;
    createdAt: string;
}

export const mapSelfCareProfile = (payload: unknown): SelfCareProfile | null => {
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    if (!id) return null;

    return {
        id,
        userId: coerceId(raw.user_id),
        nickname: coerceString(raw.nickname),
        bio: coerceString(raw.bio),
        birthDate: coerceDate(raw.birth_date),
        gender: coerceString(raw.gender),
        bloodType: coerceString(raw.blood_type),
        allergies: Array.isArray(raw.allergies) ? raw.allergies : [],
        chronicConditions: Array.isArray(raw.chronic_conditions) ? raw.chronic_conditions : [],
        medications: Array.isArray(raw.medications) ? raw.medications : [],
        emergencyContactName: coerceString(raw.emergency_contact_name),
        emergencyContactPhone: coerceString(raw.emergency_contact_phone),
        emergencyContactRelation: coerceString(raw.emergency_contact_relation),
        createdAt: coerceDate(raw.created_at),
        updatedAt: coerceDate(raw.updated_at),
        user: raw.user ? mapUserResource(raw.user) : null
    };
};

export const mapSelfCareCheckin = (payload: unknown): SelfCareCheckin | null => {
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    if (!id) return null;

    return {
        id,
        profileId: coerceId(raw.profile_id),
        mood: coerceString(raw.mood) || "neutral",
        energyLevel: Number(raw.energy_level) || 5,
        sleepHours: raw.sleep_hours != null ? Number(raw.sleep_hours) : null,
        waterIntakeLens: raw.water_intake_lens != null ? Number(raw.water_intake_lens) : null,
        notes: coerceString(raw.notes),
        checkinAt: coerceDate(raw.checkin_at) || new Date().toISOString()
    };
};

export const mapSelfCareAlert = (payload: unknown): SelfCareAlert | null => {
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    if (!id) return null;

    return {
        id,
        profileId: coerceId(raw.profile_id),
        alertType: coerceString(raw.alert_type) || "manual",
        severity: (raw.severity as any) || "medium",
        message: coerceString(raw.message) || "",
        status: (raw.status as any) || "pending",
        resolvedAt: coerceDate(raw.resolved_at),
        resolvedBy: coerceId(raw.resolved_by),
        createdAt: coerceDate(raw.created_at) || new Date().toISOString()
    };
};
