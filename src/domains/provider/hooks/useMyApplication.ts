import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { api } from "../../../shared/libs/api";
import { buildFieldParams, provApp } from "../../../shared/libs/fieldInclude";

export type ApplicationItem = {
  id: string;
  status: string;
  value_text?: string | null;
  file_url?: string | null;
  download_url?: string | null;
  comment?: string | null;
  expires_on?: string | null;
  requirement_type?: {
    id: string;
    key?: string;
    label: string;
    input_type: "file" | "image" | "text";
    display_order?: number | null;
    required_for_verification?: boolean;
    has_expiry?: boolean;
    editable_after_submission?: boolean;
  };
};

export type Application = { id: string; status: string; items?: ApplicationItem[] };

export const applicationKey = ["provider", "application"] as const;

/** The signed-in provider's application and its documents. A provider with no application gets null, not an error. */
export const useMyApplication = () =>
  useQuery({
    queryKey: applicationKey,
    queryFn: async () => {
      try {
        const response = await api.get<{ data: Application }>("/provider-applications/me", { params: buildFieldParams(provApp) });
        return response.data.data;
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) return null;
        throw error;
      }
    },
    refetchOnWindowFocus: false
  });
