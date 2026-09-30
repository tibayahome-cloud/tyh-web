import { useMemo } from "react";

import { NOTIFICATION_CENTER_PAGE_SIZE, useNotifications } from "./useNotifications";

// Shares NotificationCenter's exact query params (page 1, unreadOnly false, the same pageSize)
// so the two resolve to one React Query cache entry -- pageSize is part of the query key, so a
// mismatched value here silently reintroduces a second, redundant /notifications request
// whenever both are mounted on the same screen (they usually are: NotificationCenter lives in
// the persistent shell header, this badge is used inside page-level headers rendered alongside
// it, e.g. client Home and both apps' Inbox pages).
export const useNotificationBadge = () => {
  const { meta, isLoading } = useNotifications({
    page: 1,
    pageSize: NOTIFICATION_CENTER_PAGE_SIZE,
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
