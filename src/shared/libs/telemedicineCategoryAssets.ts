import type { LucideIcon } from "lucide-react";
import {
  Ambulance,
  Baby,
  Bone,
  BrainCircuit,
  CalendarClock,
  ClipboardPlus,
  HandHeart,
  Heart,
  HeartPulse,
  LayoutGrid,
  Leaf,
  Ribbon,
  ScanFace,
  Stethoscope
} from "lucide-react";

// The backend has no image/icon field on categories, subcategories, or services (confirmed by
// reading telemedicineCatalog.ts's mappers and the admin catalog editor's form) -- this is a
// frontend-only visual layer keyed off the stable `key` strings the API already returns. `image`
// is left undefined everywhere for now: no photography exists yet for these five categories, and
// shipping a placeholder would be worse than the icon+tint fallback below. When real artwork
// lands, filling in `image` here is the only change needed; nothing else in this map's contract
// changes.
export type TelemedicineVisualAsset = {
  key: string;
  label: string;
  Icon: LucideIcon;
  image?: string;
  bgClass: string;
  iconClass: string;
};

// Keyed on the five real category keys (queried from the live catalog), not the specialty-level
// names shown in the reference mock -- see the analysis this implements: 38 subcategories would
// mean 38 images to source and maintain, for a set that grows whenever admin.super adds one.
const CATEGORY_ASSETS: Record<string, TelemedicineVisualAsset> = {
  firstcare: {
    key: "firstcare",
    label: "FirstCare",
    Icon: Stethoscope,
    bgClass: "bg-sky-50",
    iconClass: "text-sky-600"
  },
  specialistcare: {
    key: "specialistcare",
    label: "SpecialistCare",
    Icon: HeartPulse,
    bgClass: "bg-rose-50",
    iconClass: "text-rose-600"
  },
  wellnesscare: {
    key: "wellnesscare",
    label: "WellnessCare",
    Icon: Leaf,
    bgClass: "bg-emerald-50",
    iconClass: "text-emerald-600"
  },
  careconnect: {
    key: "careconnect",
    label: "CareConnect",
    Icon: Ambulance,
    bgClass: "bg-amber-50",
    iconClass: "text-amber-600"
  },
  continucare: {
    key: "continucare",
    label: "ContinuCare",
    Icon: CalendarClock,
    bgClass: "bg-violet-50",
    iconClass: "text-violet-600"
  }
};

// A small, deliberately incomplete set of well-known specialties (subcategory keys) that benefit
// from a more specific icon than their parent category's. Anything not listed here -- including
// every future specialty -- falls back to the parent category's asset, which is always correct
// because every subcategory belongs to exactly one category.
const SPECIALTY_ASSETS: Record<string, TelemedicineVisualAsset> = {
  cardiology: {
    key: "cardiology",
    label: "Cardiology",
    Icon: Heart,
    bgClass: "bg-rose-50",
    iconClass: "text-rose-600"
  },
  paediatrics: {
    key: "paediatrics",
    label: "Paediatrics",
    Icon: Baby,
    bgClass: "bg-sky-50",
    iconClass: "text-sky-600"
  },
  dermatology: {
    key: "dermatology",
    label: "Dermatology",
    Icon: ScanFace,
    bgClass: "bg-amber-50",
    iconClass: "text-amber-600"
  },
  neurology: {
    key: "neurology",
    label: "Neurology",
    Icon: BrainCircuit,
    bgClass: "bg-violet-50",
    iconClass: "text-violet-600"
  },
  oncology: {
    key: "oncology",
    label: "Oncology",
    Icon: Ribbon,
    bgClass: "bg-fuchsia-50",
    iconClass: "text-fuchsia-600"
  },
  orthopaedics: {
    key: "orthopaedics",
    label: "Orthopaedics",
    Icon: Bone,
    bgClass: "bg-stone-100",
    iconClass: "text-stone-600"
  },
  "psychology-counselling": {
    key: "psychology-counselling",
    label: "Psychology and Counselling",
    Icon: HandHeart,
    bgClass: "bg-emerald-50",
    iconClass: "text-emerald-600"
  }
};

// Neutral, not one of the five brand tints -- an unrecognized or newly-created category must
// read as "unstyled yet," not as a sixth category with its own identity.
const FALLBACK_ASSET: TelemedicineVisualAsset = {
  key: "fallback",
  label: "Consultation",
  Icon: ClipboardPlus,
  bgClass: "bg-slate-100",
  iconClass: "text-slate-500"
};

// The "All services" tile is deliberately not one of the five category assets -- it isn't a
// category, and reusing e.g. FirstCare's icon for it would misrepresent it as one.
export const TELEMEDICINE_ALL_SERVICES_ASSET: TelemedicineVisualAsset = {
  key: "all",
  label: "All services",
  Icon: LayoutGrid,
  bgClass: "bg-slate-100",
  iconClass: "text-slate-600"
};

export const getTelemedicineCategoryAsset = (key: string | null | undefined): TelemedicineVisualAsset =>
  (key && CATEGORY_ASSETS[key]) || FALLBACK_ASSET;

// A service card's visual: prefer a specific specialty icon when this subcategory is one of the
// well-known ones above, otherwise fall back to its parent category's asset (never a generic
// icon while a real category is known -- that would throw away information the card already has).
export const getTelemedicineSpecialtyAsset = (
  subcategoryKey: string | null | undefined,
  categoryKey: string | null | undefined
): TelemedicineVisualAsset =>
  (subcategoryKey && SPECIALTY_ASSETS[subcategoryKey]) || getTelemedicineCategoryAsset(categoryKey);
