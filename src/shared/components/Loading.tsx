import { Spinner } from "./Spinner";

interface LoadingProps {
  label?: string;
  fullHeight?: boolean;
  tone?: "brand" | "neutral" | "inverted";
}

export const Loading = ({ label = "Loading…", fullHeight = false, tone = "brand" }: LoadingProps) => (
  <div
    className={`flex w-full items-center justify-center gap-3 ${fullHeight ? "min-h-[200px]" : ""}`}
    role="status"
    aria-live="polite"
  >
    <Spinner tone={tone === "inverted" ? "inverted" : tone === "neutral" ? "neutral" : "brand"} />
    <span
      className={`text-sm font-medium ${
        tone === "inverted" ? "text-white" : tone === "neutral" ? "text-neutral-500" : "text-brand-700"
      }`}
    >
      {label}
    </span>
  </div>
);
