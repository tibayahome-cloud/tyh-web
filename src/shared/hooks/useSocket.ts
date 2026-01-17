import type { AppSocket } from "../libs/socket";
import { useSocketContext } from "../../app/providers/SocketProvider";

export const useSocket = (): AppSocket => {
  const socket = useSocketContext();
  return socket;
};
