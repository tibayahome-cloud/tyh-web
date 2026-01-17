import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchThreads,
  fetchThreadMessages,
  postThreadMessage,
  createThread,
  fetchSupportContacts
} from "../libs/messaging";
import type { CreateThreadInput, SupportContactsResponse } from "../libs/messaging";

export const messagingKeys = {
  all: ["messaging"] as const,
  threads: () => ["messaging", "threads"] as const,
  messages: (threadId: string) => ["messaging", "threads", threadId, "messages"] as const,
  supportContacts: (scope: string) => ["messaging", "support", "contacts", scope] as const
};

export const useThreads = () => {
  return useQuery({
    queryKey: messagingKeys.threads(),
    queryFn: fetchThreads
  });
};

export const useThreadMessages = (threadId: string | null) => {
  return useQuery({
    queryKey: threadId ? messagingKeys.messages(threadId) : ["messaging", "threads", "unknown", "messages"],
    queryFn: () => {
      if (!threadId) {
        return Promise.reject(new Error("threadId required"));
      }
      return fetchThreadMessages(threadId);
    },
    enabled: Boolean(threadId)
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, body }: { threadId: string; body: string }) => postThreadMessage(threadId, body),
    onSuccess: (message) => {
      if (message?.threadId) {
        queryClient.invalidateQueries({ queryKey: messagingKeys.messages(message.threadId) }).catch(() => undefined);
      }
      queryClient.invalidateQueries({ queryKey: messagingKeys.threads() }).catch(() => undefined);
    }
  });
};

export const useCreateThread = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateThreadInput) => createThread(input),
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.threads() }).catch(() => undefined);
      if (thread?.id) {
        queryClient.invalidateQueries({ queryKey: messagingKeys.messages(thread.id) }).catch(() => undefined);
      }
    }
  });
};

export const useSupportContacts = (scope: "client_support" | "provider_support") => {
  return useQuery<SupportContactsResponse>({
    queryKey: messagingKeys.supportContacts(scope),
    queryFn: () => fetchSupportContacts(scope),
    staleTime: 5 * 60 * 1000
  });
};
