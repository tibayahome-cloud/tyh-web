/**
 * The Inbox badge shows the server's count. A live message event only asks for a fresh count: it never adds one itself,
 * so a message announced twice, or seen in an open conversation, cannot inflate the number, and a reload keeps it.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ count: vi.fn(), handlers: {} as Record<string, () => void> }));

vi.mock("../../libs/messaging", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../libs/messaging")>()),
  fetchUnreadMessageCount: () => state.count()
}));
vi.mock("../useSocket", () => ({
  useSocket: () => ({
    on: (event: string, handler: () => void) => {
      state.handlers[event] = handler;
    },
    off: vi.fn()
  })
}));
vi.mock("../useAuth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

import { useConversationBadge } from "../useConversationBadge";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  state.count.mockReset();
  state.handlers = {};
});

describe("useConversationBadge", () => {
  it("shows the count the server gives, from the first load", async () => {
    state.count.mockResolvedValue(3);

    const { result } = renderHook(() => useConversationBadge(), { wrapper });

    await waitFor(() => expect(result.current.unreadCount).toBe(3));
  });

  it("asks the server again on a live message, and shows what it says, not one more", async () => {
    state.count.mockResolvedValueOnce(1).mockResolvedValue(1);
    const { result } = renderHook(() => useConversationBadge(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    state.handlers["message.created"]();
    state.handlers["message.created"]();

    await waitFor(() => expect(state.count.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(result.current.unreadCount).toBe(1);
  });

  it("is zero when the server says everything is read", async () => {
    state.count.mockResolvedValue(0);

    const { result } = renderHook(() => useConversationBadge(), { wrapper });

    await waitFor(() => expect(state.count).toHaveBeenCalled());
    expect(result.current.unreadCount).toBe(0);
  });
});
