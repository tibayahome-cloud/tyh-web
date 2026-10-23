import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Mic } from "lucide-react";

import { Button } from "./Button";
import { friendlyMediaError } from "../utils/callJoin";

type PreCallCheckProps = {
  inAppBrowser: boolean;
  onJoin: () => void;
  onCancel: () => void;
};

type CheckState = "idle" | "checking" | "ready" | "blocked";

const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((track) => track.stop());

// A short step before the call: switch on the camera and microphone here, where a blocked permission
// or a missing device can be explained, instead of inside the call where it looks like a frozen screen.
// The preview is stopped before joining so the call can take the devices itself.
export const PreCallCheck = ({ inAppBrowser, onJoin, onCancel }: PreCallCheckProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CheckState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMic, setHasMic] = useState(false);

  const release = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => release, [release]);

  const check = async () => {
    release();
    setMessage(null);
    setState("checking");
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("blocked");
      setMessage(friendlyMediaError(new Error("unsupported"), inAppBrowser));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
      streamRef.current = stream;
      setHasCamera(stream.getVideoTracks().length > 0);
      setHasMic(stream.getAudioTracks().length > 0);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setState("ready");
    } catch (err) {
      setState("blocked");
      setMessage(friendlyMediaError(err, inAppBrowser));
    }
  };

  const join = () => {
    release();
    onJoin();
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-5 py-6 text-center text-white">
      <h2 className="text-xl font-bold">Before you join</h2>
      <p className="max-w-sm text-sm text-slate-200">
        Check that your camera and microphone work. Nothing is recorded or shared until you join.
      </p>

      <div className="aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl bg-slate-800 sm:aspect-video sm:max-w-md">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Your camera preview"
          className={state === "ready" && hasCamera ? "h-full w-full -scale-x-100 object-cover" : "hidden"}
        />
        {!(state === "ready" && hasCamera) && (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Camera size={40} aria-hidden="true" />
          </div>
        )}
      </div>

      {state === "ready" && (
        <ul className="flex gap-4 text-sm" aria-label="Device check">
          <li className="flex items-center gap-1.5">
            <Camera size={16} aria-hidden="true" />
            Camera {hasCamera ? "works" : "not found"}
          </li>
          <li className="flex items-center gap-1.5">
            <Mic size={16} aria-hidden="true" />
            Microphone {hasMic ? "works" : "not found"}
          </li>
        </ul>
      )}

      {message && (
        <p role="alert" className="max-w-sm rounded-lg bg-red-950 px-3 py-2 text-sm text-red-100">
          {message}
        </p>
      )}

      <div className="flex w-full max-w-xs flex-col gap-2">
        {state === "ready" ? (
          <Button type="button" onClick={join} className="min-h-[48px]">
            Join now
          </Button>
        ) : (
          <Button type="button" onClick={() => void check()} disabled={state === "checking"} className="min-h-[48px]">
            {state === "checking" ? "Checking…" : state === "blocked" ? "Try again" : "Allow camera and microphone"}
          </Button>
        )}
        {state === "blocked" && (
          <Button type="button" variant="secondary" onClick={join} className="min-h-[48px]">
            Join without camera
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onCancel} className="min-h-[48px]">
          Not now
        </Button>
      </div>
    </div>
  );
};

export default PreCallCheck;
