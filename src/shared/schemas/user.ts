import { z } from "zod";
import { coerceId, coerceString, toObject } from "./helpers";

export interface AuthUser {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    email: string | null;
    phone: string | null;
    phoneVerifiedAt: string | null;
    roles: string[];
    permissions: string[];
    meta?: Record<string, unknown> | null;
    status?: string;
}

export type UserResource = AuthUser;

export const userResourceSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    attributes: z.record(z.unknown()).optional().nullable()
}).passthrough();

export const mapUserResource = (payload: unknown): AuthUser | null => {
    const base = toObject(payload);
    const attributes = toObject(base.attributes);
    const raw = { ...base, ...attributes };
    const id = coerceId(base.id) || coerceId(raw.id);
    if (!id) return null;
    const metaRaw = raw.meta_data ?? raw.meta;
    const meta =
        metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)
            ? (metaRaw as Record<string, unknown>)
            : null;

    const roles = Array.isArray(raw.roles)
        ? raw.roles.map((role) => {
            const roleRaw = toObject(role);
            return typeof role === "string" ? role : coerceString(roleRaw.key) || coerceString(roleRaw.name);
        })
        : [];

    return {
        id,
        fullName: coerceString(raw.full_name) || coerceString(raw.fullName) || "",
        avatarUrl: coerceString(raw.avatar_url) || coerceString(raw.avatarUrl),
        email: coerceString(raw.email),
        phone: coerceString(raw.phone),
        phoneVerifiedAt: coerceString(raw.phone_verified_at) || coerceString(raw.phoneVerifiedAt) || null,
        roles: roles.filter(Boolean),
        permissions: Array.isArray(raw.permissions) ? raw.permissions.filter((permission): permission is string => typeof permission === "string") : [],
        meta,
        status: coerceString(raw.status) || undefined
    };
};
