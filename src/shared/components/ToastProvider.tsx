import type {
  ReactNode} from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from "react";
import classNames from "classnames";

export type ToastVariant = "info" | "success" | "error";

export type ToastOptions = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type Toast = ToastOptions & { id: string };

type ToastContextValue = {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
};

const DEFAULT_DURATION = 5000;

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

type ToastProviderProps = {
  children: ReactNode;
};

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    if (typeof window !== "undefined") {
      const timerId = timers.current[id];
      if (timerId) {
        window.clearTimeout(timerId);
        delete timers.current[id];
      }
    }
  }, []);

  const scheduleDismiss = useCallback(
    (toast: Toast) => {
      if (typeof window === "undefined") {
        return;
      }
      const duration = toast.duration ?? DEFAULT_DURATION;
      if (duration <= 0) {
        return;
      }
      timers.current[toast.id] = window.setTimeout(() => {
        dismissToast(toast.id);
      }, duration);
    },
    [dismissToast]
  );

  const showToast = useCallback(
    (options: ToastOptions) => {
      const toast: Toast = {
        id: createId(),
        title: options.title,
        description: options.description,
        variant: options.variant ?? "info",
        duration: options.duration ?? DEFAULT_DURATION
      };
      setToasts((prev) => [...prev, toast]);
      scheduleDismiss(toast);
      return toast.id;
    },
    [scheduleDismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast
    }),
    [dismissToast, showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[1000] flex justify-center md:justify-end md:pr-6">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

type ToastCardProps = {
  toast: Toast;
  onDismiss: (id: string) => void;
};

const variantClasses: Record<ToastVariant, string> = {
  info: "border-primary-100 bg-white text-slate-800",
  success: "border-emerald-100 bg-emerald-50 text-emerald-900",
  error: "border-rose-100 bg-rose-50 text-rose-900"
};

const ToastCard = ({ toast, onDismiss }: ToastCardProps) => {
  return (
    <div
      role="status"
      className={classNames(
        "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg transition",
        variantClasses[toast.variant ?? "info"]
      )}
    >
      <div className="flex-1">
        {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
        {toast.description && <p className="mt-1 text-xs text-slate-600">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="ml-2 text-xs font-medium text-slate-500 transition hover:text-slate-700 focus:outline-none"
      >
        Close
      </button>
    </div>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
};
