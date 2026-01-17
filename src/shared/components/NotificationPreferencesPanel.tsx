import { useMemo, useState } from "react";
import classNames from "classnames";
import { ChevronDown } from "lucide-react";

import { useNotificationPreferences } from "../hooks/useNotifications";
import type { NotificationEventPreference } from "../schemas/notification";
import { Loading } from "./Loading";
import { Button } from "./Button";
import { useToast } from "./ToastProvider";

const CHANNEL_LABELS: Record<string, string> = {
  in_app: "In-App",
  email: "Email",
  sms: "SMS",
  push: "Push"
};

type SnoozeOption = {
  label: string;
  value: string;
  durationMs: number | null;
};

const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: "No snooze", value: "none", durationMs: null },
  { label: "1 hour", value: "1h", durationMs: 60 * 60 * 1000 },
  { label: "8 hours", value: "8h", durationMs: 8 * 60 * 60 * 1000 },
  { label: "24 hours", value: "24h", durationMs: 24 * 60 * 60 * 1000 }
];

const matchSnoozeOption = (iso: string | null) => {
  if (!iso) {
    return "none";
  }
  const target = Date.parse(iso);
  if (Number.isNaN(target)) {
    return "custom";
  }
  const now = Date.now();
  const diff = target - now;
  for (const option of SNOOZE_OPTIONS) {
    if (option.durationMs === null) {
      continue;
    }
    if (Math.abs(diff - option.durationMs) < 60_000) {
      return option.value;
    }
  }
  return "custom";
};

const buildSnoozeTimestamp = (durationMs: number | null) => {
  if (durationMs === null) {
    return null;
  }
  const date = new Date(Date.now() + durationMs);
  return date.toISOString();
};

type TogglePayload = {
  eventKey: string;
  channel: string;
  enabled: boolean;
};

type SnoozePayload = {
  eventKey: string;
  channel: string;
  snoozedUntil: string | null;
  enabled: boolean;
};

type NotificationPreferencesPanelProps = {
  filter?: (preference: NotificationEventPreference) => boolean;
  variant?: "stacked" | "accordion";
};

export const NotificationPreferencesPanel = ({ filter, variant = "stacked" }: NotificationPreferencesPanelProps = {}) => {
  const { preferences, isLoading, isUpdating, updatePreferences } = useNotificationPreferences();
  const { showToast } = useToast();
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  const handleToggle = async ({ eventKey, channel, enabled }: TogglePayload) => {
    try {
      await updatePreferences([{ eventKey, channel, enabled }]);
      showToast({
        title: "Preferences updated",
        description: `${CHANNEL_LABELS[channel] ?? channel} ${enabled ? "enabled" : "disabled"} for ${eventKey}`
      });
    } catch (error) {
      showToast({
        title: "Unable to update preference",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "error"
      });
    }
  };

  const handleSnooze = async ({ eventKey, channel, snoozedUntil, enabled }: SnoozePayload) => {
    try {
      await updatePreferences([{ eventKey, channel, enabled, snoozedUntil }]);
      showToast({
        title: "Snooze updated",
        description: snoozedUntil
          ? `${CHANNEL_LABELS[channel] ?? channel} snoozed until ${new Date(snoozedUntil).toLocaleString()}`
          : `${CHANNEL_LABELS[channel] ?? channel} unsnoozed`
      });
    } catch (error) {
      showToast({
        title: "Unable to update snooze",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "error"
      });
    }
  };

  const filteredPreferences = useMemo(() => {
    if (!preferences.length) {
      return [];
    }
    if (!filter) {
      return preferences;
    }
    return preferences.filter((preference) => filter(preference));
  }, [preferences, filter]);

  const toggleEntry = (key: string) => {
    setOpenState((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderChannelControls = (preference: NotificationEventPreference) => {
    const channels = preference.channels ?? [];
    if (!channels.length) {
      return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          No channels available for this event.
        </div>
      );
    }

    return channels.map((channel) => {
      const label = CHANNEL_LABELS[channel.channel] ?? channel.channel;
      const snoozeValue = matchSnoozeOption(channel.snoozedUntil ?? null);
      const effectiveEnabled =
        channel.enabled || (channel.snoozedUntil !== null && channel.snoozedUntil !== undefined);

      return (
        <div
          key={channel.channel}
          className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="text-sm font-medium text-slate-700">{label}</p>
            <p className="text-xs text-slate-500">
              Source: {channel.source ?? "default"}{" "}
              {channel.snoozedUntil ? `• Snoozed until ${new Date(channel.snoozedUntil).toLocaleString()}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                checked={effectiveEnabled}
                disabled={isUpdating || preference.event?.allowUserToggle === false || !preference.event?.key}
                onChange={(event) =>
                  handleToggle({
                    eventKey: preference.event?.key ?? "",
                    channel: channel.channel,
                    enabled: event.target.checked
                  })
                }
              />
              Enabled
            </label>
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isUpdating || !effectiveEnabled || !preference.event?.key}
              value={snoozeValue}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  return;
                }
                const option = SNOOZE_OPTIONS.find((entry) => entry.value === event.target.value);
                const iso = option ? buildSnoozeTimestamp(option.durationMs) : null;
                handleSnooze({
                  eventKey: preference.event?.key ?? "",
                  channel: channel.channel,
                  enabled: effectiveEnabled,
                  snoozedUntil: iso
                });
              }}
            >
              {SNOOZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {channel.snoozedUntil && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isUpdating}
                onClick={() =>
                  handleSnooze({
                    eventKey: preference.event?.key ?? "",
                    channel: channel.channel,
                    enabled: true,
                    snoozedUntil: null
                  })
                }
              >
                Clear snooze
              </Button>
            )}
          </div>
        </div>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loading label="Loading preferences" />
      </div>
    );
  }

  if (!filteredPreferences.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Notification preferences will appear here once events are available.
      </div>
    );
  }

  if (variant === "accordion") {
    return (
      <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white">
        {filteredPreferences.map((preference) => {
          const eventKey = preference.event?.key ?? preference.event?.name ?? "event";
          const eventName = preference.event?.name ?? eventKey;
          const description = preference.event?.description ?? "";
          const isOpen = openState[eventKey] ?? false;
          return (
            <div key={eventKey} className="p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => toggleEntry(eventKey)}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{eventName}</p>
                  {preference.event?.category && (
                    <p className="text-xs uppercase tracking-wide text-primary-500">{preference.event.category}</p>
                  )}
                  {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
                </div>
                <ChevronDown
                  className={classNames(
                    "h-5 w-5 text-slate-500 transition-transform duration-200",
                    isOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>
              {isOpen && <div className="mt-4 space-y-3">{renderChannelControls(preference)}</div>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {filteredPreferences.map((preference) => {
        const eventKey = preference.event?.key ?? preference.event?.name ?? "event";
        const eventName = preference.event?.name ?? eventKey;
        const description = preference.event?.description ?? "";
        return (
          <div key={eventKey} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{eventName}</p>
                {preference.event?.category && (
                  <p className="text-xs uppercase tracking-wide text-primary-500">{preference.event.category}</p>
                )}
                {description && <p className="mt-2 text-xs text-slate-500">{description}</p>}
              </div>
              {preference.event?.critical === true && (
                <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-600">
                  Critical
                </span>
              )}
            </div>
            <div className="space-y-3">{renderChannelControls(preference)}</div>
          </div>
        );
      })}
    </div>
  );
};
