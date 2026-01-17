import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  Send,
  Plus,
  ChevronLeft,
  User,
  ShieldCheck,
  Clock,
  Search,
  MoreVertical,
  Activity,
  Zap,
  CheckCircle2
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
import classNames from "classnames";

const formatTimestamp = (iso?: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const getThreadDisplayName = (thread: Thread, currentUserId?: string | null) => {
  if (thread.title) return thread.title;
  const otherParticipants = thread.participants.filter(p => p.userId !== currentUserId);
  const names = otherParticipants.map(p => p.user?.fullName || "Analyst").filter(Boolean);
  if (names.length === 0) return "Intelligence Link";
  if (names.length > 2) return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  return names.join(", ");
};

const ProviderInbox = () => {
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
  const [conversationType, setConversationType] = useState<"client" | "support">("client");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const { data: supportContacts } = useSupportContacts("provider_support");

  const { data: providerBookings, isFetching: loadingClients } = useBookingList(
    { providerId: user?.id ?? undefined, pageSize: 50, preset: "card" },
    { enabled: Boolean(user?.id) }
  );

  const clientOptions = useMemo(() => {
    const seen = new Map<string, any>();
    (providerBookings?.bookings ?? []).forEach(booking => {
      const client = booking.client;
      if (!client?.id || !booking.id) return;
      if (seen.has(client.id)) return;
      seen.set(client.id, {
        clientId: client.id,
        name: client.fullName || "Field Agent",
        bookingId: booking.id,
        status: booking.status
      });
    });
    return Array.from(seen.values());
  }, [providerBookings?.bookings]);

  useEffect(() => {
    if (threadsQuery.data?.length && !selectedThreadId) {
      setSelectedThreadId(threadsQuery.data[0].id);
    }
  }, [threadsQuery.data, selectedThreadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);

  useEffect(() => {
    if (!socket || !selectedThreadId) return;
    const room = `thread:${selectedThreadId}`;
    socket.emit?.("join_room", { room });
    const handleNewMessage = (payload: { thread_id?: string }) => {
      if (payload?.thread_id === selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: messagingKeys.messages(selectedThreadId) }).catch(() => undefined);
      }
      queryClient.invalidateQueries({ queryKey: messagingKeys.threads() }).catch(() => undefined);
    };
    socket.on("message.created", handleNewMessage);
    return () => {
      socket.emit?.("leave_room", { room });
      socket.off("message.created", handleNewMessage);
    };
  }, [socket, selectedThreadId, queryClient]);

  const handleSend = () => {
    if (!selectedThreadId || !messageBody.trim()) return;
    sendMutation.mutate({ threadId: selectedThreadId, body: messageBody.trim() }, {
      onSuccess: () => setMessageBody("")
    });
  };

  const handleCreateThread = () => {
    const isSupport = conversationType === "support";
    createThreadMutation.mutate({
      scope: isSupport ? "provider_support" : "booking",
      bookingId: isSupport ? undefined : selectedBookingId,
      title: isSupport ? supportSubject.trim() || "Operational Support" : undefined
    }, {
      onSuccess: (thread) => {
        if (thread?.id) setSelectedThreadId(thread.id);
        toast.showToast({ title: "Link Established", variant: "success" });
        setComposerOpen(false);
        setViewMode("detail");
      }
    });
  };

  const threads = threadsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const selectedThread = threads.find(t => t.id === selectedThreadId);

  if (threadsQuery.isLoading && !threads.length) return <Loading fullHeight />;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 overflow-hidden pb-10">
      {/* Fleet Comms Sidebar */}
      <aside className={classNames(
        "flex flex-col gap-6 lg:flex lg:w-[380px]",
        viewMode === "detail" ? "hidden" : "w-full"
      )}>
        <div className="flex flex-col gap-6 rounded-[40px] border border-white/80 bg-white/40 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 h-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold uppercase tracking-widest text-slate-900">Fleet Comms</h1>
                <p className="text-[10px] font-bold uppercase text-brand-600">Active Intelligence</p>
              </div>
            </div>
            <button
              onClick={() => setComposerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-linear text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search frequencies..."
              className="w-full rounded-2xl border-none bg-slate-900/5 py-3 pl-11 pr-4 text-xs font-bold ring-1 ring-black/5 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                <MessageSquare className="h-10 w-10 mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">No Active Links</p>
              </div>
            ) : (
              threads.map((thread) => {
                const isActive = thread.id === selectedThreadId;
                const lastMsg = thread.messages.at(-1);
                return (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      setViewMode("detail");
                    }}
                    className={classNames(
                      "group relative flex w-full items-start gap-4 rounded-3xl p-4 transition-all duration-300",
                      isActive
                        ? "bg-white shadow-xl ring-1 ring-black/5"
                        : "hover:bg-white/60"
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className={classNames(
                        "flex h-12 w-12 items-center justify-center rounded-2xl font-black text-white shadow-lg",
                        thread.scope === "provider_support" ? "bg-slate-900" : "bg-brand-linear"
                      )}>
                        {getThreadDisplayName(thread, user?.id).charAt(0)}
                      </div>
                      {(thread as any).unreadCount > 0 && (
                        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-rose-500 ring-2 ring-white" />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden text-left">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-bold text-slate-900">
                          {getThreadDisplayName(thread, user?.id)}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold text-slate-400">
                          {formatTimestamp(lastMsg?.createdAt || thread.lastMessageAt)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-bold text-slate-500">
                        {lastMsg?.body || "Awaiting intelligence..."}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* Intelligence Feed */}
      <main className={classNames(
        "flex-1 flex flex-col lg:flex",
        viewMode === "list" ? "hidden" : "flex"
      )}>
        <div className="flex flex-col rounded-[48px] border border-white/80 bg-white/40 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 h-full overflow-hidden">
          {/* Active Link Header */}
          <header className="flex shrink-0 items-center justify-between bg-white/40 px-8 py-6 backdrop-blur-md border-b border-white/80">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode("list")}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-lg ring-1 ring-black/5 lg:hidden"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-linear text-white shadow-xl font-black">
                {selectedThread ? getThreadDisplayName(selectedThread, user?.id).charAt(0) : "?"}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {selectedThread ? getThreadDisplayName(selectedThread, user?.id) : "Establishing Link..."}
                </h2>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Secure Channel</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="h-10 w-10 rounded-xl bg-white shadow-lg ring-1 ring-black/5 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
          </header>

          {/* Terminal Feed */}
          <div className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar space-y-8 bg-slate-50/20">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                <Zap className="h-12 w-12 mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">Encrypted Stream Empty</p>
              </div>
            ) : (
              messages.map((message, i) => {
                const isMine = message.senderUserId === user?.id;
                const nextMessage = messages[i + 1];
                const isContinued = nextMessage?.senderUserId === message.senderUserId;

                return (
                  <div key={message.id} className={classNames(
                    "flex w-full",
                    isMine ? "justify-end" : "justify-start"
                  )}>
                    <div className={classNames(
                      "flex max-w-[70%] flex-col",
                      isMine ? "items-end" : "items-start"
                    )}>
                      {!isMine && !isContinued && (
                        <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4">
                          {`${message.sender?.fullName || "Field Unit"}`}
                        </span>
                      )}
                      <div className={classNames(
                        "relative px-6 py-4 text-sm font-medium shadow-2xl",
                        isMine
                          ? "rounded-[28px] rounded-tr-none bg-slate-900 text-white shadow-slate-900/10"
                          : "rounded-[28px] rounded-tl-none bg-white text-slate-900 ring-1 ring-black/5"
                      )}>
                        <p className="leading-relaxed">{message.body}</p>
                        <div className={classNames(
                          "mt-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest",
                          isMine ? "text-white/40" : "text-slate-400"
                        )}>
                          {formatTimestamp(message.createdAt)}
                          {isMine && <CheckCircle2 className="h-3 w-3 text-brand-400" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Comms Input */}
          <footer className="shrink-0 p-8 pt-0 bg-slate-50/20 backdrop-blur-sm">
            <div className="relative group">
              <textarea
                placeholder="Transmit intelligence..."
                rows={1}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="w-full rounded-[32px] border-none bg-white p-6 pr-20 text-sm font-bold shadow-2xl ring-1 ring-black/5 transition-all focus:ring-brand-500/20"
              />
              <button
                onClick={handleSend}
                disabled={!messageBody.trim() || sendMutation.isPending}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-brand-linear text-white shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                <Send className={classNames("h-6 w-6", sendMutation.isPending && "animate-pulse")} />
              </button>
            </div>
          </footer>
        </div>
      </main>

      {/* Composer Intelligence Modal */}
      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Establish Intelligence Link"
        maxWidth="sm"
      >
        <div className="space-y-8 p-6">
          <div className="flex gap-4 p-1 rounded-3xl bg-slate-900/5 ring-1 ring-black/5">
            <button
              onClick={() => setConversationType("client")}
              className={classNames(
                "flex-1 rounded-2xl py-4 text-xs font-bold uppercase tracking-widest transition-all",
                conversationType === "client"
                  ? "bg-white text-slate-900 shadow-xl"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              Field Unit
            </button>
            <button
              onClick={() => setConversationType("support")}
              className={classNames(
                "flex-1 rounded-2xl py-4 text-xs font-bold uppercase tracking-widest transition-all",
                conversationType === "support"
                  ? "bg-white text-slate-900 shadow-xl"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              Command Unit
            </button>
          </div>

          {conversationType === "client" ? (
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Operational Links</p>
              <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {clientOptions.length === 0 ? (
                  <p className="text-sm font-bold text-slate-500 text-center py-10 italic">No recent field units detected.</p>
                ) : (
                  clientOptions.map((client) => (
                    <button
                      key={client.bookingId}
                      onClick={() => setSelectedBookingId(client.bookingId)}
                      className={classNames(
                        "flex items-center justify-between rounded-3xl p-5 text-left transition-all border",
                        selectedBookingId === client.bookingId
                          ? "bg-brand-500/5 border-brand-500/50 shadow-lg"
                          : "bg-white border-transparent hover:border-slate-200"
                      )}
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{client.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Mission #{client.bookingId.slice(0, 8)}</p>
                      </div>
                      <div className={classNames(
                        "flex h-6 w-6 items-center justify-center rounded-full border-2",
                        selectedBookingId === client.bookingId ? "border-brand-500 bg-brand-500" : "border-slate-100"
                      )}>
                        {selectedBookingId === client.bookingId && <CheckCircle2 className="h-4 w-4 text-white" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Input
                label="Operational Objective"
                placeholder="Briefly state the support requirement..."
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
                className="bg-white/60"
              />
              <div className="rounded-3xl bg-slate-900 p-6 text-white/80 shadow-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="h-5 w-5 text-brand-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Protocol Intelligence</span>
                </div>
                <p className="text-xs font-bold leading-relaxed">
                  Support requests are prioritized by Fleet Intelligence. An analyst will verify your channel within the next 5-10 minutes.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Button
              variant="secondary"
              className="flex-1 rounded-2xl h-14 font-bold uppercase tracking-widest"
              onClick={() => setComposerOpen(false)}
            >
              Abort
            </Button>
            <Button
              className="flex-2 rounded-2xl h-14 font-bold uppercase tracking-widest bg-brand-linear shadow-xl"
              onClick={handleCreateThread}
              disabled={createThreadMutation.isPending || (conversationType === "client" && !selectedBookingId)}
              loading={createThreadMutation.isPending}
            >
              Establish Link
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProviderInbox;
