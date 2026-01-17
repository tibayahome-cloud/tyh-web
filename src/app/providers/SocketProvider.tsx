import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import type { AppSocket } from "../../shared/libs/socket";
import { createSocket } from "../../shared/libs/socket";
import { useAuth } from "../../shared/hooks/useAuth";

type SocketProviderProps = {
  children: ReactNode;
};

const SocketContext = createContext<AppSocket>(null);

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const { accessToken } = useAuth();
  const socketRef = useRef<AppSocket>(null);
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setVersion((v) => v + 1);
      }
      return;
    }

    const socket = createSocket(accessToken);
    if (!socket) {
      socketRef.current = null;
      setVersion((v) => v + 1);
      return;
    }

    socket.connect();
    if (typeof window !== "undefined") {
      socket.on("connect", () => {
      });
      socket.on("disconnect", () => {
      });
      socket.on("connect_error", () => {
      });
    }
    socketRef.current = socket;
    setVersion((v) => v + 1);

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
        setVersion((v) => v + 1);
      }
    };
  }, [accessToken]);

  return <SocketContext.Provider value={socketRef.current}>{children}</SocketContext.Provider>;
};

export const useSocketContext = () => useContext(SocketContext);
