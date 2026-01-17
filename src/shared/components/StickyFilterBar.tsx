import classNames from "classnames";
import type { PropsWithChildren } from "react";

type StickyFilterBarProps = {
  align?: "start" | "center" | "end" | "between";
};

const alignmentClass: Record<NonNullable<StickyFilterBarProps["align"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between"
};

export const StickyFilterBar = ({ align = "between", children }: PropsWithChildren<StickyFilterBarProps>) => {
  return (
    <div className="sticky top-24 z-30 -mx-6 mb-6 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
      <div className={classNames("flex flex-col gap-4 sm:flex-row sm:items-center", alignmentClass[align])}>{children}</div>
    </div>
  );
};

export default StickyFilterBar;
