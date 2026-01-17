import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import classNames from "classnames";
import { ChevronDown, MapPin, Settings2, Sparkles } from "lucide-react";

import { NotificationPreferencesPanel } from "../../../shared/components/NotificationPreferencesPanel";
import { Button } from "../../../shared/components/Button";
import { useAuth } from "../../../shared/hooks/useAuth";
import api from "../../../shared/libs/api";
import { useToast } from "../../../shared/components/ToastProvider";
import type { NotificationEventPreference } from "../../../shared/schemas/notification";

type ClientLocationSettings = {
  label?: string;
  instructions?: string;
  lat?: number | null;
  lng?: number | null;
  shareLiveLocation?: boolean;
};

type ClientSelfCareSettings = {
  mindfulReminders?: boolean;
  shareProviderTips?: boolean;
  journalPrompts?: boolean;
};

type ClientSettings = {
  location?: ClientLocationSettings;
  selfCare?: ClientSelfCareSettings;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const extractClientSettings = (meta: Record<string, unknown> | null | undefined): ClientSettings => {
  if (!meta || !isRecord(meta)) {
    return {};
  }
  const raw = meta.client_settings;
  if (!isRecord(raw)) {
    return {};
  }

  const locationRaw = raw.location;
  const selfCareRaw = raw.selfCare;

  const location = isRecord(locationRaw)
    ? {
        label: typeof locationRaw.label === "string" ? locationRaw.label : "",
        instructions: typeof locationRaw.instructions === "string" ? locationRaw.instructions : "",
        lat: typeof locationRaw.lat === "number" ? locationRaw.lat : null,
        lng: typeof locationRaw.lng === "number" ? locationRaw.lng : null,
        shareLiveLocation:
          typeof locationRaw.shareLiveLocation === "boolean" ? locationRaw.shareLiveLocation : true
      }
    : undefined;

  const selfCare = isRecord(selfCareRaw)
    ? {
        mindfulReminders:
          typeof selfCareRaw.mindfulReminders === "boolean" ? selfCareRaw.mindfulReminders : true,
        shareProviderTips:
          typeof selfCareRaw.shareProviderTips === "boolean" ? selfCareRaw.shareProviderTips : true,
        journalPrompts: typeof selfCareRaw.journalPrompts === "boolean" ? selfCareRaw.journalPrompts : false
      }
    : undefined;

  return { location, selfCare };
};

const SettingsAccordionSection = ({
  id,
  title,
  description,
  icon,
  isOpen,
  onToggle,
  children
}: {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}) => (
  <div className="rounded-[32px] border border-slate-100 bg-white shadow-card">
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <ChevronDown
        className={classNames(
          "h-5 w-5 text-slate-500 transition-transform duration-200",
          isOpen ? "rotate-180" : "rotate-0"
        )}
      />
    </button>
    {isOpen && <div className="border-t border-slate-100 px-5 py-5">{children}</div>}
  </div>
);

const ToggleRow = ({
  label,
  helper,
  value,
  onChange
}: {
  label: string;
  helper: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) => (
  <label className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
    <div>
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="text-xs text-slate-500">{helper}</p>
    </div>
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={classNames(
        "relative inline-flex h-6 w-11 items-center rounded-full border transition",
        value ? "border-emerald-400 bg-emerald-500" : "border-slate-200 bg-white"
      )}
    >
      <span
        className={classNames(
          "h-4 w-4 transform rounded-full bg-white shadow transition",
          value ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  </label>
);

const ClientSettingsPage = () => {
  const { user, bootstrapMe } = useAuth();
  const toast = useToast();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const clientSettings = useMemo(() => extractClientSettings(user?.meta ?? null), [user?.meta]);
  const settingsRef = useRef<ClientSettings>(clientSettings);

  useEffect(() => {
    settingsRef.current = clientSettings;
  }, [clientSettings]);

  const [locationForm, setLocationForm] = useState(() => ({
    label: clientSettings.location?.label ?? "",
    instructions: clientSettings.location?.instructions ?? "",
    lat: clientSettings.location?.lat?.toString() ?? "",
    lng: clientSettings.location?.lng?.toString() ?? "",
    shareLiveLocation: clientSettings.location?.shareLiveLocation ?? true
  }));
  const [selfCareForm, setSelfCareForm] = useState(() => ({
    mindfulReminders: clientSettings.selfCare?.mindfulReminders ?? true,
    shareProviderTips: clientSettings.selfCare?.shareProviderTips ?? true,
    journalPrompts: clientSettings.selfCare?.journalPrompts ?? false
  }));

  useEffect(() => {
    setLocationForm({
      label: clientSettings.location?.label ?? "",
      instructions: clientSettings.location?.instructions ?? "",
      lat: clientSettings.location?.lat?.toString() ?? "",
      lng: clientSettings.location?.lng?.toString() ?? "",
      shareLiveLocation: clientSettings.location?.shareLiveLocation ?? true
    });
  }, [clientSettings.location]);

  useEffect(() => {
    setSelfCareForm({
      mindfulReminders: clientSettings.selfCare?.mindfulReminders ?? true,
      shareProviderTips: clientSettings.selfCare?.shareProviderTips ?? true,
      journalPrompts: clientSettings.selfCare?.journalPrompts ?? false
    });
  }, [clientSettings.selfCare]);

  const updateSettings = useMutation<unknown, unknown, { settings: ClientSettings; message: string }>({
    mutationFn: async ({ settings }) => {
      if (!user?.id) {
        throw new Error("Missing user id");
      }
      await api.patch(`/users/${user.id}`, {
        meta_data: {
          client_settings: settings
        }
      });
    },
    onSuccess: async (_, { message }) => {
      await bootstrapMe();
      toast.showToast({
        title: "Settings updated",
        description: message ?? "Saved successfully."
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    }
  });

  const persistSettings = (patch: Partial<ClientSettings>, message: string) => {
    const next = {
      ...settingsRef.current,
      ...patch
    };
    updateSettings.mutate({ settings: next, message });
  };

  const handleLocationSave = (event: React.FormEvent) => {
    event.preventDefault();
    const latValue = locationForm.lat ? Number(locationForm.lat) : null;
    const lngValue = locationForm.lng ? Number(locationForm.lng) : null;
    const normalizedLat = typeof latValue === "number" && Number.isFinite(latValue) ? latValue : null;
    const normalizedLng = typeof lngValue === "number" && Number.isFinite(lngValue) ? lngValue : null;
    persistSettings(
      {
        location: {
          label: locationForm.label,
          instructions: locationForm.instructions,
          lat: normalizedLat,
          lng: normalizedLng,
          shareLiveLocation: locationForm.shareLiveLocation
        }
      },
      "We’ll use this as your preferred pickup point."
    );
  };

  const handleSelfCareSave = () => {
    persistSettings(
      {
        selfCare: {
          mindfulReminders: selfCareForm.mindfulReminders,
          shareProviderTips: selfCareForm.shareProviderTips,
          journalPrompts: selfCareForm.journalPrompts
        }
      },
      "Self-care nudges updated."
    );
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.showToast({
        title: "Location unavailable",
        description: "Your device does not support geolocation.",
        variant: "error"
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationForm((prev) => ({
          ...prev,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6)
        }));
        toast.showToast({
          title: "Location captured",
          description: "We filled in your coordinates. Don’t forget to save."
        });
      },
      (error) => {
        toast.showToast({
          title: "Permission required",
          description: error.message,
          variant: "error"
        });
      }
    );
  };

  const clientNotificationFilter = useCallback((preference: NotificationEventPreference) => {
    const key = preference.event?.key?.toLowerCase() ?? "";
    const category = preference.event?.category?.toLowerCase() ?? "";
    return key.includes("client") || category.includes("client");
  }, []);

  return (
    <div className="space-y-6">
      <SettingsAccordionSection
        id="notifications"
        title="Notification preferences"
        description="Control alerts about bookings, updates, and care tips."
        icon={<Settings2 className="h-5 w-5" />}
        isOpen={Boolean(openSections.notifications)}
        onToggle={toggleSection}
      >
        <NotificationPreferencesPanel filter={clientNotificationFilter} variant="accordion" />
      </SettingsAccordionSection>

      <SettingsAccordionSection
        id="location"
        title="Default location"
        description="Save your go-to address for faster booking."
        icon={<MapPin className="h-5 w-5" />}
        isOpen={Boolean(openSections.location)}
        onToggle={toggleSection}
      >
        <form className="space-y-4" onSubmit={handleLocationSave}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="location-label">
              Label
            </label>
            <input
              id="location-label"
              value={locationForm.label}
              onChange={(event) => setLocationForm((prev) => ({ ...prev, label: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              placeholder="Home, parent's place, etc."
            />
          </div>
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              htmlFor="location-instructions"
            >
              Directions or notes
            </label>
            <textarea
              id="location-instructions"
              value={locationForm.instructions}
              onChange={(event) => setLocationForm((prev) => ({ ...prev, instructions: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              rows={3}
              placeholder="Apartment, gate code, care instructions..."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="latitude">
                Latitude
              </label>
              <input
                id="latitude"
                type="number"
                value={locationForm.lat}
                onChange={(event) => setLocationForm((prev) => ({ ...prev, lat: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="-1.2921"
                step="0.000001"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="longitude">
                Longitude
              </label>
              <input
                id="longitude"
                type="number"
                value={locationForm.lng}
                onChange={(event) => setLocationForm((prev) => ({ ...prev, lng: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="36.8219"
                step="0.000001"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                checked={locationForm.shareLiveLocation}
                onChange={(event) =>
                  setLocationForm((prev) => ({ ...prev, shareLiveLocation: event.target.checked }))
                }
              />
              Share live location with providers when travelling
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={handleUseCurrentLocation}>
              Use current location
            </Button>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={updateSettings.isPending}>
              Save location
            </Button>
          </div>
        </form>
      </SettingsAccordionSection>

      <SettingsAccordionSection
        id="selfcare"
        title="Self-care settings"
        description="Choose what the AI companion should remind you about."
        icon={<Sparkles className="h-5 w-5" />}
        isOpen={Boolean(openSections.selfcare)}
        onToggle={toggleSection}
      >
        <div className="space-y-4">
          <ToggleRow
            label="Mindful reminders"
            helper="Gentle nudges to stretch, hydrate, and check in with yourself."
            value={selfCareForm.mindfulReminders}
            onChange={(next) => setSelfCareForm((prev) => ({ ...prev, mindfulReminders: next }))}
          />
          <ToggleRow
            label="Provider tips"
            helper="Share anonymous feedback to receive curated tips from your care team."
            value={selfCareForm.shareProviderTips}
            onChange={(next) => setSelfCareForm((prev) => ({ ...prev, shareProviderTips: next }))}
          />
          <ToggleRow
            label="Journal prompts"
            helper="Receive a nightly summary prompt to log symptoms or mood."
            value={selfCareForm.journalPrompts}
            onChange={(next) => setSelfCareForm((prev) => ({ ...prev, journalPrompts: next }))}
          />
          <div className="flex justify-end">
            <Button onClick={handleSelfCareSave} loading={updateSettings.isPending}>
              Save preferences
            </Button>
          </div>
        </div>
      </SettingsAccordionSection>
    </div>
  );
};

export default ClientSettingsPage;
