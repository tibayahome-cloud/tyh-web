import { useRef, useLayoutEffect, useMemo } from "react";
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

    // Read top to bottom: the oldest message first, the newest next to the box you type in. The messages arrive newest
    // first (that is how the server pages them), so they are put in time order here.
    const ordered = useMemo(
        () =>
            [...messages].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id)
            ),
        [messages]
    );

    // A new message, or opening the conversation, scrolls to the newest. Loading older messages adds them above, so the
    // place being read is kept instead of jumping.
    const previous = useRef<{ oldestId: string | null; height: number }>({ oldestId: null, height: 0 });
    useLayoutEffect(() => {
        const box = scrollRef.current;
        if (!box) return;
        const oldestId = ordered[0]?.id ?? null;
        const olderWereAdded = previous.current.oldestId !== null && oldestId !== previous.current.oldestId && ordered.length > 1;
        if (olderWereAdded && previous.current.height > 0) {
            box.scrollTop += box.scrollHeight - previous.current.height;
        } else {
            box.scrollTop = box.scrollHeight;
        }
        previous.current = { oldestId, height: box.scrollHeight };
    }, [ordered]);

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

            {/* Messages Area: oldest at the top, newest at the bottom; a short conversation sits at the bottom. */}
            <div ref={scrollRef} className="custom-scrollbar flex flex-1 flex-col overflow-y-auto p-6">
                <div className="mt-auto flex flex-col gap-1">
                    {hasMore && (
                        <button
                            type="button"
                            onClick={onLoadMore}
                            disabled={isLoading}
                            className="mb-4 self-center rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-xs text-slate-600 transition-colors hover:bg-white disabled:opacity-50"
                        >
                            {isLoading ? "Loading older messages..." : "Load older messages"}
                        </button>
                    )}

                    {ordered.map((msg, idx) => {
                        const previousMsg = ordered[idx - 1];
                        const startsDay = !previousMsg || !isSameDay(new Date(msg.created_at), new Date(previousMsg.created_at));
                        const sameSenderAsPrevious = Boolean(previousMsg) && previousMsg.isMe === msg.isMe && !startsDay;

                        return (
                            <div key={msg.id} className="flex flex-col">
                                {startsDay && (
                                    <div className="my-4 self-center rounded-lg border border-slate-100/50 bg-white/60 px-4 py-1 shadow-sm backdrop-blur-sm">
                                        <span className="text-xs font-semibold text-slate-600">
                                            {format(new Date(msg.created_at), "MMMM d, yyyy")}
                                        </span>
                                    </div>
                                )}
                                <div
                                    className={classNames(
                                        "flex max-w-[85%] flex-col sm:max-w-[70%]",
                                        msg.isMe ? "self-end" : "self-start",
                                        sameSenderAsPrevious ? "mt-0.5" : "mt-3"
                                    )}
                                >
                                    <div
                                        className={classNames(
                                            "relative break-words rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                                            msg.isMe
                                                ? "rounded-tr-none bg-tiba-blue text-white"
                                                : "rounded-tl-none border border-slate-100 bg-white text-slate-800"
                                        )}
                                    >
                                        {msg.body}
                                        <div
                                            className={classNames(
                                                "mt-1 flex justify-end gap-1 text-xs opacity-80",
                                                msg.isMe ? "text-white/80" : "text-slate-500"
                                            )}
                                        >
                                            {format(new Date(msg.created_at), "HH:mm")}
                                            {msg.isMe && (
                                                <span>
                                                    {msg.delivery_status === "read" ? "✓✓" : msg.delivery_status === "delivered" ? "✓✓" : "✓"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
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
