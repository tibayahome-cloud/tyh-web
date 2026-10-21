import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/libs/api";

/** Whether the catalogue has any ambulance service a facility offers right now, from the API's own care_type. */
export const useHasAmbulanceService = (): boolean =>
  useQuery({
    queryKey: ["client", "services", "has-ambulance"],
    queryFn: async () => {
      const response = await api.get<{ data: unknown[] }>("/services", {
        params: { "filter[care_type]": "ambulance", "filter[active]": "true", "filter[has_active_offering]": "true", fields: "id" }
      });
      return (response.data?.data ?? []).length > 0;
    },
    staleTime: 5 * 60_000
  }).data === true;
