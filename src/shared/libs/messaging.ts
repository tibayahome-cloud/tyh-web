import api from "./api";
import { threadListPreset, messagePreset } from "./fieldInclude";
import { buildFieldParams } from "./fieldInclude";
import { mapThread, mapThreads, mapMessage } from "../schemas/messaging";
import type { Thread, Message } from "../schemas/messaging";

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    next_cursor: string | null;
    has_more: boolean;
    size: number;
  };
};

export const fetchThreads = async (cursor?: string): Promise<PaginatedResponse<Thread>> => {
  const response = await api.get("/messaging/threads", {
    params: {
      ...buildFieldParams(threadListPreset),
      "page[size]": 20,
      "page[after]": cursor
    }
  });
  const data = response.data?.data;
  const meta = response.data?.meta || {};
  return {
    data: mapThreads(data),
    meta: {
      next_cursor: meta.next_cursor || null,
      has_more: !!meta.has_more,
      size: meta.size || 20
    }
  };
};

export const fetchThreadMessages = async (threadId: string, cursor?: string): Promise<PaginatedResponse<Message>> => {
  const response = await api.get(`/messaging/threads/${threadId}/messages`, {
    params: {
      ...buildFieldParams(messagePreset),
      "page[size]": 50,
      "page[after]": cursor
    }
  });
  const data = response.data?.data;
  const meta = response.data?.meta || {};
  const messages = Array.isArray(data)
    ? data.map((entry) => mapMessage(entry)).filter((entry): entry is Message => Boolean(entry))
    : [];

  return {
    data: messages,
    meta: {
      next_cursor: meta.next_cursor || null,
      has_more: !!meta.has_more,
      size: meta.size || 50
    }
  };
};

export const postThreadMessage = async (threadId: string, body: string) => {
  const response = await api.post(
    `/messaging/threads/${threadId}/messages`,
    { kind: "text", body },
    { params: buildFieldParams(messagePreset) }
  );
  return mapMessage(response.data?.data);
};

export type CreateThreadInput = {
  scope: "booking" | "provider_support" | "admin" | "client_support";
  bookingId?: string;
  title?: string;
  participants?: { userId: string; roleHint?: string }[];
};

export const createThread = async (input: CreateThreadInput): Promise<Thread> => {
  const response = await api.post(
    "/messaging/threads",
    {
      scope: input.scope,
      booking_id: input.bookingId,
      title: input.title,
      participants: input.participants?.map((participant) => ({
        user_id: participant.userId,
        role_hint: participant.roleHint
      }))
    },
    {
      params: buildFieldParams(threadListPreset)
    }
  );
  const thread = mapThread(response.data?.data);
  if (!thread) {
    throw new Error("Failed to create thread");
  }
  return thread;
};

export type SupportContact = {
  id: string;
  name: string;
  role: "admin" | "provider" | "client";
};

export type SupportContactsResponse = {
  admins: SupportContact[];
  matches: SupportContact[];
};

const normalizeContacts = (items: unknown[], defaultRole: SupportContact["role"]) => {
  const results: SupportContact[] = [];
  if (!Array.isArray(items)) {
    return results;
  }
  items.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const record = item as Record<string, unknown>;
    const rawId = record.id ?? record.user_id;
    if (rawId === null || rawId === undefined) {
      return;
    }
    const id = typeof rawId === "string" ? rawId : String(rawId);
    if (!id) {
      return;
    }
    const nameRaw = record.name ?? record.full_name ?? record.email;
    const name = typeof nameRaw === "string" && nameRaw.trim().length > 0 ? nameRaw : "Contact";
    results.push({ id, name, role: defaultRole });
  });
  return results;
};

const normalizeMatches = (items: unknown[]) => {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const rawId = record.id ?? record.user_id;
      if (rawId === null || rawId === undefined) {
        return null;
      }
      const id = typeof rawId === "string" ? rawId : String(rawId);
      if (!id) {
        return null;
      }
      const roleValue = record.role === "client" ? "client" : "provider";
      const nameRaw = record.name ?? record.full_name ?? record.email;
      const name = typeof nameRaw === "string" && nameRaw.trim().length > 0 ? nameRaw : "Contact";
      return { id, name, role: roleValue as SupportContact["role"] };
    })
    .filter((entry): entry is SupportContact => Boolean(entry));
};

export const fetchSupportContacts = async (
  scope: "client_support" | "provider_support"
): Promise<SupportContactsResponse> => {
  const response = await api.get("/messaging/support/contacts", {
    params: { scope }
  });
  const data = response.data?.data ?? { admins: [], matches: [] };
  const admins = normalizeContacts(data.admins ?? [], "admin");
  const matches = normalizeMatches(data.matches ?? []);
  return { admins, matches };
};
