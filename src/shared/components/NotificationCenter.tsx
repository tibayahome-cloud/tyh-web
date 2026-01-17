import { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { useLocation, useNavigate } from "react-router-dom";

import { useNotifications } from "../hooks/useNotifications";
import type { Notification } from "../schemas/notification";
import { Button } from "./Button";
import { Loading } from "./Loading";

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const formatRelativeTime = (iso: string | null) => {
  if (!iso) {
    return "";
  }
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "";
  }
  const diffMs = timestamp - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const intervals: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"]
  ];

  let value = diffSec;
  let unit: Intl.RelativeTimeFormatUnit = "second";

  for (const [amount, nextUnit] of intervals) {
    if (Math.abs(value) < amount || nextUnit === "year") {
      unit = nextUnit;
      break;
    }
    value /= amount;
    unit = nextUnit;
  }

  return rtf.format(Math.round(value), unit);
};

type NotificationCenterProps = {
  pageSize?: number;
};

export const NotificationCenter = ({ pageSize = 10 }: NotificationCenterProps) => {
  const {
    notifications,
    meta,
    isLoading,
    isFetching,
    markAsRead,
    markAllAsRead,
    isMarkingRead,
    refetch
  } = useNotifications({ page: 1, pageSize });

  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const unreadCount = useMemo(() => {
    if (meta?.unread !== undefined) {
      return meta.unread;
    }
    return notifications.filter((item) => !item.readAt).length;
  }, [meta?.unread, notifications]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickAway = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
    };
  }, [open]);

  const handleToggle = () => {
    setOpen((value) => {
      const next = !value;
      if (!value && !notifications.length) {
        refetch().catch(() => {});
      }
      return next;
    });
  };

  const handleMarkRead = (notification: Notification) => {
    if (notification.readAt) {
      return;
    }
    markAsRead([notification.id]);
  };

  const handleMarkAll = () => {
    markAllAsRead();
  };

  const basePath = location.pathname.startsWith("/admin")
    ? "/admin"
    : location.pathname.startsWith("/pro")
    ? "/pro"
    : "/app";

  const handleViewAll = () => {
    setOpen(false);
    navigate(`${basePath}/notifications`);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={classNames(
          "relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-primary-200 hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
          { "animate-pulse": unreadCount > 0 }
        )}
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-rose-600 px-1 text-[0.65rem] font-black uppercase tracking-wide text-white shadow-lg">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-20 z-40 max-h-[70vh] rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:right-0 sm:top-full sm:mt-3 sm:w-96 sm:max-h-[32rem] sm:inset-x-auto">
          <div className="flex max-h-[70vh] flex-col sm:max-h-[32rem]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                <p className="text-xs text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refetch().catch(() => {})}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 focus:outline-none"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={isMarkingRead || unreadCount === 0}
                  className={classNames(
                    "text-xs font-medium focus:outline-none",
                    unreadCount === 0 ? "text-slate-300" : "text-primary-600 hover:text-primary-700"
                  )}
                >
                  Mark all read
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loading label="Loading notifications" />
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState isFetching={isFetching} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <Button variant="secondary" className="flex-1 px-3 py-1.5 text-sm sm:flex-none" onClick={handleViewAll}>
                View all
              </Button>
              <Button variant="ghost" className="flex-1 px-3 py-1.5 text-sm sm:flex-none" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

type NotificationItemProps = {
  notification: Notification;
  onMarkRead: (notification: Notification) => void;
};

const NotificationItem = ({ notification, onMarkRead }: NotificationItemProps) => {
  const isUnread = !notification.readAt;
  const timestamp = notification.readAt ?? notification.deliveredAt ?? notification.createdAt;
  return (
    <li
      className={classNames("px-4 py-3 transition", {
        "bg-primary-50/60": isUnread,
        "hover:bg-slate-50": !isUnread
      })}
    >
      <div className="flex items-start gap-3">
        <span
          className={classNames("mt-1 h-2.5 w-2.5 rounded-full", {
            "bg-primary-500": isUnread,
            "bg-slate-300": !isUnread
          })}
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">{notification.title || "Notification"}</p>
          {notification.eventName && (
            <p className="text-xs uppercase tracking-wide text-primary-500">{notification.eventName}</p>
          )}
          {notification.body && (
            <p
              className="mt-1 overflow-hidden text-sm text-slate-600"
              style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}
            >
              {notification.body}
            </p>
          )}
          {timestamp && (
            <p className="mt-2 text-xs text-slate-400">{formatRelativeTime(timestamp)}</p>
          )}
        </div>
        {isUnread && (
          <button
            type="button"
            onClick={() => onMarkRead(notification)}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 focus:outline-none"
          >
            Mark read
          </button>
        )}
      </div>
    </li>
  );
};

const EmptyState = ({ isFetching }: { isFetching: boolean }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
    <BellSlashIcon className="h-8 w-8 text-slate-300" />
    <p className="text-sm font-medium text-slate-600">
      {isFetching ? "Checking for updates…" : "No notifications right now"}
    </p>
    <p className="text-xs text-slate-400">You'll see alerts here when something needs your attention.</p>
  </div>
);

const BellIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M10 2a5 5 0 0 0-5 5v2.586l-.707.707A1 1 0 0 0 4 12h12a1 1 0 0 0 .707-1.707L16 9.586V7a5 5 0 0 0-5-5zm0 16a3 3 0 0 0 2.995-2.824L13 15H7a3 3 0 0 0 2.824 2.995L10 18z" />
  </svg>
);

const BellSlashIcon = ({ className }: { className?: string }) => (
  <svg className={classNames("h-6 w-6", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path
      d="M13.73 21a2 2 0 0 1-3.46 0M18 8a6 6 0 0 0-9.33-5M5 5a6 6 0 0 0-.14 1.3c0 4.22-1.72 6.32-2.86 7.18A1 1 0 0 0 2.5 15H18m3 4L3 1"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
