import classNames from "classnames";
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Search, MessageSquare } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Loading } from "../../../shared/components/Loading";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useSocket } from "../../../shared/hooks/useSocket";
import {
  useThreads,
  useThreadMessages,
  useSendMessage,
  useCreateThread,
  messagingKeys,
} from "../../../shared/hooks/useMessaging";
import { Modal } from "../../../shared/components/Modal";
import { useToast } from "../../../shared/components/ToastProvider";
import { useBookingList } from "../../../shared/hooks/useBookings";
import { AppLayout } from "../../../shared/components/AppLayout";
import { ClientPageHeader } from "../components/ClientPageHeader";
import { ConversationList, type Conversation } from "../../../shared/components/messaging/ConversationList";
import { MessageThread, type Message } from "../../../shared/components/messaging/MessageThread";

const ClientInbox = () => {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const {
    data: threadsData,
    isLoading: threadsLoading,
    fetchNextPage: fetchNextThreads,
    hasNextPage: hasNextThreads,
  } = useThreads();

  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage: fetchNextMessages,
    hasNextPage: hasNextMessages,
    isFetchingNextPage: isFetchingMessages,
  } = useThreadMessages(threadId || null);

  const sendMutation = useSendMessage();
  const createThreadMutation = useCreateThread();

  const [composerOpen, setComposerOpen] = useState(false);
  const [conversationType, setConversationType] = useState<"provider" | "support">("provider");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [supportSubject, setSupportSubject] = useState("");

  const { data: clientBookings } = useBookingList(
    { clientId: user?.id ?? undefined, pageSize: 50, preset: "card" },
    { enabled: Boolean(user?.id) }
  );

  const providerOptions = useMemo(() => {
    const seen = new Map<string, any>();
    (clientBookings?.bookings ?? []).forEach((booking: any) => {
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
    if (!socket || !threadId) return;
    const room = `thread:${threadId}`;
    socket.emit?.("join_room", { room });
    const handleMessageEvent = (payload: { thread_id?: string }) => {
      if (payload?.thread_id === threadId) {
        queryClient.invalidateQueries({ queryKey: messagingKeys.messages(threadId) }).catch(() => undefined);
      }
      queryClient.invalidateQueries({ queryKey: messagingKeys.threads() }).catch(() => undefined);
    };
    socket.on("message.created", handleMessageEvent);
    return () => {
      socket.emit?.("leave_room", { room });
      socket.off("message.created", handleMessageEvent);
    };
  }, [socket, threadId, queryClient]);

  const threads: Conversation[] = useMemo(() => {
    return (threadsData?.pages.flatMap((page: any) => page.data) ?? []).map((t: any) => {
      const other = t.participants.find((p: any) => p.userId !== user?.id);
      return {
        id: t.id,
        title: t.title || other?.user?.fullName || other?.user?.email || "Conversation",
        lastMessage: t.messages[0] ? {
          body: t.messages[0].body || "",
          created_at: t.messages[0].createdAt || t.lastMessageAt || "",
          sender_id: t.messages[0].senderUserId || "",
          delivery_status: t.messages[0].deliveryStatus
        } : undefined,
        unreadCount: (t as any).unreadCount || 0,
        avatarUrl: other?.user?.avatarUrl
      };
    });
  }, [threadsData, user?.id]);

  const messages: Message[] = useMemo(() => {
    const raw = messagesData?.pages.flatMap((page: any) => page.data) ?? [];
    return raw.map((m: any) => ({
      id: m.id,
      body: m.body || "",
      created_at: m.createdAt || "",
      isMe: m.senderUserId === user?.id,
      senderName: m.sender?.fullName || undefined,
      delivery_status: m.deliveryStatus as any
    }));
  }, [messagesData, user?.id]);

  const handleSendMessage = (body: string) => {
    if (!threadId) return;
    sendMutation.mutate({ threadId, body });
  };

  const selectedThread = threads.find(t => t.id === threadId);

  const handleCreateConversation = () => {
    const scope = conversationType === "provider" ? "booking" : "client_support";
    createThreadMutation.mutateAsync({
      scope,
      bookingId: scope === "booking" ? selectedBookingId : undefined,
      title: scope === "client_support" ? supportSubject : undefined
    }).then((t: any) => {
      setComposerOpen(false);
      navigate(`/app/inbox/${t.id}`);
      toast.showToast({ title: "Conversation started", variant: "success" });
    }).catch((e: any) => {
      toast.showToast({ title: "Error", description: e.message, variant: "error" });
    });
  };

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="flex flex-col h-screen max-h-screen overflow-hidden">
        <div className="shrink-0 bg-white border-b border-slate-100">
          <ClientPageHeader
            title="Inbox"
            subtitle="Coordinate your care privately and securely."
            overline="Inbox"
          />
        </div>

        <div className="flex-1 flex overflow-hidden lg:px-8 lg:py-8 bg-slate-50/50">
          <div className="w-full h-full flex rounded-[2.5rem] bg-white shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            {/* List Pane */}
            <div className={classNames(
              "w-full lg:w-[400px] border-r border-slate-50 flex flex-col shrink-0",
              threadId && "hidden lg:flex"
            )}>
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Messages</h2>
                <button
                  onClick={() => setComposerOpen(true)}
                  className="h-10 w-10 rounded-xl bg-tiba-blue text-white flex items-center justify-center shadow-lg shadow-tiba-blue/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="p-4 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input
                    placeholder="Search conversations..."
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-100 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-tiba-blue/10 transition-all shadow-sm"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                {threadsLoading && !threads.length ? (
                  <div className="p-12 text-center"><Loading /></div>
                ) : (
                  <ConversationList
                    conversations={threads}
                    activeId={threadId}
                    onSelect={(id) => navigate(`/app/inbox/${id}`)}
                  />
                )}
                {hasNextThreads && (
                  <button
                    onClick={() => fetchNextThreads()}
                    className="w-full py-4 text-xs font-bold text-slate-400 hover:text-tiba-blue transition-colors"
                  >
                    Load More
                  </button>
                )}
              </div>
            </div>

            {/* Thread Pane */}
            <div className={classNames(
              "flex-1 flex flex-col min-w-0 bg-[#f8f9fa]",
              !threadId && "hidden lg:flex"
            )}>
              {threadId ? (
                <MessageThread
                  title={selectedThread?.title || "Inbox"}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onLoadMore={() => fetchNextMessages()}
                  hasMore={hasNextMessages}
                  isLoading={isFetchingMessages || messagesLoading}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="h-24 w-24 rounded-[40px] bg-slate-50 flex items-center justify-center text-slate-200 mb-8 border border-slate-100 shadow-inner">
                    <MessageSquare size={48} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Inbox</h3>
                  <p className="mt-2 text-slate-500 max-w-xs text-sm leading-relaxed">
                    Choose a conversation from the list to start coordinating your care.
                  </p>
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="mt-8 px-8 h-12 rounded-2xl bg-slate-900 text-white font-bold text-sm shadow-lg active:scale-95 transition-all"
                  >
                    Start Conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Start Chat"
        description="Who would you like to speak with?"
      >
        <div className="space-y-6 pt-4">
          <div className="flex p-1 bg-slate-100 rounded-2xl">
            <button
              onClick={() => setConversationType("provider")}
              className={classNames(
                "flex-1 h-10 rounded-xl text-xs font-bold transition-all",
                conversationType === "provider" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              Provider
            </button>
            <button
              onClick={() => setConversationType("support")}
              className={classNames(
                "flex-1 h-10 rounded-xl text-xs font-bold transition-all",
                conversationType === "support" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              Support
            </button>
          </div>

          {conversationType === "provider" ? (
            <div className="space-y-3">
              {providerOptions.map(opt => (
                <button
                  key={opt.bookingId}
                  onClick={() => setSelectedBookingId(opt.bookingId)}
                  className={classNames(
                    "w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between",
                    selectedBookingId === opt.bookingId ? "border-tiba-blue bg-tiba-blue/5 ring-1 ring-tiba-blue" : "border-slate-100 hover:bg-slate-50"
                  )}
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">{opt.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Status: {opt.status}</p>
                  </div>
                  {selectedBookingId === opt.bookingId && <div className="h-4 w-4 rounded-full bg-tiba-blue" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-medium text-slate-500 px-1">Describe your query briefly:</p>
              <input
                value={supportSubject}
                onChange={e => setSupportSubject(e.target.value)}
                placeholder="e.g. Help with booking..."
                className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-tiba-blue/10"
              />
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button onClick={() => setComposerOpen(false)} className="flex-1 h-12 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
            <button
              onClick={handleCreateConversation}
              disabled={createThreadMutation.isPending}
              className="flex-1 h-12 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-lg disabled:opacity-50"
            >
              {createThreadMutation.isPending ? "Starting..." : "Start Conversation"}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
};

export default ClientInbox;
