import classNames from "classnames";
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Search, MessageSquare, Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Loading } from "../../../shared/components/Loading";
import ApiErrorBanner from "../../../shared/components/ApiErrorBanner";
import { classifyApiError } from "../../../shared/utils/errors";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useSocket } from "../../../shared/hooks/useSocket";
import {
  useThreads,
  useThreadMessages,
  useSendMessage,
  useCreateThread,
  messagingKeys,
} from "../../../shared/hooks/useMessaging";
import { useToast } from "../../../shared/components/ToastProvider";
import { AppLayout } from "../../../shared/components/AppLayout";
import { ConversationList, type Conversation } from "../../../shared/components/messaging/ConversationList";
import { MessageThread, type Message } from "../../../shared/components/messaging/MessageThread";
import type { Thread } from "../../../shared/schemas/messaging";

/**
 * Client-side filter over already-loaded threads (the threads endpoint takes no search param,
 * and this stays within the existing API contract rather than adding one). Matches the fields
 * an admin would actually search by: the thread's own title, its booking id, and each
 * participant's name/email/phone -- not just whichever participant happened to become the
 * conversation's display title.
 */
export const filterThreadsBySearch = (threads: Thread[], search: string): Thread[] => {
  const query = search.trim().toLowerCase();
  if (!query) {
    return threads;
  }
  return threads.filter((thread) => {
    if (thread.title?.toLowerCase().includes(query)) return true;
    if (thread.bookingId?.toLowerCase().includes(query)) return true;
    return thread.participants.some((participant) => {
      const person = participant.user;
      if (!person) return false;
      return (
        (person.fullName ?? "").toLowerCase().includes(query) ||
        (person.email ?? "").toLowerCase().includes(query) ||
        (person.phone ?? "").toLowerCase().includes(query)
      );
    });
  });
};

const AdminConversationsPage = () => {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [search, setSearch] = useState("");

  const {
    data: threadsData,
    isLoading: threadsLoading,
    isError: threadsIsError,
    error: threadsError,
    refetch: refetchThreads,
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

  const rawThreads: Thread[] = useMemo(
    () => (threadsData?.pages.flatMap((page: any) => page.data) ?? []) as Thread[],
    [threadsData]
  );

  const filteredThreads = useMemo(() => filterThreadsBySearch(rawThreads, search), [rawThreads, search]);

  const threads: Conversation[] = useMemo(() => {
    return filteredThreads.map((t: any) => {
      const other = t.participants.find((p: any) => p.userId !== user?.id);
      return {
        id: t.id,
        title: t.title || (t.scope === 'booking' ? `Booking Support` : `General Support`),
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
  }, [filteredThreads, user?.id]);

  const messages: Message[] = useMemo(() => {
    const raw = messagesData?.pages.flatMap((page: any) => page.data) ?? [];
    return raw.map((m: any) => ({
      id: m.id,
      body: m.body || "",
      created_at: m.createdAt || "",
      isMe: m.senderUserId === user?.id,
      senderName: m.sender?.fullName || m.sender?.email || "User",
      delivery_status: m.deliveryStatus as any
    }));
  }, [messagesData, user?.id]);

  const handleSendMessage = (body: string) => {
    if (!threadId) return;
    sendMutation.mutate({ threadId, body });
  };

  const selectedThread = threads.find(t => t.id === threadId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
      <div className="flex-1 flex overflow-hidden lg:p-6">
        <div className="w-full h-full flex rounded-3xl bg-white shadow-xl border border-slate-100 overflow-hidden">
          {/* List Pane */}
          <div className={classNames(
            "w-full lg:w-[400px] border-r border-slate-50 flex flex-col shrink-0",
            threadId && "hidden lg:flex"
          )}>
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={20} className="text-tiba-blue" />
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Inbox</h2>
              </div>
            </div>
            <div className="p-4 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  placeholder="Filter by user or booking..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Filter conversations by user or booking"
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-100 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-tiba-blue/10 transition-all shadow-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {threadsLoading && !threads.length ? (
                <div className="p-12 text-center"><Loading /></div>
              ) : threadsIsError ? (
                <div className="p-6">
                  <ApiErrorBanner
                    {...classifyApiError(threadsError, "We couldn't load conversations right now.")}
                    onRetry={() => refetchThreads()}
                  />
                </div>
              ) : threads.length === 0 && search.trim() ? (
                <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
                  <p className="text-slate-400 text-sm">No conversations match &quot;{search.trim()}&quot;.</p>
                </div>
              ) : (
                <ConversationList
                  conversations={threads}
                  activeId={threadId}
                  onSelect={(id) => navigate(`/admin/conversations/${id}`)}
                />
              )}
              {!threadsIsError && hasNextThreads && (
                <button
                  onClick={() => fetchNextThreads()}
                  className="w-full py-4 text-xs font-bold text-slate-400 hover:text-tiba-blue transition-colors"
                >
                  Load More Threads
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
                  Select an active conversation to view messages and respond to users.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminConversationsPage;
