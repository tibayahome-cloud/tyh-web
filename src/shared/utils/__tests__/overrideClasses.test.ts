import { describe, expect, it } from "vitest";

import { withoutOverriddenColours } from "../overrideClasses";

const base = "bg-tiba-blue text-white shadow-elevated hover:bg-blue-800 focus-visible:ring-tiba-blue/40";

describe("withoutOverriddenColours", () => {
  it("leaves the base alone when nothing overrides it", () => {
    expect(withoutOverriddenColours(base, undefined)).toBe(base);
    expect(withoutOverriddenColours(base, "h-12 rounded-2xl shadow-xl")).toBe(base);
  });

  it("drops the base background and text colour when the caller supplies its own", () => {
    expect(withoutOverriddenColours(base, "bg-white text-brand-600")).toBe(
      "shadow-elevated hover:bg-blue-800 focus-visible:ring-tiba-blue/40"
    );
  });

  it("matches state variants separately: a hover override drops only the base hover", () => {
    expect(withoutOverriddenColours(base, "hover:bg-slate-50")).toBe(
      "bg-tiba-blue text-white shadow-elevated focus-visible:ring-tiba-blue/40"
    );
  });

  it("treats a background with an alpha and an arbitrary colour as backgrounds", () => {
    expect(withoutOverriddenColours("bg-tiba-blue", "bg-white/60")).toBe("");
    expect(withoutOverriddenColours("bg-tiba-blue", "bg-[#fff]")).toBe("");
  });

  it("does not mistake text size, alignment or wrapping for a text colour", () => {
    expect(withoutOverriddenColours(base, "text-sm text-center text-[12px] text-nowrap")).toBe(base);
  });

  it("does not mistake border width or style for a border colour", () => {
    const outline = "border-2 border-slate-200 text-slate-700";
    expect(withoutOverriddenColours(outline, "border-4 border-dashed")).toBe(outline);
    expect(withoutOverriddenColours(outline, "border-none")).toBe(outline);
    expect(withoutOverriddenColours(outline, "border-red-400")).toBe("border-2 text-slate-700");
  });

  it("keeps side borders separate from the all-sides border", () => {
    expect(withoutOverriddenColours("border-slate-200 border-b-slate-100", "border-b-red-400")).toBe("border-slate-200");
  });

  it("leaves non-colour background utilities alone", () => {
    expect(withoutOverriddenColours("bg-cover bg-tiba-blue", "bg-white")).toBe("bg-cover");
  });
});
