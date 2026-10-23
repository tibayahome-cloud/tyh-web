// Tailwind decides between two classes that set the same property by their order in the stylesheet, not by
// their order on the element. A shared component that sets `bg-tiba-blue text-white` and a page that adds
// `bg-white text-brand-600` therefore get whichever the stylesheet declares later, which for text-white is the
// page's loss: a white label on a white button. This drops the component's own colour classes when the caller
// supplies one for the same property and state, so the caller always wins.
//
// It covers only what pages override in practice: background, text colour and border colour, including the
// hover, focus and other state variants. Everything else is left alone.

const TEXT_NOT_COLOUR = /^(xs|sm|base|lg|xl|[2-9]xl|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|opacity-\d+)$/;
const BG_NOT_COLOUR = /^(opacity-\d+|clip-|fixed$|local$|scroll$|center$|top$|bottom$|left$|right$|cover$|contain$|no-repeat$|repeat|origin-|blend-|gradient-|none$)/;
const BORDER_NOT_COLOUR = /^(\d+|solid|dashed|dotted|double|hidden|none|collapse|separate|spacing-|opacity-\d+|\[\d+(px|rem|em)?\])$/;

const isColourValue = (value: string): boolean => {
  if (value.startsWith("[")) return /#|rgb|hsl|var\(/.test(value);
  return true;
};

type Parsed = { variants: string; group: string } | null;

// "hover:bg-white/60" -> { variants: "hover:", group: "bg" }. Null when the class is not one of the three.
const parse = (token: string): Parsed => {
  const parts = token.split(":");
  const utilityRaw = parts[parts.length - 1].replace(/^!/, "");
  const variants = parts.slice(0, -1).join(":") + (parts.length > 1 ? ":" : "");
  const withoutAlpha = utilityRaw.replace(/\/\d+$/, "");

  if (withoutAlpha.startsWith("bg-")) {
    const rest = withoutAlpha.slice(3);
    return BG_NOT_COLOUR.test(rest) || !isColourValue(rest) ? null : { variants, group: "bg" };
  }
  if (withoutAlpha.startsWith("text-")) {
    const rest = withoutAlpha.slice(5);
    return TEXT_NOT_COLOUR.test(rest) || !isColourValue(rest) ? null : { variants, group: "text" };
  }
  const border = /^border(?:-([xytrblse]))?-(.+)$/.exec(withoutAlpha);
  if (border) {
    const [, side = "", rest] = border;
    return BORDER_NOT_COLOUR.test(rest) || !isColourValue(rest) ? null : { variants, group: `border-${side}` };
  }
  return null;
};

const tokens = (value: string | undefined): string[] => (value ?? "").split(/\s+/).filter(Boolean);

/** `base` without the colour classes that `overrides` replaces. Does not include the overrides themselves. */
export const withoutOverriddenColours = (base: string, overrides: string | undefined): string => {
  const replaced = new Set<string>();
  tokens(overrides).forEach((token) => {
    const parsed = parse(token);
    if (parsed) replaced.add(`${parsed.variants}${parsed.group}`);
  });
  if (replaced.size === 0) return base;
  return tokens(base)
    .filter((token) => {
      const parsed = parse(token);
      return !(parsed && replaced.has(`${parsed.variants}${parsed.group}`));
    })
    .join(" ");
};
