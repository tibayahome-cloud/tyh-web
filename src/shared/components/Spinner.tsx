import clsx from "classnames";

type SpinnerSize = "sm" | "md" | "lg";
type SpinnerTone = "brand" | "neutral" | "inverted";

type SpinnerProps = {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  className?: string;
  label?: string;
};

const sizeMap: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-[3px]",
  lg: "h-8 w-8 border-[3px]"
};

const toneMap: Record<SpinnerTone, string> = {
  brand: "border-brand-500 border-t-transparent",
  neutral: "border-neutral-300 border-t-transparent",
  inverted: "border-white border-t-transparent"
};

export const Spinner = ({ size = "md", tone = "brand", className, label }: SpinnerProps) => (
  <span
    className={clsx("inline-block animate-spin rounded-full", sizeMap[size], toneMap[tone], className)}
    role="status"
    aria-live="polite"
    aria-label={label ?? "Loading"}
  />
);

export default Spinner;
