import { create } from "zustand";

type ConversationStoreState = {
  unreadCount: number;
  increment: () => void;
  reset: () => void;
};

export const useConversationStore = create<ConversationStoreState>((set) => ({
  unreadCount: 0,
  increment: () =>
    set((state) => ({
      unreadCount: Math.min(state.unreadCount + 1, 999)
    })),
  reset: () =>
    set(() => ({
      unreadCount: 0
    }))
}));
