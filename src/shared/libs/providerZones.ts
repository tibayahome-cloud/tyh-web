import api from "./api";
import { toObject, coerceId, coerceString, coerceNumber } from "../schemas/helpers";

export type ProviderZone = {
    id: string;
    name: string;
    description: string | null;
    centerLat: number;
    centerLng: number;
    radiusKm: number;
    isActive: boolean;
    providerCount?: number;
};

export const fetchProviderZones = async (): Promise<ProviderZone[]> => {
    const response = await api.get("/provider-zones");
    const rows = Array.isArray(response.data?.data) ? response.data.data : [];
    return rows.map((row: any) => {
        const raw = toObject(row);
        const attributes = toObject(raw.attributes ?? raw);
        return {
            id: coerceId(raw.id),
            name: coerceString(attributes.name) ?? "Unnamed Zone",
            description: coerceString(attributes.description),
            centerLat: coerceNumber(attributes.center_lat) ?? 0,
            centerLng: coerceNumber(attributes.center_lng) ?? 0,
            radiusKm: coerceNumber(attributes.radius_km) ?? 0,
            isActive: Boolean(attributes.is_active),
            providerCount: coerceNumber(attributes.provider_count)
        };
    });
};

export const createProviderZone = async (input: Partial<ProviderZone>): Promise<ProviderZone> => {
    const response = await api.post("/provider-zones", {
        name: input.name,
        description: input.description,
        center_lat: input.centerLat,
        center_lng: input.centerLng,
        radius_km: input.radiusKm,
        is_active: input.isActive
    });
    return response.data.data;
};

export const updateProviderZone = async (id: string, input: Partial<ProviderZone>): Promise<void> => {
    await api.patch(`/provider-zones/${id}`, {
        name: input.name,
        description: input.description,
        center_lat: input.centerLat,
        center_lng: input.centerLng,
        radius_km: input.radiusKm,
        is_active: input.isActive
    });
};

export const deleteProviderZone = async (id: string): Promise<void> => {
    await api.delete(`/provider-zones/${id}`);
};
