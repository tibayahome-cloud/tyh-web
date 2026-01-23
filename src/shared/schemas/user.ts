import { z } from "zod";
import { coerceId, coerceString, toObject } from "./helpers";

export interface AuthUser {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    email: string | null;
    phone: string | null;
    roles: string[];
    permissions: string[];
    meta?: Record<string, any> | null;
    status?: string;
}

export type UserResource = AuthUser;

export const userResourceSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    attributes: z.record(z.any()).optional().nullable()
}).passthrough();

export const mapUserResource = (payload: unknown): AuthUser | null => {
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    if (!id) return null;

    const roles = Array.isArray(raw.roles)
        ? raw.roles.map((r: any) => (typeof r === "string" ? r : r.key || r.name))
        : [];

    return {
        id,
        fullName: coerceString(raw.full_name) || coerceString(raw.fullName) || "",
        avatarUrl: coerceString(raw.avatar_url) || coerceString(raw.avatarUrl),
        email: coerceString(raw.email),
        phone: coerceString(raw.phone),
        roles: roles.filter(Boolean),
        permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
        meta: raw.meta_data || raw.meta || null,
        status: coerceString(raw.status) || undefined
    };
};
