import { coerceDate, coerceId, coerceString, toObject } from "./helpers";
import { mapUserResource, type UserResource } from "./user";

export type ThreadParticipant = {
  id: string;
  userId: string;
  roleHint: string | null;
  muted: boolean;
  user: UserResource | null;
};

export type Message = {
  id: string;
  threadId: string;
  kind: string;
  body: string | null;
  senderUserId: string | null;
  createdAt: string | null;
  deliveryStatus: string;
  redacted: boolean;
  sender: UserResource | null;
};

export type Thread = {
  id: string;
  scope: string;
  bookingId: string | null;
  status: string;
  title: string | null;
  lastMessageAt: string | null;
  participants: ThreadParticipant[];
  messages: Message[];
};

const mapParticipant = (payload: unknown): ThreadParticipant | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  const userId = coerceId(raw.user_id);
  if (!id || !userId) {
    return null;
  }
  return {
    id,
    userId,
    roleHint: coerceString(raw.role_hint),
    muted: Boolean(raw.muted),
    user: raw.user ? mapUserResource(raw.user) : null
  };
};

export const mapMessage = (payload: unknown): Message | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  return {
    id,
    threadId: coerceId(raw.thread_id) ?? "",
    kind: coerceString(raw.kind) ?? "text",
    body: coerceString(raw.body),
    senderUserId: coerceId(raw.sender_user_id),
    createdAt: coerceDate(raw.created_at),
    deliveryStatus: coerceString(raw.delivery_status) ?? "pending",
    redacted: Boolean(raw.redacted),
    sender: raw.sender ? mapUserResource(raw.sender) : null
  };
};

export const mapThread = (payload: unknown): Thread | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  const participantsRaw = Array.isArray(raw.participants) ? raw.participants : [];
  const messagesRaw = Array.isArray(raw.messages) ? raw.messages : [];
  return {
    id,
    scope: coerceString(raw.scope) ?? "booking",
    bookingId: coerceId(raw.booking_id),
    status: coerceString(raw.status) ?? "open",
    title: coerceString(raw.title),
    lastMessageAt: coerceDate(raw.last_message_at),
    participants: participantsRaw
      .map((entry) => mapParticipant(entry))
      .filter((entry): entry is ThreadParticipant => Boolean(entry)),
    messages: messagesRaw
      .map((entry) => mapMessage(entry))
      .filter((entry): entry is Message => Boolean(entry))
  };
};

export const mapThreads = (payload: unknown): Thread[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((entry) => mapThread(entry))
    .filter((entry): entry is Thread => Boolean(entry));
};
