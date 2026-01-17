import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { Card } from "../../../shared/components/Card";
import { useConversationStore } from "../../../shared/stores/useConversationStore";

type ConversationsPanelProps = {
  bookingId?: string | null;
};

export const ConversationsPanel = ({ bookingId }: ConversationsPanelProps) => {
  const resetUnread = useConversationStore((state) => state.reset);

  useEffect(() => {
    resetUnread();
  }, [resetUnread]);

  const summary = useMemo(
    () =>
      bookingId
        ? `Booking ${bookingId} conversation thread.`
        : "Select an active or recent booking to open its chat history.",
    [bookingId]
  );

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-slate-700">{summary}</p>
        <p className="mt-4 text-xs text-slate-500">
          Launch chats directly from booking trackers or escalation alerts. The <code>chat:open</code> bridge clears the
          unread counter automatically.
        </p>
      </Card>
    </div>
  );
};

const AdminConversationsPage = () => {
  const [params] = useSearchParams();
  const bookingId = params.get("bookingId");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Conversations</h1>
        <p className="text-sm text-slate-500">
          Booking-scoped chat threads between clients, providers, and the ops team. The drawer view uses this same
          panel.
        </p>
      </div>
      <ConversationsPanel bookingId={bookingId} />
    </div>
  );
};

export default AdminConversationsPage;
