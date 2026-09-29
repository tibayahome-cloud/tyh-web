import { useState } from "react";

import type { TelemedicineVisualAsset } from "../libs/telemedicineCategoryAssets";

type TelemedicineServiceVisualProps = {
  asset: TelemedicineVisualAsset;
  // "md" is a service-card thumbnail, "sm" a compact summary row, "lg" fills its grid cell. All
  // are squares so the image never changes the layout when it loads (or fails and swaps to the icon).
  size?: "lg" | "md" | "sm";
  // The visible service name sits next to this visual, so it is decorative (alt="") unless a
  // caller places it somewhere the picture is the only cue.
  decorative?: boolean;
  className?: string;
};

const BOX_CLASS = {
  lg: "aspect-square w-full",
  md: "h-14 w-14 sm:h-16 sm:w-16",
  sm: "h-10 w-10"
} as const;

const ICON_CLASS = {
  lg: "h-8 w-8",
  md: "h-6 w-6",
  sm: "h-5 w-5"
} as const;

// Renders the service's picture when the resolver supplied one, otherwise (or when the file fails
// to load) the icon + tint tile the catalog already used. Meaning always comes from adjacent text.
export const TelemedicineServiceVisual = ({
  asset,
  size = "md",
  decorative = true,
  className = ""
}: TelemedicineServiceVisualProps) => {
  // Track which src failed rather than a bare boolean so a card that is re-used for a different
  // service (list re-render on filter) does not stay stuck on the icon.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const Icon = asset.Icon;
  const showImage = Boolean(asset.image) && failedSrc !== asset.image;

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${BOX_CLASS[size]} ${asset.bgClass} ${className}`}
      data-visual-source={showImage ? "image" : "icon"}
    >
      {showImage ? (
        <img
          src={asset.image}
          alt={decorative ? "" : asset.imageAlt ?? ""}
          width={256}
          height={256}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(asset.image ?? null)}
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <Icon className={`${ICON_CLASS[size]} ${asset.iconClass}`} aria-hidden="true" />
      )}
    </span>
  );
};
