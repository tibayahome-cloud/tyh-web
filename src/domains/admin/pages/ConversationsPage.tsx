import { useSearchParams } from "react-router-dom";
import { ConversationsPanel } from "../components/ConversationsPanel";

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
