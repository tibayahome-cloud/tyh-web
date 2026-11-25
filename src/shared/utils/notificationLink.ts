export type AppArea = "/app" | "/pro" | "/admin";

/**
 * Where tapping a notification should go, for the part of the app the person is in. Built from ids only: a notification
 * carries a conversation id or a booking id, never content, and each area has its own pages for them.
 */
export const notificationPath = (data: Record<string, unknown> | null | undefined, area: AppArea): string | null => {
  if (!data) return null;
  const threadId = typeof data.thread_id === "string" && data.thread_id ? data.thread_id : null;
  if (threadId) {
    return area === "/admin" ? `/admin/conversations/${threadId}` : `${area}/inbox/${threadId}`;
  }
  const bookingId = typeof data.booking_id === "string" && data.booking_id ? data.booking_id : null;
  if (bookingId) {
    return `${area}/bookings/${bookingId}`;
  }
  return null;
};

export const areaFromPath = (pathname: string): AppArea =>
  pathname.startsWith("/admin") ? "/admin" : pathname.startsWith("/pro") ? "/pro" : "/app";
