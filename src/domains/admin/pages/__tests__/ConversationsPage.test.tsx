/**
 * The Inbox's search box had no `value`/`onChange` at all -- typing into it did nothing. This
 * covers the filter actually working (by participant name, email, and booking id), the no-match
 * empty state reading differently from a genuinely empty inbox, and a failed threads fetch
 * rendering as a retryable error instead of silently looking like an empty inbox.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Thread } from "../../../../shared/schemas/messaging";

import AdminConversationsPage, { filterThreadsBySearch } from "../ConversationsPage";

const useThreadsMock = vi.fn();

vi.mock("../../../../shared/hooks/useMessaging", () => ({
  useThreads: (...args: unknown[]) => useThreadsMock(...args),
  useThreadMessages: () => ({ data: undefined, isLoading: false, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false }),
  useSendMessage: () => ({ mutate: vi.fn() }),
  useCreateThread: () => ({ mutate: vi.fn() }),
  messagingKeys: { threads: () => ["messaging", "threads"], messages: (id: string) => ["messaging", "threads", id, "messages"] }
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "admin-1" } })
}));

vi.mock("../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
}));

const thread = (overrides: Partial<Thread> = {}): Thread => ({
  id: overrides.id ?? "thread-1",
  scope: "booking",
  bookingId: "booking-abc123",
  status: "open",
  title: null,
  lastMessageAt: "2026-08-01T10:00:00.000Z",
  participants: [
    {
      id: "participant-1",
      userId: "admin-1",
      roleHint: "admin",
      muted: false,
      user: { id: "admin-1", fullName: "Admin User", avatarUrl: null, email: null, phone: null, countryCode: null, roles: [], permissions: [] }
    },
    {
      id: "participant-2",
      userId: "client-1",
      roleHint: "client",
      muted: false,
      user: { id: "client-1", fullName: "Jane Wanjiru", avatarUrl: null, email: "jane@example.test", phone: "+254712345678", countryCode: "KE", roles: [], permissions: [] }
    }
  ],
  messages: [],
  ...overrides
});

describe("filterThreadsBySearch", () => {
  const threads = [
    thread({ id: "t1" }),
    thread({
      id: "t2",
      bookingId: "booking-xyz789",
      participants: [
        {
          id: "p3",
          userId: "provider-1",
          roleHint: "provider",
          muted: false,
          user: { id: "provider-1", fullName: "Dr. Kevin Mwangi", avatarUrl: null, email: "kevin@example.test", phone: null, countryCode: null, roles: [], permissions: [] }
        }
      ]
    })
  ];

  it("returns everything when the search is empty", () => {
    expect(filterThreadsBySearch(threads, "")).toBe(threads);
    expect(filterThreadsBySearch(threads, "   ")).toBe(threads);
  });

  it("matches a participant's name, case-insensitively", () => {
    expect(filterThreadsBySearch(threads, "wanjiru").map((t) => t.id)).toEqual(["t1"]);
    expect(filterThreadsBySearch(threads, "KEVIN").map((t) => t.id)).toEqual(["t2"]);
  });

  it("matches a participant's email or phone", () => {
    expect(filterThreadsBySearch(threads, "jane@example.test").map((t) => t.id)).toEqual(["t1"]);
    expect(filterThreadsBySearch(threads, "254712345678").map((t) => t.id)).toEqual(["t1"]);
  });

  it("matches on the booking id", () => {
    expect(filterThreadsBySearch(threads, "xyz789").map((t) => t.id)).toEqual(["t2"]);
  });

  it("returns nothing for a query matching no thread", () => {
    expect(filterThreadsBySearch(threads, "nonexistent")).toEqual([]);
  });
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <MemoryRouter initialEntries={["/admin/conversations"]}>
      <QueryClientProvider client={queryClient}>
        <AdminConversationsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe("ConversationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters the visible conversation list as the admin types", async () => {
    useThreadsMock.mockReturnValue({
      data: {
        pages: [
          {
            data: [
              thread({ id: "t1" }),
              thread({
                id: "t2",
                title: "Dr. Kevin Mwangi",
                bookingId: "booking-xyz789",
                participants: [
                  {
                    id: "p3",
                    userId: "provider-1",
                    roleHint: "provider",
                    muted: false,
                    user: { id: "provider-1", fullName: "Dr. Kevin Mwangi", avatarUrl: null, email: "kevin@example.test", phone: null, countryCode: null, roles: [], permissions: [] }
                  }
                ]
              })
            ]
          }
        ]
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false
    });

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Dr. Kevin Mwangi")).toBeInTheDocument();
    const search = screen.getByPlaceholderText(/filter by user or booking/i);
    await user.type(search, "wanjiru");

    expect(screen.queryByText("Dr. Kevin Mwangi")).not.toBeInTheDocument();
  });

  it("shows a distinct no-match message rather than the generic empty inbox state", async () => {
    useThreadsMock.mockReturnValue({
      data: { pages: [{ data: [thread({ id: "t1" })] }] },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false
    });

    const user = userEvent.setup();
    renderPage();

    const search = screen.getByPlaceholderText(/filter by user or booking/i);
    await user.type(search, "nobody-matches-this");

    expect(await screen.findByText(/no conversations match "nobody-matches-this"/i)).toBeInTheDocument();
  });

  it("shows a retryable error banner instead of an empty inbox when the threads fetch fails", async () => {
    const refetch = vi.fn();
    useThreadsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error(),
      refetch,
      fetchNextPage: vi.fn(),
      hasNextPage: false
    });

    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load conversations/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });
});
