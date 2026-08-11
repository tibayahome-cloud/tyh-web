import { useEffect, useRef, useState } from "react";
import { PhoneOff, X } from "lucide-react";

import { Button } from "./Button";
import { Loading } from "./Loading";
import { useAuth } from "../hooks/useAuth";
import { useConfirmSessionJoinMutation, useEndSessionMutation, useJoinSessionMutation } from "../hooks/useTelemedicine";
import type { TelemedicineSessionJoin } from "../schemas/telemedicine";

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
  if (window.JitsiMeetExternalAPI) {
    loadedDomains.add(domain);
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
  const hasLeftRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);
  const [joinDetails, setJoinDetails] = useState<TelemedicineSessionJoin | null>(null);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const joinMutation = useJoinSessionMutation();
  const confirmJoinMutation = useConfirmSessionJoinMutation();
  const endSessionMutation = useEndSessionMutation();

  const leaveLocalCall = () => {
    if (hasLeftRef.current) {
      return;
    }
    hasLeftRef.current = true;
    apiRef.current?.dispose();
    apiRef.current = null;
    onLeave();
  };

  useEffect(() => {
    let cancelled = false;
    hasLeftRef.current = false;

    const setup = async () => {
      try {
        const join = await joinMutation.mutateAsync(bookingId);
        if (cancelled) return;
        setJoinDetails(join);
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
          configOverwrite: { prejoinPageEnabled: false },
          interfaceConfigOverwrite: {
            APP_NAME: "Tiba Ya Home",
            NATIVE_APP_NAME: "Tiba Ya Home",
            PROVIDER_NAME: "Tiba Ya Home",
            SHOW_BRAND_WATERMARK: false,
            SHOW_JITSI_WATERMARK: false,
            SHOW_POWERED_BY: false,
            SHOW_WATERMARK_FOR_GUESTS: false
          }
        });
        apiRef.current = api;
        // This is the real attendance signal: a token was issued above, but that only proves
        // authorization, not that the browser actually reached the room (blocked WebRTC, the
        // Jitsi deployment being down, etc. can all fail silently after the token is minted).
        const handleJoined = () => {
          confirmJoinMutation.mutate(bookingId);
        };
        api.addEventListener("readyToClose", leaveLocalCall);
        api.addEventListener("videoConferenceLeft", leaveLocalCall);
        api.addEventListener("videoConferenceJoined", handleJoined);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setConnectionError(err instanceof Error ? err.message : "Unable to join the call.");
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
    leaveLocalCall();
  };

  const handleEndConsultation = async () => {
    setEndError(null);
    setIsEndingSession(true);
    try {
      await endSessionMutation.mutateAsync(bookingId);
      leaveLocalCall();
    } catch (err) {
      setEndError(err instanceof Error ? err.message : "Unable to end the consultation.");
      setIsEndingSession(false);
    }
  };
  const canEndConsultation = joinDetails?.role === "provider";

  return (
    <div className="fixed left-0 right-0 top-[var(--app-header-height,0px)] bottom-[var(--app-bottom-nav-height,0px)] z-[2000] flex min-h-0 flex-col overflow-hidden bg-slate-950 lg:left-[var(--app-sidebar-width,0px)] lg:bottom-0">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-2 text-white">
        <span className="text-sm font-semibold">Consultation call</span>
        <div className="flex items-center gap-2">
          {canEndConsultation && (
            <button
              type="button"
              onClick={handleEndConsultation}
              disabled={isEndingSession}
              title="End consultation for both participants"
              className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <PhoneOff size={14} />
              {isEndingSession ? "Ending..." : "End consultation"}
            </button>
          )}
          <button
            type="button"
            onClick={handleManualLeave}
            title="Leave this call screen"
            className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
          >
            <X size={14} />
            Leave
          </button>
        </div>
      </div>
      {endError && <div className="bg-red-950 px-4 py-2 text-sm font-medium text-red-100">{endError}</div>}
      {loading && (
        <div className="flex flex-1 items-center justify-center text-white">
          <Loading label="Connecting to your consultation…" />
        </div>
      )}
      {connectionError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-sm">{connectionError}</p>
          <Button type="button" variant="secondary" onClick={onLeave}>
            Close
          </Button>
        </div>
      )}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-hidden"
        style={{ display: loading || connectionError ? "none" : "block" }}
      />
    </div>
  );
};

export default TelemedicineCallPanel;
