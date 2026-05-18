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
    user?: UserResource | null;
    checkedAt?: string; // For compatibility
}

export interface SelfCareCheckinInput {
    mood: string;
    note?: string;
    symptoms?: string[];
    checkedAt?: string;
    vitals?: {
        bpSystolic?: number;
        bpDiastolic?: number;
        heartRate?: number;
        temperature?: number;
        spo2?: number;
    };
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
    riskLevel?: string;
    reason?: string;
    client?: UserResource | null;
    clientUserId?: string;
    recommendation?: {
        summary: string;
        steps: Array<{ title: string; description: string }>;
    } | null;
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
    checked_at?: string;
    alert_type?: string;
    severity?: "low" | "medium" | "high" | "critical";
    message?: string;
    status?: "pending" | "acknowledged" | "resolved";
    resolved_at?: string;
    resolved_by?: string;
    risk_level?: string;
    riskLevel?: string;
    reason?: string;
    client?: unknown;
    client_user_id?: string;
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

    const vitalsRaw = raw.vitals;
    const recommendationRaw = raw.recommendation;

    return {
        id,
        profileId: coerceId(raw.profile_id),
        mood: coerceString(raw.mood) || "neutral",
        energyLevel: Number(raw.energy_level) || 5,
        sleepHours: raw.sleep_hours != null ? Number(raw.sleep_hours) : null,
        waterIntakeLens: raw.water_intake_lens != null ? Number(raw.water_intake_lens) : null,
        notes: coerceString(raw.notes),
        checkinAt: coerceDate(raw.checkin_at) || new Date().toISOString(),
        checkedAt: coerceDate(raw.checkin_at || raw.checked_at) || new Date().toISOString(),
        aiRiskLevel: coerceString(raw.ai_risk_level),
        user: raw.user ? mapUserResource(raw.user) : null,
        recommendation: recommendationRaw ? {
            summary: coerceString(recommendationRaw.summary) || "",
            riskLevel: coerceString(recommendationRaw.risk_level || recommendationRaw.riskLevel) || "low",
            steps: Array.isArray(recommendationRaw.steps) ? recommendationRaw.steps.map((s) => ({
                title: coerceString(s.title) || "",
                description: coerceString(s.description) || "",
                timeframe: coerceString(s.timeframe),
                caution: coerceString(s.caution)
            })) : [],
            whenToSeekHelp: Array.isArray(recommendationRaw.when_to_seek_help || recommendationRaw.whenToSeekHelp) ? (recommendationRaw.when_to_seek_help || recommendationRaw.whenToSeekHelp)!.map((h) => ({
                trigger: coerceString(h.trigger) || "",
                description: coerceString(h.description) || ""
            })) : []
        } : null,
        vitals: vitalsRaw ? {
            bpSystolic: Number(vitalsRaw.bp_systolic ?? vitalsRaw.bpSystolic) || undefined,
            bpDiastolic: Number(vitalsRaw.bp_diastolic ?? vitalsRaw.bpDiastolic) || undefined,
            heartRate: Number(vitalsRaw.heart_rate ?? vitalsRaw.heartRate) || undefined,
            temperature: Number(vitalsRaw.temperature) || undefined,
            oxygenLevel: Number(vitalsRaw.oxygen_level ?? vitalsRaw.oxygenLevel) || undefined
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
        riskLevel: coerceString(raw.risk_level || raw.riskLevel) || "moderate",
        reason: coerceString(raw.reason),
        client: raw.client ? mapUserResource(raw.client) : null,
        clientUserId: coerceId(raw.client_user_id || raw.user_id),
        recommendation: raw.recommendation ? {
            summary: coerceString(raw.recommendation.summary) || "",
            steps: Array.isArray(raw.recommendation.steps) ? raw.recommendation.steps.map(s => ({
                title: coerceString(s.title) || "",
                description: coerceString(s.description) || ""
            })) : []
        } : null,
        createdAt: coerceDate(raw.created_at) || new Date().toISOString()
    } as SelfCareAlert;
};

export interface SelfCareProfileUpdateInput {
    id?: string;
    userId?: string;
    status?: string;
    consentAi?: boolean;
    consentDataSharing?: boolean;
    primaryGoals?: string;
    currentConditions?: string[];
    medications?: string[];
    riskFactors?: string[];
    preferences?: {
        notification_channel: string;
        quiet_hours: string;
        reminder_frequency?: string;
    };
    primaryProviderUserId?: string;
}

export interface SelfCareAlertFilters {
    status?: string;
    riskLevel?: string;
    clientId?: string;
    limit?: number;
}
