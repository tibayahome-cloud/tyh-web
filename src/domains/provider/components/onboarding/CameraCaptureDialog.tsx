import { useCallback, useEffect, useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

import { Button } from "../../../../shared/components/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

const MAX_WIDTH = 1600;

const explain = (error: unknown): string => {
  const name = (error as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "The camera is blocked. Allow it from the lock icon next to the address, then try again, or choose a file instead.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device. Choose a file instead.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return "The camera could not start. Choose a file instead.";
};

/**
 * A camera preview for computers. Phones open their own camera from the file picker, but a browser on a laptop
 * ignores that and shows the file list, so here the browser asks for camera permission and the photo is taken on the page.
 */
export const CameraCaptureDialog = ({ open, onClose, onCapture }: Props) => {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play?.();
        }
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(explain(err));
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop]);

  const capture = () => {
    const el = video.current;
    if (!el || !el.videoWidth) return;
    const scale = Math.min(1, MAX_WIDTH / el.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(el.videoWidth * scale);
    canvas.height = Math.round(el.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(el, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("The photo could not be saved. Try again.");
          return;
        }
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onClose();
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="camera-title">
      <DialogTitle id="camera-title">Take a photo of your document</DialogTitle>
      <DialogContent>
        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
            {error}
          </p>
        ) : (
          <>
            <video ref={video} playsInline muted aria-label="Camera preview" className="aspect-[4/3] w-full rounded-xl bg-slate-900 object-cover" />
            {!ready && <p className="mt-2 text-sm text-slate-700">Allow the camera when your browser asks.</p>}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button type="button" variant="secondary" className="min-h-[44px]" onClick={onClose}>
          Cancel
        </Button>
        {!error && (
          <Button type="button" className="min-h-[44px]" disabled={!ready} onClick={capture}>
            Take photo
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
