/**
 * The Inbox for providers and clients: one header with the unread count, a searchable list, a visible New message
 * button, helpful empty states, and a new-conversation sheet that names people, services and days instead of ids.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  threads: [] as unknown[],
  bookings: [] as unknown[],
  create: vi.fn()
}));

vi.mock("../../../hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("../../../hooks/useSocket", () => ({ useSocket: () => null }));
vi.mock("../../../hooks/useBookings", () => ({
  useBookingList: () => ({ data: { bookings: state.bookings }, isLoading: false })
}));
vi.mock("../../../hooks/useMessaging", () => ({
  messagingKeys: { messages: () => ["m"], threads: () => ["t"] },
  useThreads: () => ({
    data: { pages: [{ data: state.threads }] },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn()
  }),
  useThreadMessages: () => ({ data: { pages: [{ data: [] }] }, isLoading: false, hasNextPage: false, fetchNextPage: vi.fn() }),
  useSendMessage: () => ({ mutate: vi.fn() }),
  useCreateThread: () => ({ mutateAsync: state.create, isPending: false })
}));
vi.mock("../../ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import { InboxPage } from "../InboxPage";

const thread = (id: string, name: string, body: string, unread = 0) => ({
  id,
  title: null,
  participants: [{ userId: "me" }, { userId: `u-${id}`, user: { fullName: name } }],
  messages: [{ body, createdAt: new Date().toISOString(), senderUserId: `u-${id}`, deliveryStatus: "delivered" }],
  unreadCount: unread
});

const renderInbox = (path = "/pro/inbox", role: "provider" | "client" = "provider") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={new QueryClient()}>
        <Routes>
          <Route path="/pro/inbox/:threadId?" element={<InboxPage role={role} basePath="/pro/inbox" />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  state.threads = [];
  state.bookings = [];
  state.create.mockReset();
});

describe("Inbox header", () => {
  it("has one title, the unread count, and a visible New message button", () => {
    state.threads = [thread("t1", "Amina Client", "Hello", 2), thread("t2", "John Doe", "Thanks", 1)];
    renderInbox();

    expect(screen.getAllByRole("heading", { name: "Inbox" })).toHaveLength(1);
    expect(screen.getByText("3 unread")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New message" })).toBeVisible();
  });

  it("says you are up to date when nothing is unread", () => {
    state.threads = [thread("t1", "Amina Client", "Hello")];
    renderInbox();

    expect(screen.getByText("You are up to date")).toBeInTheDocument();
  });
});

describe("Inbox list", () => {
  it("shows each conversation with a name and the last message, and marks the open one", () => {
    state.threads = [thread("t1", "Amina Client", "See you at 3"), thread("t2", "John Doe", "Thanks")];
    renderInbox("/pro/inbox/t1");

    const list = screen.getByRole("list", { name: "Conversations" });
    expect(within(list).getByText("See you at 3")).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: /Amina Client/ })).toHaveAttribute("aria-current", "true");
    expect(within(list).getByRole("button", { name: /John Doe/ })).not.toHaveAttribute("aria-current");
  });

  it("filters by name or message from the search box", () => {
    state.threads = [thread("t1", "Amina Client", "See you at 3"), thread("t2", "John Doe", "Thanks")];
    renderInbox();

    fireEvent.change(screen.getByLabelText("Search conversations"), { target: { value: "john" } });

    const list = screen.getByRole("list", { name: "Conversations" });
    expect(within(list).queryByText("Amina Client")).not.toBeInTheDocument();
    expect(within(list).getByText("John Doe")).toBeInTheDocument();
  });

  it("tells a provider with no conversations what appears here and offers the one action", () => {
    renderInbox();

    expect(screen.getByText(/Messages from clients with a booking appear here/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New message" }).length).toBeGreaterThan(0);
  });

  it("says when a search finds nothing", () => {
    state.threads = [thread("t1", "Amina Client", "Hi")];
    renderInbox();

    fireEvent.change(screen.getByLabelText("Search conversations"), { target: { value: "zzz" } });

    expect(screen.getByText(/No conversation matches/)).toBeInTheDocument();
  });
});

describe("Inbox thread", () => {
  it("offers a way back to the list on a phone", () => {
    state.threads = [thread("t1", "Amina Client", "Hi")];
    renderInbox("/pro/inbox/t1");

    expect(screen.getByRole("button", { name: "Back to conversations" })).toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
  });
});

describe("New message", () => {
  const bookings = [
    {
      id: "9255e426-1111-2222-3333-444444444444",
      scheduledAt: "2026-10-21T08:00:00Z",
      service: { name: "Wound dressing" },
      client: { id: "c1", fullName: "Amina Client" }
    }
  ];

  it("lists people with their service and day, never a booking id", () => {
    state.bookings = bookings;
    renderInbox();

    fireEvent.click(screen.getAllByRole("button", { name: "New message" })[0]);

    expect(screen.getByText("Amina Client")).toBeInTheDocument();
    expect(screen.getByText("Wound dressing, 21 Oct")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/9255e426|Booking: #/);
  });

  it("starts the conversation for the chosen booking", async () => {
    state.bookings = bookings;
    state.create.mockResolvedValue({ id: "new-thread" });
    renderInbox();
    fireEvent.click(screen.getAllByRole("button", { name: "New message" })[0]);

    expect(screen.getByRole("button", { name: "Start conversation" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Amina Client/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));

    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ scope: "booking", bookingId: bookings[0].id }));
  });

  it("explains when there is nobody to message yet", () => {
    renderInbox();
    fireEvent.click(screen.getAllByRole("button", { name: "New message" })[0]);

    expect(screen.getByText(/You have no bookings with clients yet/)).toBeInTheDocument();
  });
});
