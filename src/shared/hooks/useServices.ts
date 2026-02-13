
import { useQuery } from "@tanstack/react-query";
import { api } from "../libs/api";
import { buildFieldParams, servicePublic } from "../libs/fieldInclude";

export interface Service {
    id: string;
    key: string;
    name: string;
    description: string;
    base_price_cents: number;
    default_estimate_minutes: number;
    is_emergency_capable: boolean;
    active: boolean;
    category?: {
        id: string;
        name: string;
        key: string;
    };
}

export const useServices = (filters?: { active?: boolean; emergency?: boolean }) => {
    return useQuery({
        queryKey: ["services", filters],
        queryFn: async () => {
            const params = {
                ...buildFieldParams(servicePublic),
                ...(filters?.active !== undefined && { "filter[active]": filters.active }),
                ...(filters?.emergency !== undefined && { "filter[emergency]": filters.emergency }),
            };

            const response = await api.get("/services", { params });
            return response.data.data as Service[];
        },
    });
};
