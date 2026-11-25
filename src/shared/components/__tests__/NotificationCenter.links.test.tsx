/**
 * The bell: a notification about a conversation or a booking opens it (and counts as read), and a live notification
 * event for this person refreshes the list while one for someone else does not.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  markRead: vi.fn(),
  handlers: {} as Record<string, (payload?: unknown) => void>
}));

vi.mock("../../libs/notifications", () => ({
  fetchNotifications: (...args: unknown[]) => state.fetch(...args),
  fetchNotificationEventPreferences: vi.fn(),
  markNotificationsRead: (...args: unknown[]) => state.markRead(...args),
  markAllNotificationsRead: vi.fn(),
  updateNotificationPreferences: vi.fn()
}));
vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => ({
    on: (event: string, handler: (payload?: unknown) => void) => {
      state.handlers[event] = handler;
    },
    off: vi.fn(),
    emit: vi.fn()
  })
}));
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("../ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn(), push: vi.fn() }) }));

import { NotificationCenter } from "../NotificationCenter";

const notification = (id: string, data: Record<string, unknown>, title = "New message") => ({
  id,
  title,
  body: "Amina sent you a message.",
  readAt: null,
  deliveredAt: null,
  createdAt: new Date().toISOString(),
  eventName: null,
  data
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NotificationCenter />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );

import { useLocation } from "react-router-dom";
const LocationProbe = () => <span data-testid="where">{useLocation().pathname}</span>;

beforeEach(() => {
  state.fetch.mockReset();
  state.markRead.mockReset().mockResolvedValue({ updated: 1 });
  state.handlers = {};
  state.fetch.mockResolvedValue({
    notifications: [notification("n1", { thread_id: "t-9" })],
    meta: { total: 1, page: 1, size: 10, totalPages: 1, unread: 1 }
  });
});

describe("opening a notification", () => {
  it.each([
    ["/app/home", "/app/inbox/t-9"],
    ["/pro/home", "/pro/inbox/t-9"],
    ["/admin/overview", "/admin/conversations/t-9"]
  ])("from %s goes to %s and marks it read", async (start, target) => {
    renderAt(start);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    fireEvent.click(await screen.findByRole("button", { name: "Open: New message" }));

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(target));
    expect(state.markRead).toHaveBeenCalledWith(["n1"]);
  });

  it("offers no Open for a notification about nothing the person can open", async () => {
    state.fetch.mockResolvedValue({
      notifications: [notification("n2", {}, "Welcome")],
      meta: { total: 1, page: 1, size: 10, totalPages: 1, unread: 1 }
    });
    renderAt("/app/home");
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    await screen.findByText("Welcome");
    expect(screen.queryByRole("button", { name: /^Open:/ })).not.toBeInTheDocument();
  });
});

describe("live updates", () => {
  it("fetches the list again when a notification is created for this person", async () => {
    renderAt("/app/home");
    await waitFor(() => expect(state.fetch).toHaveBeenCalledTimes(1));

    state.handlers["notification.created"]({ user_id: "me", notification_id: "n3" });

    await waitFor(() => expect(state.fetch).toHaveBeenCalledTimes(2));
  });

  it("ignores an event that names someone else", async () => {
    renderAt("/app/home");
    await waitFor(() => expect(state.fetch).toHaveBeenCalledTimes(1));

    state.handlers["notification.created"]({ user_id: "someone-else", notification_id: "n4" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
});
