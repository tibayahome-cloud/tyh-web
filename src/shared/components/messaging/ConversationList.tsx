import { format, isToday, isYesterday } from "date-fns";
import classNames from "classnames";
import { Check, CheckCheck } from "lucide-react";

export type Conversation = {
  id: string;
  title: string;
  lastMessage?: {
    body: string;
    created_at: string;
    sender_id: string;
    delivery_status: string;
  };
  unreadCount?: number;
  avatarUrl?: string;
  isActive?: boolean;
};

interface ConversationListProps {
  conversations: Conversation[];
  onSelect: (id: string) => void;
  activeId?: string;
  /** Shown when there is nothing to list; the page decides what to offer. */
  empty?: React.ReactNode;
}

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "dd/MM/yy");
};

export const ConversationList = ({
  conversations,
  onSelect,
  activeId,
  empty = <p className="text-sm text-slate-700">No conversations yet.</p>
}: ConversationListProps) => {
  if (conversations.length === 0) {
    return <div className="flex h-full items-center justify-center px-6 py-10 text-center">{empty}</div>;
  }
  return (
    <ul aria-label="Conversations" className="flex h-full flex-col divide-y divide-slate-100 overflow-y-auto bg-white custom-scrollbar">
      {conversations.map((conv) => {
        const unread = conv.unreadCount ?? 0;
        const selected = activeId === conv.id;
        return (
          <li key={conv.id}>
            <button
              type="button"
              onClick={() => onSelect(conv.id)}
              aria-current={selected ? "true" : undefined}
              className={classNames(
                "flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors motion-reduce:transition-none",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tiba-blue",
                selected ? "bg-sky-50" : "hover:bg-slate-50"
              )}
            >
              {conv.avatarUrl ? (
                <img src={conv.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tiba-blue/10 text-base font-bold text-tiba-blue">
                  {conv.title.trim().charAt(0).toUpperCase() || "?"}
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={classNames("truncate text-sm", unread ? "font-bold text-slate-900" : "font-semibold text-slate-800")}>
                    {conv.title}
                  </span>
                  {conv.lastMessage && (
                    <span className="shrink-0 text-xs text-slate-600">{formatTime(conv.lastMessage.created_at)}</span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  {conv.lastMessage && (
                    <>
                      {conv.lastMessage.delivery_status === "read" ? (
                        <CheckCheck aria-hidden="true" size={14} className="shrink-0 text-tiba-blue" />
                      ) : conv.lastMessage.delivery_status === "delivered" ? (
                        <CheckCheck aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
                      ) : (
                        <Check aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
                      )}
                      <span className={classNames("truncate text-sm", unread ? "font-medium text-slate-900" : "text-slate-600")}>
                        {conv.lastMessage.body}
                      </span>
                    </>
                  )}
                </span>
              </span>

              {unread > 0 && (
                <span
                  aria-label={`${unread} unread`}
                  className="flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-tiba-blue px-2 text-xs font-bold text-white"
                >
                  {unread}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
};
