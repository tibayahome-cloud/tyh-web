import { useRef, useEffect } from "react";
import classNames from "classnames";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "../Button";

export type Message = {
    id: string;
    body: string;
    created_at: string;
    isMe: boolean;
    senderName?: string;
    delivery_status: "pending" | "delivered" | "read";
};

interface MessageThreadProps {
    messages: Message[];
    onSendMessage: (text: string) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoading?: boolean;
    title: string;
    /** On small screens the list and the thread are separate screens; this goes back to the list. */
    onBack?: () => void;
}

export const MessageThread = ({ messages, onSendMessage, onLoadMore, hasMore, isLoading, title, onBack }: MessageThreadProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
        if (!inputRef.current?.value.trim()) return;
        onSendMessage(inputRef.current.value);
        inputRef.current.value = "";
    };

    // Auto-scroll to bottom on new messages (if already near bottom)
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    return (
        <div className="flex flex-col h-full bg-[#f0f2f5] relative overflow-hidden">
            {/* Header */}
            <div className="z-10 flex items-center gap-3 border-b border-slate-100 bg-white px-3 py-3 shadow-sm sm:px-6">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back to conversations"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue lg:hidden"
                    >
                        <ArrowLeft size={20} aria-hidden="true" />
                    </button>
                )}
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tiba-blue/10 text-sm font-bold text-tiba-blue">
                    {title.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <h2 className="min-w-0 truncate text-base font-bold text-slate-900">{title}</h2>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar flex flex-col-reverse"
            >
                {/* Empty div to push items to the bottom if list is short */}
                <div className="flex-1" />

                {messages.map((msg, idx) => {
                    const nextMsg = messages[idx + 1]; // Next in array is older in time
                    const showDate = !nextMsg || !isSameDay(new Date(msg.created_at), new Date(nextMsg.created_at));

                    return (
                        <div key={msg.id} className="flex flex-col">
                            <div className={classNames(
                                "flex flex-col max-w-[85%] sm:max-w-[70%] mb-1",
                                msg.isMe ? "self-end" : "self-start"
                            )}>
                                <div className={classNames(
                                    "px-4 py-2.5 rounded-2xl shadow-sm text-sm break-words relative",
                                    msg.isMe
                                        ? "bg-tiba-blue text-white rounded-tr-none"
                                        : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                                )}>
                                    {msg.body}
                                    <div className={classNames(
                                        "text-xs mt-1 flex justify-end gap-1 opacity-80",
                                        msg.isMe ? "text-white/80" : "text-slate-400"
                                    )}>
                                        {format(new Date(msg.created_at), "HH:mm")}
                                        {msg.isMe && (
                                            <span>
                                                {msg.delivery_status === "read" ? "✓✓" : msg.delivery_status === "delivered" ? "✓✓" : "✓"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {showDate && (
                                <div className="self-center my-6 px-4 py-1 bg-white/60 backdrop-blur-sm rounded-lg border border-slate-100/50 shadow-sm">
                                    <span className="text-xs font-semibold text-slate-600">
                                        {format(new Date(msg.created_at), "MMMM d, yyyy")}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}

                {hasMore && (
                    <button
                        onClick={onLoadMore}
                        disabled={isLoading}
                        className="self-center my-4 px-4 py-1.5 rounded-full bg-white/80 border border-slate-200 text-xs text-slate-500 hover:bg-white transition-colors disabled:opacity-50"
                    >
                        {isLoading ? "Loading older messages..." : "Load older messages"}
                    </button>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 z-10">
                <div className="flex items-end gap-3 max-w-4xl mx-auto">
                    <div className="flex-1 min-w-0">
                        <textarea
                            ref={inputRef}
                            aria-label="Message"
                            placeholder="Type a message"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tiba-blue/20 transition-all resize-none max-h-32 min-h-[44px] custom-scrollbar"
                            rows={1}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = "auto";
                                target.style.height = `${target.scrollHeight}px`;
                            }}
                        />
                    </div>
                    <Button
                        onClick={handleSend}
                        aria-label="Send message"
                        className="shrink-0 h-[44px] w-[44px] rounded-2xl p-0 flex items-center justify-center"
                    >
                        <Send size={18} className="translate-x-0.5 -translate-y-0.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
