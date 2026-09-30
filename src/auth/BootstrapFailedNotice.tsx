type BootstrapFailedNoticeProps = {
  onRetry: () => void;
};

// Shown once useBoundedBootstrap exhausts its automatic retries. Kept as its own component so
// LegalConsentGate and LegalConsentPage present the same failure copy and control, even though
// each wraps it in its own layout.
export const BootstrapFailedNotice = ({ onRetry }: BootstrapFailedNoticeProps) => (
  <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-3 px-4 text-center">
    <p className="text-sm font-medium text-slate-700">
      We couldn&apos;t verify your account. Check your connection and try again.
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      Try again
    </button>
  </div>
);
