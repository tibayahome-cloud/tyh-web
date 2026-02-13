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
    consentAi: boolean;
    consentDataSharing: boolean;
    primaryGoals: string | null;
    preferences: {
        notification_channel: string;
        quiet_hours: string;
    } | null;
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
    aiRiskLevel?: string | null;
    recommendation?: {
        summary: string;
        riskLevel: string;
        steps: Array<{
            title: string;
            description: string;
            timeframe?: string | null;
            caution?: string | null;
        }>;
        whenToSeekHelp: Array<{
            trigger: string;
            description: string;
        }>;
    } | null;
    vitals?: {
        bpSystolic?: number;
        bpDiastolic?: number;
        heartRate?: number;
        temperature?: number;
        oxygenLevel?: number;
    } | null;
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

interface RawSelfCarePayload {
    id?: string;
    user_id?: string;
    nickname?: string;
    bio?: string;
    birth_date?: string;
    gender?: string;
    blood_type?: string;
    allergies?: string[];
    chronic_conditions?: string[];
    medications?: string[];
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relation?: string;
    created_at?: string;
    updated_at?: string;
    user?: unknown;
    consent_ai?: boolean;
    consentAi?: boolean;
    consent_data_sharing?: boolean;
    consentDataSharing?: boolean;
    primary_goals?: string;
    primaryGoals?: string;
    preferences?: {
        notification_channel?: string;
        notificationChannel?: string;
        quiet_hours?: string;
        quietHours?: string;
    };
    profile_id?: string;
    mood?: string;
    energy_level?: number | string;
    sleep_hours?: number | string;
    water_intake_lens?: number | string;
    notes?: string;
    checkin_at?: string;
    ai_risk_level?: string;
    recommendation?: {
        summary?: string;
        risk_level?: string;
        riskLevel?: string;
        steps?: Array<{
            title?: string;
            description?: string;
            timeframe?: string;
            caution?: string;
        }>;
        when_to_seek_help?: Array<{
            trigger?: string;
            description?: string;
        }>;
        whenToSeekHelp?: Array<{
            trigger?: string;
            description?: string;
        }>;
    };
    vitals?: {
        bp_systolic?: number | string;
        bpSystolic?: number | string;
        bp_diastolic?: number | string;
        bpDiastolic?: number | string;
        heart_rate?: number | string;
        heartRate?: number | string;
        temperature?: number | string;
        oxygen_level?: number | string;
        oxygenLevel?: number | string;
    };
    alert_type?: string;
    severity?: "low" | "medium" | "high" | "critical";
    message?: string;
    status?: "pending" | "acknowledged" | "resolved";
    resolved_at?: string;
    resolved_by?: string;
}

export const mapSelfCareProfile = (payload: unknown): SelfCareProfile | null => {
    const raw = toObject(payload) as RawSelfCarePayload;
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
        user: raw.user ? mapUserResource(raw.user) : null,
        consentAi: Boolean(raw.consent_ai ?? raw.consentAi),
        consentDataSharing: Boolean(raw.consent_data_sharing ?? raw.consentDataSharing),
        primaryGoals: coerceString(raw.primary_goals ?? raw.primaryGoals),
        preferences: raw.preferences ? {
            notification_channel: coerceString(raw.preferences.notification_channel || raw.preferences.notificationChannel) || "push",
            quiet_hours: coerceString(raw.preferences.quiet_hours || raw.preferences.quietHours) || ""
        } : null
    };
};

export const mapSelfCareCheckin = (payload: unknown): SelfCareCheckin | null => {
    const raw = toObject(payload) as RawSelfCarePayload;
    const id = coerceId(raw.id);
    if (!id) return null;

    const vitals = raw.vitals;
    return {
        id,
        profileId: coerceId(raw.profile_id),
        mood: coerceString(raw.mood) || "neutral",
        energyLevel: Number(raw.energy_level) || 5,
        sleepHours: raw.sleep_hours != null ? Number(raw.sleep_hours) : null,
        waterIntakeLens: raw.water_intake_lens != null ? Number(raw.water_intake_lens) : null,
        notes: coerceString(raw.notes),
        checkinAt: coerceDate(raw.checkin_at) || new Date().toISOString(),
        aiRiskLevel: coerceString(raw.ai_risk_level),
        recommendation: raw.recommendation ? {
            summary: coerceString(raw.recommendation.summary) || "",
            riskLevel: coerceString(raw.recommendation.risk_level || raw.recommendation.riskLevel) || "low",
            steps: Array.isArray(raw.recommendation.steps) ? raw.recommendation.steps.map((s) => ({
                title: coerceString(s.title) || "",
                description: coerceString(s.description) || "",
                timeframe: coerceString(s.timeframe),
                caution: coerceString(s.caution)
            })) : [],
            whenToSeekHelp: Array.isArray(raw.recommendation.when_to_seek_help || raw.recommendation.whenToSeekHelp) ? (raw.recommendation.when_to_seek_help || raw.recommendation.whenToSeekHelp)!.map((h) => ({
                trigger: coerceString(h.trigger) || "",
                description: coerceString(h.description) || ""
            })) : []
        } : null,
        vitals: vitals ? {
            bpSystolic: Number(vitals.bp_systolic ?? vitals.bpSystolic) || undefined,
            bpDiastolic: Number(vitals.bp_diastolic ?? vitals.bpDiastolic) || undefined,
            heartRate: Number(vitals.heart_rate ?? vitals.heartRate) || undefined,
            temperature: Number(vitals.temperature) || undefined,
            oxygenLevel: Number(vitals.oxygen_level ?? vitals.oxygenLevel) || undefined
        } : null
    };
};

export const mapSelfCareAlert = (payload: unknown): SelfCareAlert | null => {
    const raw = toObject(payload) as RawSelfCarePayload;
    const id = coerceId(raw.id);
    if (!id) return null;

    return {
        id,
        profileId: coerceId(raw.profile_id),
        alertType: coerceString(raw.alert_type) || "manual",
        severity: raw.severity || "medium",
        message: coerceString(raw.message) || "",
        status: raw.status || "pending",
        resolvedAt: coerceDate(raw.resolved_at),
        resolvedBy: coerceId(raw.resolved_by),
        createdAt: coerceDate(raw.created_at) || new Date().toISOString()
    };
};
