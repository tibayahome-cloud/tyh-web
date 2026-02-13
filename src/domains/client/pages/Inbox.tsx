import classNames from "classnames";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  Send,
  MoreVertical,
  ArrowLeft,
  ChevronRight,
  User,
  ShieldCheck,
  MessageSquare,
  Clock
} from "lucide-react";

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
import { AppLayout } from "../../../shared/components/AppLayout";

const formatTimestamp = (iso?: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const buildContactNames = (contacts?: { name: string }[], limit = 3) => {
  if (!contacts || contacts.length === 0) return "";
  const names = contacts.map((contact) => contact.name).filter(Boolean);
  if (names.length <= limit) return names.join(", ");
  return `${names.slice(0, limit).join(", ")} +${names.length - limit}`;
};

const getThreadDisplayName = (thread: Thread, currentUserId?: string | null) => {
  const otherParticipants = thread.participants.filter((participant) => participant.userId !== currentUserId);
  const names = otherParticipants
    .map((participant) => participant.user?.fullName || participant.user?.email || "")
    .filter(Boolean);
  if (thread.title) return thread.title;
  if (names.length === 0) return "Conversation";
  if (names.length > 2) return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
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
    const seen = new Map<string, { providerId: string; name: string; bookingId: string; status: string }>();
    (clientBookings?.bookings ?? []).forEach((booking) => {
      const provider = booking.provider;
      if (!provider?.id || !booking.id) return;
      if (seen.has(provider.id)) return;
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
    if (!composerOpen) return;
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
    if (!selectedThreadId && viewMode === "detail") setViewMode("list");
  }, [selectedThreadId, viewMode]);

  useEffect(() => {
    if (!socket || !selectedThreadId) return;
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

  const handleSend = () => {
    if (!selectedThreadId || !messageBody.trim()) return;
    sendMutation.mutateAsync({ threadId: selectedThreadId, body: messageBody.trim() })
      .then(() => setMessageBody(""))
      .catch(() => { });
  };

  const handleCreateConversation = () => {
    if (conversationType === "provider") {
      if (!selectedBookingId) {
        toast.showToast({ title: "Pick a booking", description: "Choose a recent booking.", variant: "error" });
        return;
      }
      createThreadMutation.mutateAsync({ scope: "booking", bookingId: selectedBookingId })
        .then((thread) => {
          if (thread?.id) setSelectedThreadId(thread.id);
          toast.showToast({ title: "Conversation started", variant: "success" });
          setComposerOpen(false);
          resetComposer();
        })
        .catch((e) => toast.showToast({ title: "Unable to start chat", description: e.message, variant: "error" }));
      return;
    }

    createThreadMutation.mutateAsync({ scope: "client_support", title: supportSubject.trim() || "Client support" })
      .then((thread) => {
        if (thread?.id) setSelectedThreadId(thread.id);
        toast.showToast({ title: "Support reached", variant: "success" });
        setComposerOpen(false);
        resetComposer();
      })
      .catch((e) => toast.showToast({ title: "Unable to reach support", description: e.message, variant: "error" }));
  };

  const threads = threadsQuery.data ?? [];
  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  if (threadsQuery.isLoading && !threads.length) return <Loading fullHeight />;

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="flex h-[calc(100vh-140px)] flex-col lg:flex-row gap-6 -mt-8 sm:-mt-12">
        {/* THREAD LIST */}
        <section className={classNames(
          "flex flex-col w-full lg:w-96 rounded-[40px] border border-slate-100 bg-white/50 backdrop-blur-xl shadow-2xl transition-all overflow-hidden",
          viewMode === "detail" && "hidden lg:flex"
        )}>
          <div className="p-8 pb-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-600">Messages</p>
                <h1 className="text-2xl font-black text-slate-900">Inbox</h1>
              </div>
              <button
                onClick={() => setComposerOpen(true)}
                className="h-10 w-10 flex items-center justify-center rounded-2xl bg-brand-linear text-white shadow-xl active:scale-95 transition-all"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="relative flex items-center mb-4">
              <Search className="absolute left-4 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full h-12 pl-11 pr-4 rounded-2xl bg-slate-50 border-none text-sm font-medium focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 no-scrollbar">
            {threads.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto h-16 w-16 mb-4 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                  <MessageSquare size={32} />
                </div>
                <p className="text-sm font-bold text-slate-900">No messages yet</p>
                <p className="text-xs text-slate-500 mt-1">Start a conversation with your provider.</p>
              </div>
            ) : (
              <div className="space-y-2 pb-8">
                {threads.map((thread) => {
                  const isActive = thread.id === selectedThreadId;
                  const displayName = getThreadDisplayName(thread, user?.id);
                  return (
                    <button
                      key={thread.id}
                      onClick={() => { setSelectedThreadId(thread.id); setViewMode("detail"); }}
                      className={classNames(
                        "w-full flex items-center gap-4 p-4 rounded-[32px] transition-all group",
                        isActive ? "bg-white shadow-xl ring-1 ring-slate-100 scale-[1.02]" : "hover:bg-white/40"
                      )}
                    >
                      <div className={classNames(
                        "h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center shadow-inner",
                        isActive ? "bg-brand-linear text-white" : "bg-slate-100 text-slate-400"
                      )}>
                        <User size={24} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-900 truncate">{displayName}</p>
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">
                            {formatTimestamp(thread.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                          {thread.title || "Click to view message"}
                        </p>
                      </div>
                      {isActive && <ChevronRight size={16} className="text-brand-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* CHAT WINDOW */}
        <section className={classNames(
          "flex-1 flex flex-col rounded-[40px] border border-slate-100 bg-white shadow-2xl overflow-hidden",
          viewMode === "list" && !selectedThread && "hidden lg:flex"
        )}>
          {selectedThread ? (
            <div className="flex flex-col h-full">
              {/* CHAT HEADER */}
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setViewMode("list")}
                    className="lg:hidden h-10 w-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 shadow-inner">
                    <User size={24} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">{getThreadDisplayName(selectedThread, user?.id)}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Chat</p>
                    </div>
                  </div>
                </div>
                <button className="h-10 w-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                  <MoreVertical size={20} />
                </button>
              </div>

              {/* MESSAGE AREA */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                {messagesQuery.isLoading ? (
                  <div className="flex items-center justify-center h-full"><Loading /></div>
                ) : (
                  <div className="space-y-6">
                    {messagesQuery.data?.length === 0 && (
                      <div className="text-center py-20">
                        <p className="text-sm font-medium text-slate-400">No messages yet. Say hello!</p>
                      </div>
                    )}
                    {messagesQuery.data?.map((message) => {
                      const isMe = message.sender?.id === user?.id;
                      return (
                        <div key={message.id} className={classNames("flex flex-col", isMe ? "items-end" : "items-start")}>
                          <div className={classNames(
                            "max-w-[80%] px-6 py-4 rounded-[32px] shadow-sm relative group",
                            isMe ? "bg-slate-900 text-white rounded-tr-none" : "bg-slate-50 text-slate-900 rounded-tl-none"
                          )}>
                            <p className="text-sm font-medium leading-relaxed">{message.body}</p>
                          </div>
                          <div className="mt-2 flex items-center gap-2 px-2">
                            <Clock size={10} className="text-slate-300" />
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                              {formatTimestamp(message.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} className="h-4" />
                  </div>
                )}
              </div>

              {/* COMPOSER */}
              <div className="p-8 pt-0">
                <div className="p-2 rounded-[32px] bg-slate-50 border border-slate-100 shadow-inner flex items-center gap-2">
                  <input
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none focus:ring-0 px-4 text-sm font-medium text-slate-900 placeholder-slate-400"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!messageBody.trim() || sendMutation.isPending}
                    className="h-12 w-12 rounded-2xl bg-brand-linear text-white shadow-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 disabled:grayscale"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
              <div className="h-24 w-24 rounded-[40px] bg-slate-50 flex items-center justify-center text-slate-300 mb-6">
                <MessageSquare size={48} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Select a connection</h2>
              <p className="mt-2 text-slate-500 max-w-sm">
                Pick a conversation from the left to start coordinating your care.
              </p>
              <Button className="mt-8 px-8" onClick={() => setComposerOpen(true)}>Start New Chat</Button>
            </div>
          )}
        </section>

        {/* MODAL REDESIGN */}
        <Modal
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          title="New Conversation"
          description="Who would you like to reach today?"
        >
          <div className="space-y-8 pt-4">
            <div className="flex gap-4 p-1 rounded-3xl bg-slate-100">
              <button
                onClick={() => setConversationType("provider")}
                disabled={providerOptions.length === 0}
                className={classNames(
                  "flex-1 h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
                  conversationType === "provider" ? "bg-white text-brand-600 shadow-lg" : "text-slate-500 opacity-50"
                )}
              >
                Provider
              </button>
              <button
                onClick={() => setConversationType("support")}
                className={classNames(
                  "flex-1 h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
                  conversationType === "support" ? "bg-white text-brand-600 shadow-lg" : "text-slate-500"
                )}
              >
                Support Hub
              </button>
            </div>

            {conversationType === "provider" ? (
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Care Provider</p>
                {providerOptions.length === 0 ? (
                  <div className="p-6 rounded-3xl bg-slate-50 border border-dashed border-slate-200 text-center">
                    <p className="text-sm font-medium text-slate-500">No active or recent bookings found.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {providerOptions.map((option) => (
                      <button
                        key={option.bookingId}
                        onClick={() => setSelectedBookingId(option.bookingId)}
                        className={classNames(
                          "w-full flex items-center justify-between p-5 rounded-3xl border transition-all text-left",
                          selectedBookingId === option.bookingId
                            ? "border-brand-600 bg-brand-50/50 shadow-lg ring-1 ring-brand-600"
                            : "border-slate-100 bg-slate-50/50 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-white shadow-inner flex items-center justify-center text-brand-600">
                            <User size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{option.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{option.status.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                        {selectedBookingId === option.bookingId && <div className="h-4 w-4 rounded-full bg-brand-600 flex items-center justify-center text-white"><ChevronRight size={12} /></div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">What can we help with?</p>
                  <input
                    placeholder="e.g. Question about my invoice..."
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    className="w-full h-16 rounded-3xl bg-slate-50 border border-slate-100 px-6 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600/20 shadow-inner"
                  />
                </div>

                <div className="p-6 rounded-[32px] bg-indigo-50/50 border border-indigo-100 flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-2xl bg-white shadow flex items-center justify-center text-indigo-600">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest">Support Protocol</h4>
                    <p className="text-xs font-medium text-indigo-700/70 mt-1 leading-relaxed">
                      Our 24/7 care operators will respond within 5-10 minutes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setComposerOpen(false)}
                className="h-14 flex-1 rounded-2xl bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-100"
              >
                Discard
              </button>
              <button
                onClick={handleCreateConversation}
                disabled={createThreadMutation.isPending}
                className="h-14 flex-[2] rounded-2xl bg-slate-900 text-[11px] font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-brand-600"
              >
                {createThreadMutation.isPending ? "Connecting..." : "Initiate Chat"}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
};

export default ClientInbox;
