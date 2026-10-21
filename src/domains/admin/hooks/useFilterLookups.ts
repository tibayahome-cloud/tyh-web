import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/libs/api";
import type { PickedEntity } from "../components/EntityPicker";

type UserRow = { id: string; full_name: string; phone: string | null; email: string | null };
type ServiceRow = { id: string; name: string };

const useUserLookup = (role: "client" | "provider", enabled: boolean) => {
  const [text, setText] = useState("");
  const query = useQuery({
    queryKey: ["admin", "lookup", role, text],
    queryFn: async () => {
      const res = await api.get<{ data: UserRow[] }>("/users", {
        params: { "filter[search]": text, "filter[role]": role, "page[size]": 10 }
      });
      return res.data.data.map<PickedEntity>((row) => ({
        id: row.id,
        label: row.full_name,
        hint: row.phone ?? row.email ?? undefined
      }));
    },
    enabled: enabled && text.trim().length >= 2
  });
  return { options: query.data ?? [], loading: query.isFetching, search: setText };
};

/** Name-based lookups behind the booking filters, fetched only while the filters are open. */
export const useFilterLookups = (open: boolean) => {
  const clients = useUserLookup("client", open);
  const providers = useUserLookup("provider", open);
  const servicesQuery = useQuery({
    queryKey: ["admin", "services", "active"],
    queryFn: async () => {
      const res = await api.get<{ data: ServiceRow[] }>("/services", { params: { "filter[active]": "true" } });
      return res.data.data.map<PickedEntity>((row) => ({ id: row.id, label: row.name }));
    },
    enabled: open
  });
  return {
    clients,
    providers,
    services: { options: servicesQuery.data ?? [], loading: servicesQuery.isFetching }
  };
};
