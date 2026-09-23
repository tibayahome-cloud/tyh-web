/**
 * useNotificationBadge and NotificationCenter used to fetch /notifications under different
 * React Query keys (pageSize 1 vs 10 -- pageSize is part of the cache key), so mounting both on
 * the same screen (they always are: NotificationCenter lives in the persistent shell header,
 * the badge is used inside page-level headers rendered alongside it on client Home and both
 * apps' Inbox pages) fired two separate, redundant requests for what is fundamentally the same
 * unread-count data. This proves they now share one cache entry.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchNotificationsMock = vi.fn();

vi.mock("../../libs/notifications", () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotificationsMock(...args),
  fetchNotificationEventPreferences: vi.fn(),
  markNotificationsRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  updateNotificationPreferences: vi.fn()
}));

vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => null
}));

vi.mock("../ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
}));

import { NotificationCenter } from "../NotificationCenter";
import { useNotificationBadge } from "../../hooks/useNotificationBadge";

const BadgeConsumer = () => {
  const { unread } = useNotificationBadge();
  return <span data-testid="badge-unread">{unread}</span>;
};

const renderBoth = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <NotificationCenter />
        <BadgeConsumer />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe("NotificationCenter / useNotificationBadge request dedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchNotificationsMock.mockResolvedValue({
      notifications: [{ id: "n1", title: "Hi", body: null, readAt: null, deliveredAt: null, createdAt: null, eventName: null }],
      meta: { total: 1, page: 1, size: 10, totalPages: 1, unread: 3 }
    });
  });

  it("mounts NotificationCenter and useNotificationBadge under one query key, issuing a single request", async () => {
    renderBoth();

    await waitFor(() => expect(screen.getByTestId("badge-unread")).toHaveTextContent("3"));

    // Both consumers resolved (the badge shows the shared unread count) from exactly one
    // underlying fetch, not two -- this is the actual assertion: dedup, not just correctness.
    expect(fetchNotificationsMock).toHaveBeenCalledTimes(1);
    expect(fetchNotificationsMock).toHaveBeenCalledWith({ page: 1, pageSize: 10, unreadOnly: false });
  });

  it("still shows the unread badge on the bell icon from the same shared data", async () => {
    renderBoth();

    await waitFor(() => expect(screen.getByLabelText("Notifications")).toHaveTextContent("3"));
    expect(fetchNotificationsMock).toHaveBeenCalledTimes(1);
  });
});
