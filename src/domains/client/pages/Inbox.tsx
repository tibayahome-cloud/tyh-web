import classNames from "classnames";
import { useEffect, useMemo, useRef, useState } from "react";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";

import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useSocket } from "../../../shared/hooks/useSocket";
import {
  useThreads,
  useThreadMessages,
  useSendMessage,
  useCreateThread,
  messagingKeys,
  useSupportContacts
} from "../../../shared/hooks/useMessaging";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../../shared/components/Modal";
import { Input } from "../../../shared/components/Input";
import { useToast } from "../../../shared/components/ToastProvider";
import { useBookingList } from "../../../shared/hooks/useBookings";
import type { Thread } from "../../../shared/schemas/messaging";

const formatTimestamp = (iso?: string | null) => {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const buildContactNames = (contacts?: { name: string }[], limit = 3) => {
  if (!contacts || contacts.length === 0) {
    return "";
  }
  const names = contacts.map((contact) => contact.name).filter(Boolean);
  if (names.length <= limit) {
    return names.join(", ");
  }
  return `${names.slice(0, limit).join(", ")} +${names.length - limit}`;
};

const getThreadDisplayName = (thread: Thread, currentUserId?: string | null) => {
  const otherParticipants = thread.participants.filter((participant) => participant.userId !== currentUserId);
  const names = otherParticipants
    .map((participant) => participant.user?.fullName || participant.user?.email || "")
    .filter(Boolean);
  if (thread.title) {
    return thread.title;
  }
  if (names.length === 0) {
    return "Conversation";
  }
  if (names.length > 2) {
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }
  return names.join(", ");
};

const ClientInbox = () => {
  const { user } = useAuth();
  const toast = useToast();
  const threadsQuery = useThreads();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const messagesQuery = useThreadMessages(selectedThreadId);
  const sendMutation = useSendMessage();
  const createThreadMutation = useCreateThread();
  const [messageBody, setMessageBody] = useState("");
  const socket = useSocket();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [conversationType, setConversationType] = useState<"provider" | "support">("provider");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const { data: supportContacts } = useSupportContacts("client_support");

  const { data: clientBookings } = useBookingList(
    {
      clientId: user?.id ?? undefined,
      pageSize: 50,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  );

  const providerOptions = useMemo(() => {
    const seen = new Map<
      string,
      {
        providerId: string;
        name: string;
        bookingId: string;
        status: string;
      }
    >();
    (clientBookings?.bookings ?? []).forEach((booking) => {
      const provider = booking.provider;
      if (!provider?.id || !booking.id) {
        return;
      }
      if (seen.has(provider.id)) {
        return;
      }
      seen.set(provider.id, {
        providerId: provider.id,
        name: provider.fullName || provider.email || "Provider",
        bookingId: booking.id,
        status: booking.status
      });
    });
    return Array.from(seen.values());
  }, [clientBookings?.bookings]);

  useEffect(() => {
    if (!composerOpen) {
      return;
    }
    if (conversationType === "provider" && providerOptions.length === 0) {
      setConversationType("support");
    }
  }, [providerOptions.length, composerOpen, conversationType]);

  const resetComposer = () => {
    setSelectedBookingId("");
    setSupportSubject("");
    setConversationType(providerOptions.length ? "provider" : "support");
  };

  useEffect(() => {
    if (threadsQuery.data?.length && !selectedThreadId) {
      setSelectedThreadId(threadsQuery.data[0].id);
    }
  }, [threadsQuery.data, selectedThreadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);

  useEffect(() => {
    if (!selectedThreadId && viewMode === "detail") {
      setViewMode("list");
    }
  }, [selectedThreadId, viewMode]);

  useEffect(() => {
    if (!socket || !selectedThreadId) {
      return;
    }
    const room = `thread:${selectedThreadId}`;
    socket.emit?.("join_room", { room });
    const handleMessageEvent = (payload: { thread_id?: string }) => {
      if (payload?.thread_id === selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: messagingKeys.messages(selectedThreadId) }).catch(() => undefined);
      }
      queryClient.invalidateQueries({ queryKey: messagingKeys.threads() }).catch(() => undefined);
    };
    socket.on("message.created", handleMessageEvent);
    return () => {
      socket.emit?.("leave_room", { room });
      socket.off("message.created", handleMessageEvent);
    };
  }, [socket, selectedThreadId, queryClient]);

  useEffect(() => {
    if (selectedThreadId) {
      window.dispatchEvent(
        new CustomEvent("chat:open", {
          detail: { threadId: selectedThreadId, role: "client" }
        })
      );
    }
  }, [selectedThreadId]);

  const handleSend = () => {
    if (!selectedThreadId || !messageBody.trim()) {
      return;
    }
    sendMutation
      .mutateAsync({ threadId: selectedThreadId, body: messageBody.trim() })
      .then(() => setMessageBody(""))
      .catch(() => {
        /* handled via toast */
      });
  };

  const handleCreateConversation = () => {
    if (conversationType === "provider") {
      if (!selectedBookingId) {
        toast.showToast({
          title: "Pick a booking",
          description: "Choose a recent booking to reach your provider.",
          variant: "error"
        });
        return;
      }
      createThreadMutation
        .mutateAsync({ scope: "booking", bookingId: selectedBookingId })
        .then((thread) => {
          if (thread?.id) {
            setSelectedThreadId(thread.id);
          }
          toast.showToast({
            title: "Conversation started",
            description: "Your provider will be notified.",
            variant: "success"
          });
          setComposerOpen(false);
          resetComposer();
        })
        .catch((error) => {
          toast.showToast({
            title: "Unable to start chat",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "error"
          });
        });
      return;
    }

    createThreadMutation
      .mutateAsync({
        scope: "client_support",
        title: supportSubject.trim() || "Client support"
      })
      .then((thread) => {
        if (thread?.id) {
          setSelectedThreadId(thread.id);
        }
        toast.showToast({
          title: "Support request sent",
          description: "An operator will reply shortly.",
          variant: "success"
        });
        setComposerOpen(false);
        resetComposer();
      })
      .catch((error) => {
        toast.showToast({
          title: "Unable to reach support",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error"
        });
      });
  };

  const rawThreads = threadsQuery.data ?? [];
  const threads = rawThreads;

  if (threadsQuery.isLoading && !threads.length) {
    return <Loading fullHeight />;
  }

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;

  return (
    <div className="flex flex-col gap-6 lg:h-[78vh] lg:flex-row">
      <section className="w-full rounded-[32px] border border-slate-100 bg-white/90 shadow-card lg:w-72">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">Inbox</p>
            <p className="text-sm text-slate-500">Chat with providers or support.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setComposerOpen(true)}>
            New
          </Button>
        </div>
        <div className="h-px bg-slate-100" />
        {threads.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            No conversations yet. Start one to reach your provider or the support team.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {threads.map((thread) => {
              const isActive = thread.id === selectedThreadId;
              const displayName = getThreadDisplayName(thread, user?.id);
              return (
                <li
                  key={thread.id}
                  className={classNames(
                    "cursor-pointer px-5 py-4 transition",
                    isActive ? "bg-brand-50" : "hover:bg-slate-50"
                  )}
                  onClick={() => {
                    setSelectedThreadId(thread.id);
                    setViewMode("detail");
                  }}
                >
                  <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="text-xs text-slate-500">{formatTimestamp(thread.lastMessageAt)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex-1 rounded-[32px] border border-slate-100 bg-white/90 shadow-card">
        {selectedThread ? (
          <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedThread ? getThreadDisplayName(selectedThread, user?.id) : "Conversation"}
              </p>
              <p className="text-xs text-slate-500">{formatTimestamp(selectedThread.lastMessageAt)}</p>
            </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 lg:hidden"
                onClick={() => setViewMode("list")}
              >
                Threads
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {messagesQuery.isLoading ? (
                <Loading />
              ) : (
                <div className="space-y-3">
                  {messagesQuery.data?.map((message) => (
                    <div
                      key={message.id}
                      className={classNames(
                        "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow",
                        message.sender?.id === user?.id
                          ? "ml-auto bg-brand-600 text-white"
                          : "mr-auto bg-slate-100 text-slate-800"
                      )}
                    >
                      {message.body}
                      <p className="mt-1 text-[10px] opacity-70">{formatTimestamp(message.createdAt)}</p>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <div className="flex gap-2">
                <Input
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  placeholder="Write a message"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button onClick={handleSend} loading={sendMutation.isPending}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-12 text-center text-slate-500">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-brand-600">
              <ChatBubbleOutlineIcon fontSize="large" />
            </span>
            <div>
              <p className="text-base font-semibold text-slate-900">Select a conversation</p>
              <p className="text-sm">Pick a thread from the list or start a new one.</p>
            </div>
            <Button variant="secondary" onClick={() => setComposerOpen(true)}>
              Start conversation
            </Button>
          </div>
        )}
      </section>

      <Modal open={composerOpen} onClose={() => setComposerOpen(false)} title="New conversation">
        <div className="space-y-4">
          <div className="flex gap-3">
            <button
              type="button"
              className={classNames(
                "flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold",
                conversationType === "provider"
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600"
              )}
              onClick={() => setConversationType("provider")}
              disabled={providerOptions.length === 0}
            >
              Provider
            </button>
            <button
              type="button"
              className={classNames(
                "flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold",
                conversationType === "support"
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600"
              )}
              onClick={() => setConversationType("support")}
            >
              Support
            </button>
          </div>
          {conversationType === "provider" ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Choose booking</p>
              {providerOptions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  We couldn’t find recent bookings. Once you have an active booking, you can message the provider here.
                </p>
              ) : (
                <select
                  value={selectedBookingId}
                  onChange={(event) => setSelectedBookingId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select booking</option>
                  {providerOptions.map((option) => (
                    <option key={option.bookingId} value={option.bookingId}>
                      {option.name} • {option.status.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</p>
                <Input
                  placeholder="e.g. Payment question"
                  value={supportSubject}
                  onChange={(event) => setSupportSubject(event.target.value)}
                />
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">This chat will notify:</p>
                <p className="mt-1">
                  Admin team:{" "}
                  {supportContacts?.admins?.length
                    ? buildContactNames(supportContacts.admins)
                    : "Operations support"}
                </p>
                <p className="mt-1">
                  Your providers:{" "}
                  {supportContacts?.matches?.length
                    ? buildContactNames(supportContacts.matches)
                    : "Your recent caregivers will be looped in when relevant."}
                </p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConversation} loading={createThreadMutation.isPending}>
              Start chat
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientInbox;
