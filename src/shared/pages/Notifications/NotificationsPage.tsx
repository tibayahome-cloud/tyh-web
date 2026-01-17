import { useEffect, useMemo, useState } from "react";

import { useNotifications, useNotificationPreferences } from "../../hooks/useNotifications";
import { Button } from "../../components/Button";
import { Loading } from "../../components/Loading";
import { NotificationPreferencesPanel } from "../../components/NotificationPreferencesPanel";

const PAGE_SIZE = 10;

const formatDateTime = (iso: string | null) => {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
};

export const NotificationsPage = () => {
  const [page, setPage] = useState(1);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");

  const { notifications, meta, isLoading, isFetching, markAsRead, markAllAsRead } = useNotifications({
    page,
    pageSize: PAGE_SIZE,
    unreadOnly: showUnreadOnly
  });
  const { preferences } = useNotificationPreferences();

  useEffect(() => {
    setPage(1);
  }, [showUnreadOnly, eventFilter]);

  const filteredNotifications = useMemo(() => {
    const eventKey = eventFilter === "all" ? null : eventFilter;
    const query = search.trim().toLowerCase();
    return notifications.filter((notification) => {
      if (eventKey && notification.eventKey !== eventKey) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = `${notification.title ?? ""} ${notification.body ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [eventFilter, notifications, search]);

  const totalPages = meta?.totalPages ?? 1;

  const eventOptions = useMemo(() => {
    const entries =
      preferences
        .map((pref) => ({
          key: pref.event?.key,
          name: pref.event?.name ?? pref.event?.key ?? "Unknown event"
        }))
        .filter((entry): entry is { key: string; name: string } => Boolean(entry.key)) ?? [];
    return entries;
  }, [preferences]);

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Notifications</h1>
              <p className="text-sm text-slate-500">Review recent alerts, mark them as read, and search by event.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  checked={showUnreadOnly}
                  onChange={(event) => setShowUnreadOnly(event.target.checked)}
                />
                Unread only
              </label>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={eventFilter}
                onChange={(event) => setEventFilter(event.target.value)}
              >
                <option value="all">All events</option>
                {eventOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.name}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notifications"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 md:w-60"
              />
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-sm"
                onClick={() => setSearch("")}
                disabled={!search}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="mt-4 flex justify-between text-xs text-slate-500">
            <span>
              Showing {filteredNotifications.length} of {meta?.total ?? filteredNotifications.length} notifications
            </span>
            <span>{isFetching && !isLoading ? "Updating…" : ""}</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loading label="Loading notifications" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No notifications match your filters.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredNotifications.map((notification) => (
                <li key={notification.id} className="flex flex-col gap-2 px-6 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {notification.title || "Untitled notification"}
                      </span>
                      {notification.eventName && (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600">
                          {notification.eventName}
                        </span>
                      )}
                    </div>
                    {notification.body && <p className="mt-1 text-sm text-slate-600">{notification.body}</p>}
                    <p className="mt-2 text-xs text-slate-400">
                      Created {formatDateTime(notification.createdAt)}{" "}
                      {notification.readAt ? `• Read ${formatDateTime(notification.readAt)}` : "• Unread"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notification.readAt && (
                      <Button variant="ghost" className="px-3 py-1 text-sm" onClick={() => markAsRead([notification.id])}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-sm"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
            <Button variant="primary" className="px-3 py-1.5 text-sm" onClick={() => markAllAsRead()}>
              Mark all read
            </Button>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Delivery preferences</h2>
          <p className="mt-1 text-xs text-slate-500">
            Choose how you receive alerts for each event. Snoozing pauses a channel temporarily.
          </p>
        </div>
        <NotificationPreferencesPanel />
      </aside>
    </div>
  );
};

export default NotificationsPage;
