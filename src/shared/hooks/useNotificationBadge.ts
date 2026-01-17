import { useMemo } from "react";

import { useNotifications } from "./useNotifications";

export const useNotificationBadge = () => {
  const { meta, isLoading } = useNotifications({
    page: 1,
    pageSize: 1,
    unreadOnly: false
  });

  return useMemo(
    () => ({
      unread: meta?.unread ?? 0,
      isLoading
    }),
    [meta?.unread, isLoading]
  );
};
