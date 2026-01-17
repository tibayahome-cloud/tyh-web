import { useEffect } from "react";

import { useSocket } from "../../shared/hooks/useSocket";
import { useAuth } from "../../shared/hooks/useAuth";

const SESSION_EVENTS = ["session.expired", "session.revoked"] as const;

export const SessionEventBridge = () => {
  const socket = useSocket();
  const { expireSession } = useAuth();

  useEffect(() => {
    if (!socket) {
      return;
    }
    const handler = () => {
      expireSession();
    };
    for (const event of SESSION_EVENTS) {
      socket.on(event, handler);
    }
    return () => {
      for (const event of SESSION_EVENTS) {
        socket.off(event, handler);
      }
    };
  }, [socket, expireSession]);

  return null;
};
