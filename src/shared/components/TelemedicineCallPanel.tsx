import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Button } from "./Button";
import { Loading } from "./Loading";
import { useAuth } from "../hooks/useAuth";
import { useEndSessionMutation, useJoinSessionMutation } from "../hooks/useTelemedicine";

interface JitsiMeetExternalAPIInstance {
  dispose: () => void;
  addEventListener: (event: string, listener: (...args: unknown[]) => void) => void;
}

type JitsiMeetExternalAPIConstructor = new (
  domain: string,
  options: Record<string, unknown>
) => JitsiMeetExternalAPIInstance;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiMeetExternalAPIConstructor;
  }
}

const loadedDomains = new Set<string>();

const loadJitsiScript = (domain: string): Promise<void> => {
  if (window.JitsiMeetExternalAPI && loadedDomains.has(domain)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-jitsi-domain="${domain}"]`);
    if (existing) {
      if (window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load the video call script")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.dataset.jitsiDomain = domain;
    script.onload = () => {
      loadedDomains.add(domain);
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load the video call script"));
    document.body.appendChild(script);
  });
};

type TelemedicineCallPanelProps = {
  bookingId: string;
  onLeave: () => void;
};

// Self-hosted Jitsi, backend-issued opaque room + short-lived JWT (see the Telemedicine Plan's
// session-boundary decisions). This component never invents a room name or token itself -- it
// only renders what useJoinSessionMutation returns.
export const TelemedicineCallPanel = ({ bookingId, onLeave }: TelemedicineCallPanelProps) => {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<JitsiMeetExternalAPIInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const joinMutation = useJoinSessionMutation();
  const endSessionMutation = useEndSessionMutation();

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const join = await joinMutation.mutateAsync(bookingId);
        if (cancelled) return;
        await loadJitsiScript(join.domain);
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) {
          return;
        }
        const api = new window.JitsiMeetExternalAPI(join.domain, {
          roomName: join.roomName,
          jwt: join.token,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName: user?.fullName ?? "Participant" },
          configOverwrite: { prejoinPageEnabled: false }
        });
        apiRef.current = api;
        const handleLeft = () => {
          endSessionMutation.mutate(bookingId);
          onLeave();
        };
        api.addEventListener("readyToClose", handleLeft);
        api.addEventListener("videoConferenceLeft", handleLeft);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to join the call.");
          setLoading(false);
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // Only re-run when the target booking changes -- join/end mutations are stable identities
    // from react-query and re-running on every render would tear down and rejoin the call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const handleManualLeave = () => {
    apiRef.current?.dispose();
    apiRef.current = null;
    endSessionMutation.mutate(bookingId);
    onLeave();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-slate-950">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-2 text-white">
        <span className="text-sm font-semibold">Consultation call</span>
        <button
          type="button"
          onClick={handleManualLeave}
          className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
        >
          <X size={14} />
          Leave
        </button>
      </div>
      {loading && (
        <div className="flex flex-1 items-center justify-center text-white">
          <Loading label="Connecting to your consultation…" />
        </div>
      )}
      {error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-sm">{error}</p>
          <Button type="button" variant="secondary" onClick={onLeave}>
            Close
          </Button>
        </div>
      )}
      <div ref={containerRef} className="flex-1" style={{ display: loading || error ? "none" : "block" }} />
    </div>
  );
};

export default TelemedicineCallPanel;
