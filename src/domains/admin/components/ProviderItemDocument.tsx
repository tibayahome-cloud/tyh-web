import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "../../../shared/components/Button";
import { useToast } from "../../../shared/components/ToastProvider";
import { api } from "../../../shared/libs/api";

type Props = {
  applicationId: string;
  itemId: string;
  /** What the paper is called, for the button and the messages. */
  label: string;
  hasFile: boolean;
  /** Some papers (a licence) must carry the date they run out; the API asks for it. */
  hasExpiry: boolean;
  expiresOn: string | null;
  onUploaded: () => void;
};

const ACCEPT = "application/pdf,image/jpeg,image/png";

/**
 * Lets an administrator add or replace one of a provider's documents for them, and open what is on file.
 * The server decides who may: a super admin for any provider, a facility admin for their own facility's.
 */
export const ProviderItemDocument = ({ applicationId, itemId, label, hasFile, hasExpiry, expiresOn, onUploaded }: Props) => {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [expiry, setExpiry] = useState(expiresOn ?? "");
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      if (hasExpiry && expiry) form.append("expires_on", expiry);
      await api.post(`/provider-applications/${applicationId}/items/${itemId}/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    },
    onSuccess: () => {
      toast.showToast({
        title: "Document added",
        description: `${label} is on file for this provider and waits for review.`,
        variant: "success"
      });
      onUploaded();
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Could not add the document",
        description: error instanceof Error ? error.message : "Try again, with a PDF, JPG or PNG under 10 MB.",
        variant: "error"
      });
    }
  });

  const choose = () => {
    if (hasExpiry && !expiry) {
      setExpiryError("Enter the date this document runs out, then choose the file.");
      return;
    }
    setExpiryError(null);
    fileInput.current?.click();
  };

  const open = async () => {
    // The tab opens at once, while the tap is still counted, then loads the document, so a pop-up blocker lets it through.
    const tab = window.open("", "_blank");
    setOpening(true);
    try {
      const response = await api.get(`/provider-applications/${applicationId}/items/${itemId}/file`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (error) {
      tab?.close();
      toast.showToast({
        title: "Could not open the document",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {hasExpiry && (
        <div className="max-w-xs">
          <label htmlFor={`expiry-${itemId}`} className="block text-xs font-medium text-slate-700">
            Runs out on
          </label>
          <input
            id={`expiry-${itemId}`}
            type="date"
            value={expiry}
            onChange={(event) => {
              setExpiry(event.target.value);
              setExpiryError(null);
            }}
            aria-invalid={Boolean(expiryError)}
            aria-describedby={expiryError ? `expiry-error-${itemId}` : undefined}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
          {expiryError && (
            <p id={`expiry-error-${itemId}`} className="mt-1 text-xs text-red-600">
              {expiryError}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="min-h-[44px] px-3 text-xs"
          onClick={choose}
          loading={upload.isPending}
          disabled={upload.isPending}
        >
          {hasFile ? `Replace ${label}` : `Add ${label}`}
        </Button>
        {hasFile && (
          <Button variant="ghost" className="min-h-[44px] px-3 text-xs" onClick={open} disabled={opening}>
            View {label}
          </Button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label={`Choose a file for ${label}`}
        data-testid={`file-${itemId}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload.mutate(file);
        }}
      />
    </div>
  );
};
