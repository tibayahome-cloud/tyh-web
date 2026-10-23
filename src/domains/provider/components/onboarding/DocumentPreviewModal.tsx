import { useEffect, useState } from "react";
import { isAxiosError } from "axios";

import { Button } from "../../../../shared/components/Button";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import { api } from "../../../../shared/libs/api";

type Props = {
  /** The document's own address, or null when nothing is being viewed. */
  source: string | null;
  title: string;
  onClose: () => void;
};

/** Shows an uploaded document the provider sent, fetched with their own sign-in, with a way to download it. */
export const DocumentPreviewModal = ({ source, title, onClose }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source) return;
    let endpoint = source;
    if (endpoint.startsWith("/api/")) endpoint = endpoint.replace(/^\/api\/v1/, "");
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    api
      .get(endpoint, { responseType: "blob", signal: controller.signal })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (isAxiosError(err) && err.code === "ERR_CANCELED") return;
        setError("We could not open this document. Try again.");
      })
      .finally(() => setLoading(false));
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [source]);

  const download = () => {
    if (!source) return;
    const resolved = source.startsWith("/api/") ? `${window.location.origin}${source}` : source;
    window.open(resolved, "_blank", "noopener,noreferrer");
  };

  return (
    <Modal open={Boolean(source)} onClose={onClose} title={title} maxWidth="lg">
      <div className="space-y-4">
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <Loading />
          </div>
        ) : error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
        ) : url ? (
          <iframe key={url} src={url} title={title} className="h-[60vh] w-full rounded-lg border border-slate-200" />
        ) : (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">No document to show.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="min-h-[44px]" onClick={onClose}>
            Close
          </Button>
          <Button className="min-h-[44px]" onClick={download} disabled={!source}>
            Download
          </Button>
        </div>
      </div>
    </Modal>
  );
};
