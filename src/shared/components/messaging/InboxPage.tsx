import classNames from "classnames";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageSquare, Plus, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppLayout } from "../AppLayout";
import { Button } from "../Button";
import { Loading } from "../Loading";
import { Modal } from "../Modal";
import { PersonPicker, type PickerPerson } from "./PersonPicker";
import { useToast } from "../ToastProvider";
import { useAuth } from "../../hooks/useAuth";
import { useBookingList } from "../../hooks/useBookings";
import { useSocket } from "../../hooks/useSocket";
import { messagingKeys, useCreateThread, useMarkThreadRead, useSendMessage, useThreadMessages, useThreads } from "../../hooks/useMessaging";
import { conversationOptions } from "../../utils/inboxOptions";
import { ConversationList, type Conversation } from "./ConversationList";
import { MessageThread, type Message } from "./MessageThread";

type Role = "provider" | "client";

type Props = {
  role: Role;
  /** Where this inbox lives, e.g. "/pro/inbox"; a conversation is opened at `${basePath}/${id}`. */
  basePath: string;
};

const COPY: Record<Role, { other: string; otherLower: string; emptyList: string; supportScope: "provider_support" | "client_support"; support: string }> = {
  provider: {
    other: "client",
    otherLower: "clients",
    emptyList: "Messages from clients with a booking appear here. Start one from a booking.",
    supportScope: "provider_support",
    support: "Support"
  },
  client: {
    other: "provider",
    otherLower: "providers",
    emptyList: "Messages with your providers appear here. Start one once you have a booking.",
    supportScope: "client_support",
    support: "Support"
  }
};

/**
 * Messages, for providers and clients alike: one header, a searchable list of conversations, and the thread beside it
 * (or on its own screen on a phone). A conversation belongs to a booking and is started by choosing the person, the
 * service and the date, never an id.
 */
