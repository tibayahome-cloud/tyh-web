import type { PropsWithChildren } from "react";

type StickyActionBarProps = {
  align?: "start" | "center" | "end" | "between";
};

const alignmentClass: Record<NonNullable<StickyActionBarProps["align"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between"
};

export const StickyActionBar = ({ align = "end", children }: PropsWithChildren<StickyActionBarProps>) => {
  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40">
      <div className="pointer-events-auto mx-auto max-w-6xl px-4 pb-6">
        <div className={`flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm sm:flex-row ${alignmentClass[align]}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default StickyActionBar;
