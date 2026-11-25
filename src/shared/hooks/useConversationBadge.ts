import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { messagingKeys, useUnreadMessageCount } from "./useMessaging";
import { useSocket } from "./useSocket";
import { useAuth } from "./useAuth";

const CHAT_EVENTS = ["message.created", "model.message.created", "booking.chat.message", "model.booking.chat.message"];

/**
 * The unread count on the Inbox entry. The number comes from the server (messages from other people not yet read), so it
 * survives a reload and counts what arrived while the app was closed. A live message event only asks for a fresh count;
 * it never adds one by itself, so a message seen in an open conversation, or announced twice, cannot inflate it.
 */
export const useConversationBadge = () => {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const query = useUnreadMessageCount(Boolean(user?.id));

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.unread() }).catch(() => undefined);
    };
    CHAT_EVENTS.forEach((event) => socket.on(event, refresh));
    return () => {
      CHAT_EVENTS.forEach((event) => socket.off(event, refresh));
    };
  }, [queryClient, socket]);

  return { unreadCount: query.data ?? 0, reset: () => void query.refetch() };
};
