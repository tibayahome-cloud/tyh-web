import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { useCreateThread } from "./useMessaging";

// Opens the conversation for a booking in the person's inbox. The server hands back the booking's existing
// conversation when there is one and starts it when there is not, so this is safe to call from any "Chat" or
// "Message" button. It replaces a signal ("chat:open") that nothing answered once the inbox was redesigned, which
// left those buttons doing nothing.
export const useOpenBookingChat = (inboxPath: string) => {
  const navigate = useNavigate();
  const toast = useToast();
  const createThread = useCreateThread();
  const [openingBookingId, setOpeningBookingId] = useState<string | null>(null);

  const openBookingChat = useCallback(
    async (bookingId: string) => {
      if (!bookingId || openingBookingId) return;
      setOpeningBookingId(bookingId);
      try {
        const thread = await createThread.mutateAsync({ scope: "booking", bookingId });
        navigate(thread?.id ? `${inboxPath}/${thread.id}` : inboxPath);
      } catch {
        toast.showToast({
          title: "We could not open the conversation",
          description: "Check your connection and try again.",
          variant: "error"
        });
      } finally {
        setOpeningBookingId(null);
      }
    },
    [createThread, inboxPath, navigate, openingBookingId, toast]
  );

  return { openBookingChat, openingBookingId };
};
