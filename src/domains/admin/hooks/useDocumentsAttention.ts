import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/libs/api";

export type DocumentsAttention = {
  providers_waiting: number;
  facilities_waiting: number;
  facility_sent_back: number;
  total: number;
};

export const documentsAttentionKey = ["admin", "document-review", "attention"] as const;

const NOTHING: DocumentsAttention = { providers_waiting: 0, facilities_waiting: 0, facility_sent_back: 0, total: 0 };

/** How many documents need the signed-in admin, for the menu badge and the tab counts. A failure just shows no count. */
export const useDocumentsAttention = () =>
  useQuery({
    queryKey: documentsAttentionKey,
    queryFn: async (): Promise<DocumentsAttention> => {
      try {
        const response = await api.get<{ data: DocumentsAttention }>("/documents/attention");
        return { ...NOTHING, ...response.data.data };
      } catch {
        return NOTHING;
      }
    },
    refetchInterval: 60_000,
    staleTime: 30_000
  });
