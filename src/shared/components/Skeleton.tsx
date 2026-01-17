import clsx from "classnames";

type SkeletonRadius = "sm" | "md" | "lg" | "pill";

type SkeletonProps = {
  className?: string;
  height?: number | string;
  width?: number | string;
  rounded?: SkeletonRadius;
  shimmer?: boolean;
};

const radiusClass: Record<SkeletonRadius, string> = {
  sm: "rounded-md",
  md: "rounded-xl",
  lg: "rounded-3xl",
  pill: "rounded-pill"
};

export const Skeleton = ({
  className,
  height = "1rem",
  width = "100%",
  rounded = "md",
  shimmer = true
}: SkeletonProps) => (
  <div
    className={clsx("relative overflow-hidden bg-neutral-100", radiusClass[rounded], className)}
    style={{ height, width }}
    aria-hidden
  >
    {shimmer && (
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent animate-shimmer" />
    )}
  </div>
);

export default Skeleton;
