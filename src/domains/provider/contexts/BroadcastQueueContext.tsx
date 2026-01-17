import { createContext, useContext } from "react";

import type { BroadcastOffer, UseBroadcastQueueReturn } from "../hooks/useBroadcastQueue";

type BroadcastQueueValue = Pick<UseBroadcastQueueReturn, "queue" | "dismiss" | "clear"> & {
  queue: BroadcastOffer[];
};

const BroadcastQueueContext = createContext<BroadcastQueueValue | undefined>(undefined);

export const BroadcastQueueProvider = ({
  value,
  children
}: {
  value: BroadcastQueueValue;
  children: React.ReactNode;
}) => <BroadcastQueueContext.Provider value={value}>{children}</BroadcastQueueContext.Provider>;

export const useBroadcastQueueContext = () => {
  const context = useContext(BroadcastQueueContext);
  if (!context) {
    return {
      queue: [],
      dismiss: () => undefined,
      clear: () => undefined
    };
  }
  return context;
};

export type { BroadcastQueueValue };
