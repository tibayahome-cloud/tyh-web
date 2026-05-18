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
}

const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, "HH:mm");
    if (isYesterday(date)) return "Yesterday";
    return format(date, "dd/MM/yy");
};

export const ConversationList = ({ conversations, onSelect, activeId }: ConversationListProps) => {
    return (
        <div className="flex flex-col h-full bg-white divide-y divide-slate-50 overflow-y-auto custom-scrollbar">
            {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
                    <p className="text-slate-400 text-sm">No conversations found</p>
                </div>
            ) : (
                conversations.map((conv) => (
                    <button
                        key={conv.id}
                        onClick={() => onSelect(conv.id)}
                        className={classNames(
                            "flex items-center gap-4 px-4 py-4 w-full text-left transition-all duration-200 outline-none",
                            activeId === conv.id
                                ? "bg-slate-50"
                                : "hover:bg-slate-50/50"
                        )}
                    >
                        <div className="relative shrink-0">
                            {conv.avatarUrl ? (
                                <img src={conv.avatarUrl} alt={conv.title} className="h-12 w-12 rounded-full object-cover" />
                            ) : (
                                <div className="h-12 w-12 rounded-full bg-tiba-blue/10 flex items-center justify-center">
                                    <span className="text-tiba-blue font-bold text-sm">
                                        {conv.title.slice(0, 2).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            {conv.unreadCount !== undefined && conv.unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-tiba-blue px-1.5 text-[10px] font-bold text-white ring-2 ring-white">
                                    {conv.unreadCount}
                                </span>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                                <h3 className={classNames(
                                    "text-sm font-semibold truncate",
                                    conv.unreadCount ? "text-slate-900" : "text-slate-700"
                                )}>
                                    {conv.title}
                                </h3>
                                {conv.lastMessage && (
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                        {formatTime(conv.lastMessage.created_at)}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5">
                                {conv.lastMessage && (
                                    <>
                                        {conv.lastMessage.delivery_status === "read" ? (
                                            <CheckCheck size={14} className="text-tiba-blue shrink-0" />
                                        ) : conv.lastMessage.delivery_status === "delivered" ? (
                                            <CheckCheck size={14} className="text-slate-300 shrink-0" />
                                        ) : (
                                            <Check size={14} className="text-slate-300 shrink-0" />
                                        )}
                                        <p className={classNames(
                                            "text-xs truncate",
                                            conv.unreadCount ? "text-slate-900 font-medium" : "text-slate-500"
                                        )}>
                                            {conv.lastMessage.body}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </button>
                ))
            )}
        </div>
    );
};
