import { useEffect } from "react";

import { useSocket } from "./useSocket";
import { useConversationStore } from "../stores/useConversationStore";
import { useAuth } from "./useAuth";

const CHAT_EVENTS = [
  "booking.chat.message",
  "model.booking.chat.message",
  "message.created",
  "model.message.created"
];

export const useConversationBadge = () => {
  const socket = useSocket();
  const unreadCount = useConversationStore((state) => state.unreadCount);
  const increment = useConversationStore((state) => state.increment);
  const reset = useConversationStore((state) => state.reset);
  const { user } = useAuth();

  useEffect(() => {
    if (!socket) {
      return;
    }
    const handleMessage = (payload: Record<string, unknown> = {}) => {
      const senderId =
        (typeof payload.sender_id === "string" && payload.sender_id) ||
        (typeof payload.user_id === "string" && payload.user_id) ||
        null;
      if (senderId && senderId === user?.id) {
        return;
      }
      increment();
    };
    CHAT_EVENTS.forEach((event) => socket.on(event, handleMessage));
    return () => {
      CHAT_EVENTS.forEach((event) => socket.off(event, handleMessage));
    };
  }, [increment, socket, user?.id]);

  useEffect(() => {
    const handleChatOpen = () => reset();
    window.addEventListener("chat:open", handleChatOpen);
    return () => window.removeEventListener("chat:open", handleChatOpen);
  }, [reset]);

  return { unreadCount, reset };
};
