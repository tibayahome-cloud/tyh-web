import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

export type AppSocket = Socket | null;

const socketUrl = import.meta.env.VITE_SOCKET_URL;

export const createSocket = (token?: string): AppSocket => {
  if (!socketUrl) {
    return null;
  }
  const url = token ? `${socketUrl}?token=${encodeURIComponent(token)}` : socketUrl;
  const socket = io(url, {
    autoConnect: false
  });
  return socket;
};