export const InboxPage = ({ role, basePath }: Props) => {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const copy = COPY[role];
  const otherRole = role === "provider" ? "client" : "provider";

  const threadsQuery = useThreads();
  const messagesQuery = useThreadMessages(threadId || null);
  const sendMutation = useSendMessage();
  const createThreadMutation = useCreateThread();
  const markRead = useMarkThreadRead();

  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [target, setTarget] = useState<"person" | "support">("person");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [supportSubject, setSupportSubject] = useState("");

  const bookings = useBookingList(
    role === "provider"
      ? { providerId: user?.id ?? undefined, pageSize: 50, preset: "card" }
      : { clientId: user?.id ?? undefined, pageSize: 50, preset: "card" },
    { enabled: Boolean(user?.id) && composerOpen }
  );
  const options = useMemo(
    () => conversationOptions((bookings.data?.bookings ?? []) as never[], otherRole),
    [bookings.data?.bookings, otherRole]
  );

  // Opening a conversation reads it: the server clears its unread count and its bell item.
  const markReadMutate = markRead.mutate;
  useEffect(() => {
    if (threadId) markReadMutate(threadId);
  }, [threadId, markReadMutate]);

  useEffect(() => {
    if (!socket || !threadId) return;
    const room = `thread:${threadId}`;
    socket.emit?.("join_room", { room });
    const onMessage = (payload: { thread_id?: string }) => {
      if (payload?.thread_id === threadId) {
        queryClient.invalidateQueries({ queryKey: messagingKeys.messages(threadId) }).catch(() => undefined);
        // A message that arrives while the conversation is open is read as it arrives.
        markReadMutate(threadId);
      }
      queryClient.invalidateQueries({ queryKey: messagingKeys.threads() }).catch(() => undefined);
    };
    socket.on("message.created", onMessage);
    return () => {
      socket.emit?.("leave_room", { room });
      socket.off("message.created", onMessage);
    };
  }, [socket, threadId, queryClient, markReadMutate]);

  const threads: Conversation[] = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (threadsQuery.data?.pages.flatMap((page: any) => page.data) ?? []).map((t: any) => {
        const other = t.participants.find((p: { userId: string }) => p.userId !== user?.id);
        return {
          id: t.id,
          title: t.title || other?.user?.fullName || other?.user?.email || "Conversation",
          lastMessage: t.messages[0]
            ? {
                body: t.messages[0].body || "",
                created_at: t.messages[0].createdAt || t.lastMessageAt || "",
                sender_id: t.messages[0].senderUserId || "",
                delivery_status: t.messages[0].deliveryStatus
              }
            : undefined,
          unreadCount: t.unreadCount || 0,
          avatarUrl: other?.user?.avatarUrl
        };
      }),
    [threadsQuery.data, user?.id]
  );

  // The newest conversation with each person, so someone already talked to opens that conversation.
  const threadByPerson = useMemo(() => {
    const map = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const page of threadsQuery.data?.pages ?? []) for (const t of (page as any).data ?? []) {
      for (const participant of t.participants ?? []) {
        if (participant.userId && participant.userId !== user?.id && !map.has(participant.userId)) map.set(participant.userId, t.id);
      }
    }
    return map;
  }, [threadsQuery.data, user?.id]);

  const people: PickerPerson[] = useMemo(() => {
    const rows = options.map((option) => ({
      id: option.personId,
      name: option.name,
      detail: `Last: ${option.service}${option.when ? `, ${option.when}` : ""}${option.count > 1 ? ` · ${option.count} bookings together` : ""}`,
      note: threadByPerson.has(option.personId) ? "Continue conversation" : undefined
    }));
    // People already talked to first, then the rest, each group newest first.
    return [...rows.filter((row) => row.note), ...rows.filter((row) => !row.note)];
  }, [options, threadByPerson]);
  const continuing = target === "person" && threadByPerson.has(selectedPersonId);

  const visibleThreads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(needle) || t.lastMessage?.body.toLowerCase().includes(needle));
  }, [threads, query]);

  const unreadTotal = threads.reduce((sum, t) => sum + (t.unreadCount ?? 0), 0);

  const messages: Message[] = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (messagesQuery.data?.pages.flatMap((page: any) => page.data) ?? []).map((m: any) => ({
        id: m.id,
        body: m.body || "",
        created_at: m.createdAt || "",
        isMe: m.senderUserId === user?.id,
        senderName: m.sender?.fullName || undefined,
        delivery_status: m.deliveryStatus
      })),
    [messagesQuery.data, user?.id]
  );

  const selectedThread = threads.find((t) => t.id === threadId);

  const openComposer = () => {
    setTarget("person");
    setSelectedPersonId("");
    setSupportSubject("");
    setComposerOpen(true);
  };

  const startConversation = () => {
    const existing = target === "person" ? threadByPerson.get(selectedPersonId) : undefined;
    if (existing) {
      // Already talking: carry on in that conversation instead of starting another.
      setComposerOpen(false);
      navigate(`${basePath}/${existing}`);
      return;
    }
    const selectedBookingId = options.find((option) => option.personId === selectedPersonId)?.bookingId ?? "";
    const scope = target === "person" ? "booking" : copy.supportScope;
    createThreadMutation
      .mutateAsync({
        scope,
        bookingId: scope === "booking" ? selectedBookingId : undefined,
        title: scope === copy.supportScope ? supportSubject.trim() || undefined : undefined
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((thread: any) => {
        setComposerOpen(false);
        navigate(`${basePath}/${thread.id}`);
      })
      .catch((error: unknown) => {
        toast.showToast({
          title: "Could not start the conversation",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        });
      });
  };

  const noThreads = !threadsQuery.isLoading && threads.length === 0;
  const emptyList = noThreads ? (
    <div className="max-w-xs space-y-3">
      <p className="text-sm text-slate-700">{copy.emptyList}</p>
      <Button type="button" onClick={openComposer}>
        New message
      </Button>
    </div>
  ) : (
    <p className="text-sm text-slate-700">No conversation matches &ldquo;{query}&rdquo;.</p>
  );

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-8 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Inbox</h1>
            <p className="text-sm text-slate-600">
              {unreadTotal > 0 ? `${unreadTotal} unread` : "You are up to date"}
            </p>
          </div>
          <Button type="button" onClick={openComposer} className="min-h-[44px]">
            <Plus aria-hidden="true" size={18} className="mr-1.5" />
            New message
          </Button>
        </div>

        <div className="flex h-[72dvh] min-h-[440px] overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <section
            aria-label="Conversations"
            className={classNames("flex w-full shrink-0 flex-col border-r border-slate-100 lg:w-[360px]", threadId && "hidden lg:flex")}
          >
            <div className="border-b border-slate-100 p-3">
              <label className="relative block">
                <span className="sr-only">Search conversations</span>
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or message"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {threadsQuery.isLoading && threads.length === 0 ? (
                <div className="p-12 text-center"><Loading /></div>
              ) : (
                <ConversationList conversations={visibleThreads} activeId={threadId} onSelect={(id) => navigate(`${basePath}/${id}`)} empty={emptyList} />
              )}
              {threadsQuery.hasNextPage && (
                <button
                  type="button"
                  onClick={() => threadsQuery.fetchNextPage()}
                  className="min-h-[44px] w-full text-sm font-semibold text-slate-700 hover:text-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                >
                  Show older conversations
                </button>
              )}
            </div>
          </section>

          <section aria-label="Conversation" className={classNames("flex min-w-0 flex-1 flex-col bg-slate-50", !threadId && "hidden lg:flex")}>
            {threadId ? (
              <MessageThread
                title={selectedThread?.title || "Conversation"}
                messages={messages}
                onSendMessage={(body) => sendMutation.mutate({ threadId, body })}
                onLoadMore={() => messagesQuery.fetchNextPage()}
                hasMore={messagesQuery.hasNextPage}
                isLoading={messagesQuery.isFetchingNextPage || messagesQuery.isLoading}
                onBack={() => navigate(basePath)}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
                <MessageSquare aria-hidden="true" size={40} className="text-slate-400" />
                <p className="mt-3 max-w-xs text-sm text-slate-700">
                  Choose a conversation from the list, or start a new one with a {copy.other} or support.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal open={composerOpen} onClose={() => setComposerOpen(false)} title="New message" flush>
        <div className="flex max-h-[calc(100dvh-8rem)] sm:max-h-[calc(100dvh-14rem)] flex-col gap-4 pt-1">
          <div role="radiogroup" aria-label="Write to" className="flex shrink-0 rounded-2xl bg-slate-100 p-1">
            {(["person", "support"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={target === value}
                onClick={() => setTarget(value)}
                className={classNames(
                  "min-h-[44px] flex-1 rounded-xl text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue",
                  target === value ? "bg-white text-tiba-blue shadow-sm ring-1 ring-tiba-blue/30" : "text-slate-700"
                )}
              >
                {value === "person" ? (role === "provider" ? "A client" : "A provider") : copy.support}
              </button>
            ))}
          </div>

          {target === "person" ? (
            bookings.isLoading ? (
              <Loading />
            ) : people.length > 0 ? (
              <PersonPicker
                people={people}
                selectedId={selectedPersonId}
                onSelect={setSelectedPersonId}
                helper="People you have a booking with."
                noun={copy.otherLower}
                groupName="conversation-person"
              />
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                You have no bookings with {copy.otherLower} yet. Once you do, you can message them from here.
              </p>
            )
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-slate-800">What do you need help with?</span>
              <input
                value={supportSubject}
                onChange={(event) => setSupportSubject(event.target.value)}
                placeholder="For example, a payment question"
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
              />
            </label>
          )}

          <div className="flex shrink-0 gap-3 border-t border-slate-100 pt-3">
            <Button type="button" variant="ghost" className="min-h-[44px] flex-1" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] flex-1 disabled:bg-slate-200 disabled:text-slate-600"
              loading={createThreadMutation.isPending}
              disabled={target === "person" && !selectedPersonId}
              onClick={startConversation}
            >
              {continuing ? "Open conversation" : "Start conversation"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
};
