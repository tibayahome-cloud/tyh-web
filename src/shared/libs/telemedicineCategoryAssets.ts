import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Baby,
  Building2,
  Bone,
  Camera,
  BrainCircuit,
  CalendarClock,
  Clock,
  ClipboardList,
  ClipboardPlus,
  FileHeart,
  FileText,
  HandHeart,
  Heart,
  HeartHandshake,
  HeartPulse,
  LayoutGrid,
  Map,
  MessageSquare,
  Navigation,
  Leaf,
  Network,
  PhoneCall,
  Ribbon,
  ScanFace,
  ShieldCheck,
  Siren,
  Star,
  Stethoscope,
  Target,
  TestTube2,
  UserCheck,
  Wallet,
  Zap
} from "lucide-react";

import cancerCareImage from "../../assets/images/telemedicine/cancer-care.webp";
import childGrowthReviewImage from "../../assets/images/telemedicine/child-growth-review.webp";
import chronicDiseaseCareImage from "../../assets/images/telemedicine/chronic-disease-care.webp";
import dermatologyImage from "../../assets/images/telemedicine/dermatology.webp";
import entConsultationImage from "../../assets/images/telemedicine/ent-consultation.webp";
import generalConsultationImage from "../../assets/images/telemedicine/general-consultation.webp";
import imagingReviewImage from "../../assets/images/telemedicine/imaging-review.webp";
import labResultsReviewImage from "../../assets/images/telemedicine/lab-results-review.webp";
import labTestGuidanceImage from "../../assets/images/telemedicine/lab-test-guidance.webp";
import maternityCareImage from "../../assets/images/telemedicine/maternity-care.webp";
import medicationReviewImage from "../../assets/images/telemedicine/medication-review.webp";
import mentalHealthSupportImage from "../../assets/images/telemedicine/mental-health-support.webp";
import nutritionAdviceImage from "../../assets/images/telemedicine/nutrition-advice.webp";
import paediatricConsultationImage from "../../assets/images/telemedicine/paediatric-consultation.webp";
import physiotherapyImage from "../../assets/images/telemedicine/physiotherapy.webp";
import womensHealthImage from "../../assets/images/telemedicine/womens-health.webp";
import generatedPostHospitalisationReviewImage from "../../assets/images/telemedicine/generated/post-hospitalisation-review.webp";
import generatedPostOperativeWoundGuidanceImage from "../../assets/images/telemedicine/generated/post-operative-wound-guidance.webp";
import generatedSecondMedicalOpinionImage from "../../assets/images/telemedicine/generated/second-medical-opinion.webp";
import generatedSpecialistFollowUpImage from "../../assets/images/telemedicine/generated/specialist-follow-up.webp";
import generatedCardiologyConsultationImage from "../../assets/images/telemedicine/generated/cardiology-consultation.webp";
import generatedNeurologyConsultationImage from "../../assets/images/telemedicine/generated/neurology-consultation.webp";
import generatedEndocrinologyConsultationImage from "../../assets/images/telemedicine/generated/endocrinology-consultation.webp";
import generatedUrologyConsultationImage from "../../assets/images/telemedicine/generated/urology-consultation.webp";
import generatedGastroenterologyConsultationImage from "../../assets/images/telemedicine/generated/gastroenterology-consultation.webp";
import generatedNephrologyConsultationImage from "../../assets/images/telemedicine/generated/nephrology-consultation.webp";
import generatedInternalMedicineConsultationImage from "../../assets/images/telemedicine/generated/internal-medicine-consultation.webp";
import generatedOccupationalTherapyConsultationImage from "../../assets/images/telemedicine/generated/occupational-therapy-consultation.webp";
import generatedSpeechTherapyConsultationImage from "../../assets/images/telemedicine/generated/speech-therapy-consultation.webp";
import generatedHomeCareAssessmentImage from "../../assets/images/telemedicine/generated/home-care-assessment.webp";
import generatedCareNavigationImage from "../../assets/images/telemedicine/generated/care-navigation.webp";
import generatedSurgeryCoordinationImage from "../../assets/images/telemedicine/generated/surgery-coordination.webp";
import generatedEndoscopyReviewImage from "../../assets/images/telemedicine/generated/endoscopy-review.webp";
import generatedClinicalOfficerConsultationImage from "../../assets/images/telemedicine/generated/clinical-officer-consultation.webp";
import generatedTreatmentMonitoringImage from "../../assets/images/telemedicine/generated/treatment-monitoring.webp";
import generatedLifestyleWellnessImage from "../../assets/images/telemedicine/generated/lifestyle-wellness.webp";
import generatedSpecialistTreatmentReviewImage from "../../assets/images/telemedicine/generated/specialist-treatment-review.webp";
import generatedCareCoordinationImage from "../../assets/images/telemedicine/generated/care-coordination.webp";
import generatedDischargePlanReviewImage from "../../assets/images/telemedicine/generated/discharge-plan-review.webp";
import generatedPostOperativeReviewImage from "../../assets/images/telemedicine/generated/post-operative-review.webp";
import generatedCardiacReportReviewImage from "../../assets/images/telemedicine/generated/cardiac-report-review.webp";
import generatedNeurologicalReportReviewImage from "../../assets/images/telemedicine/generated/neurological-report-review.webp";
import generatedOrthopaedicConsultationImage from "../../assets/images/telemedicine/generated/orthopaedic-consultation.webp";
import generatedUrologyFollowUpImage from "../../assets/images/telemedicine/generated/urology-follow-up.webp";
import generatedSpecialistSecondOpinionImage from "../../assets/images/telemedicine/generated/specialist-second-opinion.webp";

// The backend has no image/icon field on categories, subcategories, or services (confirmed by
// reading telemedicineCatalog.ts's mappers and the admin catalog editor's form) -- this is a
// frontend-only visual layer keyed off the stable `key` strings the API already returns. Every
// entry keeps an icon + tint (it is what renders for services with no dedicated image, and what
// a failed image load falls back to); `image`/`imageAlt` are layered on top by
// getTelemedicineServiceAsset below.
export type TelemedicineVisualAsset = {
  key: string;
  label: string;
  Icon: LucideIcon;
  image?: string;
  // Describes the picture for the places where it carries meaning on its own. Catalog rows render
  // the image as decorative (alt="") because the service name sits right beside it.
  imageAlt?: string;
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
  "mental-health": {
    key: "mental-health",
    label: "Mental Health",
    Icon: BrainCircuit,
    bgClass: "bg-indigo-50",
    iconClass: "text-indigo-600"
  },
  careconnect: {
    key: "careconnect",
    label: "CareConnect",
    // Deliberately neutral: an ambulance glyph would imply emergency transport, which is not part
    // of the telemedicine catalog (CareConnect covers referral, pharmacy, lab and imaging guidance).
    Icon: Network,
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
  },
  psychiatry: {
    key: "psychiatry",
    label: "Psychiatry",
    Icon: BrainCircuit,
    bgClass: "bg-indigo-50",
    iconClass: "text-indigo-600"
  }
};

// Neutral, not one of the five brand tints -- an unrecognized or newly-created category must
// read as "unstyled yet," not as a sixth category with its own identity. A single fixed fallback
// looked fine against the restored dev DB's five categories, but production has categories
// created ad hoc through the admin catalog editor (e.g. "General Medicine", "Mental Health") that
// aren't in CATEGORY_ASSETS at all -- with one fallback, every one of those collapses onto the
// same icon and tint, so two visibly different categories become indistinguishable from each
// other in the tile row. A small neutral palette, picked deterministically from the category's
// own key, keeps unknown categories visually distinct from each other (and stable across
// reloads) without claiming a specific identity the way a real CATEGORY_ASSETS entry would.
const FALLBACK_PALETTE: TelemedicineVisualAsset[] = [
  { key: "fallback-clipboard", label: "Consultation", Icon: ClipboardPlus, bgClass: "bg-slate-100", iconClass: "text-slate-500" },
  { key: "fallback-file-heart", label: "Consultation", Icon: FileHeart, bgClass: "bg-zinc-100", iconClass: "text-zinc-500" },
  { key: "fallback-clipboard-list", label: "Consultation", Icon: ClipboardList, bgClass: "bg-stone-100", iconClass: "text-stone-500" },
  { key: "fallback-heart-handshake", label: "Consultation", Icon: HeartHandshake, bgClass: "bg-neutral-100", iconClass: "text-neutral-500" }
];

// A small, stable string hash -- not cryptographic, just needs to spread short category-key
// strings evenly across FALLBACK_PALETTE and return the same index every time for the same key.
const hashKey = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

const fallbackAssetForKey = (key: string | null | undefined): TelemedicineVisualAsset =>
  key ? FALLBACK_PALETTE[hashKey(key) % FALLBACK_PALETTE.length] : FALLBACK_PALETTE[0];

const DISTINCT_ICON_SERVICE_KEYS = new Set([
  "home-care-assessment", "home-care-coordination", "facility-care-navigation", "hospital-referral-coordination",
  "surgery-referral-consultation", "surgical-care-coordination", "care-coordination-follow-up", "long-term-care-planning",
  "discharge-plan-review", "post-hospitalisation-review", "post-operative-review", "post-operative-wound-guidance",
  "second-medical-opinion", "specialist-second-opinion", "specialist-follow-up-consultation", "specialist-treatment-review",
  "recovery-monitoring-consultation", "treatment-progress-review", "cardiac-report-review", "cardiology-consultation",
  "endocrinology-consultation", "digestive-health-consultation", "endoscopy-report-review", "internal-medicine-consultation",
  "chronic-kidney-disease-follow-up", "kidney-health-consultation", "neurological-report-review", "neurology-consultation",
  "orthopaedic-consultation", "urology-consultation", "urology-follow-up", "lifestyle-wellness-consultation",
  "wellness-follow-up", "occupational-therapy-assessment", "occupational-therapy-follow-up", "speech-therapy-follow-up",
  "speech-language-assessment"
]);

const DISTINCT_SERVICE_ICON_PALETTE: Array<Pick<TelemedicineVisualAsset, "Icon" | "bgClass" | "iconClass">> = [
  { Icon: Activity, bgClass: "bg-cyan-50", iconClass: "text-cyan-600" },
  { Icon: Building2, bgClass: "bg-blue-50", iconClass: "text-blue-600" },
  { Icon: Camera, bgClass: "bg-fuchsia-50", iconClass: "text-fuchsia-600" },
  { Icon: Clock, bgClass: "bg-slate-100", iconClass: "text-slate-600" },
  { Icon: FileText, bgClass: "bg-amber-50", iconClass: "text-amber-600" },
  { Icon: Map, bgClass: "bg-lime-50", iconClass: "text-lime-700" },
  { Icon: MessageSquare, bgClass: "bg-sky-50", iconClass: "text-sky-600" },
  { Icon: Navigation, bgClass: "bg-orange-50", iconClass: "text-orange-600" },
  { Icon: PhoneCall, bgClass: "bg-green-50", iconClass: "text-green-600" },
  { Icon: ShieldCheck, bgClass: "bg-teal-50", iconClass: "text-teal-600" },
  { Icon: Siren, bgClass: "bg-red-50", iconClass: "text-red-600" },
  { Icon: Star, bgClass: "bg-yellow-50", iconClass: "text-yellow-600" },
  { Icon: Target, bgClass: "bg-violet-50", iconClass: "text-violet-600" },
  { Icon: TestTube2, bgClass: "bg-emerald-50", iconClass: "text-emerald-600" },
  { Icon: UserCheck, bgClass: "bg-indigo-50", iconClass: "text-indigo-600" },
  { Icon: Wallet, bgClass: "bg-purple-50", iconClass: "text-purple-600" },
  { Icon: Zap, bgClass: "bg-pink-50", iconClass: "text-pink-600" },
  { Icon: HandHeart, bgClass: "bg-rose-50", iconClass: "text-rose-600" }
];

const serviceIconAssetForKey = (serviceKey: string): TelemedicineVisualAsset => {
  const visual = DISTINCT_SERVICE_ICON_PALETTE[hashKey(serviceKey) % DISTINCT_SERVICE_ICON_PALETTE.length];
  return { key: serviceKey, label: "Telemedicine service", ...visual };
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
  (key && CATEGORY_ASSETS[key]) || fallbackAssetForKey(key);

// A service card's visual: prefer a specific specialty icon when this subcategory is one of the
// well-known ones above, otherwise fall back to its parent category's asset (never a generic
// icon while a real category is known -- that would throw away information the card already has).
// Only when neither is known does this reach for the hashed fallback, keyed on whichever of the
// two is present -- the subcategory key is more specific, so it wins when both are unknown.
export const getTelemedicineSpecialtyAsset = (
  subcategoryKey: string | null | undefined,
  categoryKey: string | null | undefined
): TelemedicineVisualAsset => {
  if (subcategoryKey && SPECIALTY_ASSETS[subcategoryKey]) {
    return SPECIALTY_ASSETS[subcategoryKey];
  }
  if (categoryKey && CATEGORY_ASSETS[categoryKey]) {
    return CATEGORY_ASSETS[categoryKey];
  }
  return fallbackAssetForKey(subcategoryKey ?? categoryKey);
};

type TelemedicineImage = { src: string; alt: string };

// The supplied artwork does not cover all 77 catalog services one-to-one, so an image is reused
// only within a semantically related family and everything else keeps its icon. Two supplied
// files are intentionally absent (care connect / referral coordination): they depict an
// ambulance and emergency transport, which the telemedicine catalog does not offer. Keys are the
// stable catalog keys -- never display names, filenames or UUIDs.
const IMAGES = {
  generalConsultation: {
    src: generalConsultationImage,
    alt: "A patient speaking with a doctor over a video consultation"
  },
  childGrowthReview: {
    src: childGrowthReviewImage,
    alt: "A parent and child in a video consultation about the child's growth and development"
  },
  paediatricConsultation: {
    src: paediatricConsultationImage,
    alt: "A parent and child in a video consultation with a paediatrician"
  },
  maternityCare: {
    src: maternityCareImage,
    alt: "An expectant mother in a video consultation with a gynaecologist"
  },
  womensHealth: {
    src: womensHealthImage,
    alt: "A woman in a video consultation about her health"
  },
  cancerCare: {
    src: cancerCareImage,
    alt: "A patient and an oncologist in a video consultation reviewing scans"
  },
  chronicDiseaseCare: {
    src: chronicDiseaseCareImage,
    alt: "An older patient checking in with a doctor over video about a long-term condition"
  },
  nutritionAdvice: {
    src: nutritionAdviceImage,
    alt: "A dietitian explaining a balanced meal plan during a consultation"
  },
  mentalHealthSupport: {
    src: mentalHealthSupportImage,
    alt: "A person speaking with a counsellor over a private video session"
  },
  physiotherapy: {
    src: physiotherapyImage,
    alt: "A physiotherapist guiding a patient through exercises over video"
  },
  ent: {
    src: entConsultationImage,
    alt: "A patient in a video consultation with an ear, nose and throat specialist"
  },
  dermatology: {
    src: dermatologyImage,
    alt: "A patient showing a skin concern to a dermatologist over video"
  },
  imagingReview: {
    src: imagingReviewImage,
    alt: "A doctor reviewing scan results with a patient over video"
  },
  labTestGuidance: {
    src: labTestGuidanceImage,
    alt: "A clinician explaining a laboratory test over video"
  },
  labResultsReview: {
    src: labResultsReviewImage,
    alt: "A doctor going through laboratory results with a patient over video"
  },
  medicationReview: {
    src: medicationReviewImage,
    alt: "A doctor reviewing a prescription with a patient over video"
  },
  generatedSpecialistFollowUp: {
    src: generatedSpecialistFollowUpImage,
    alt: "A patient speaking with a specialist over a video follow-up consultation"
  },
  generatedPostHospitalisationReview: {
    src: generatedPostHospitalisationReviewImage,
    alt: "A patient reviewing recovery after hospitalisation with a clinician over video"
  },
  generatedPostOperativeWoundGuidance: {
    src: generatedPostOperativeWoundGuidanceImage,
    alt: "A patient receiving post-operative wound guidance from a clinician over video"
  },
  generatedSecondMedicalOpinion: {
    src: generatedSecondMedicalOpinionImage,
    alt: "A patient reviewing medical records with a doctor for a second opinion over video"
  },
  generatedCardiologyConsultation: {
    src: generatedCardiologyConsultationImage,
    alt: "A cardiology consultation with a clinician and patient over video"
  },
  generatedNeurologyConsultation: {
    src: generatedNeurologyConsultationImage,
    alt: "A neurology consultation with brain imaging and a patient over video"
  },
  generatedEndocrinologyConsultation: {
    src: generatedEndocrinologyConsultationImage,
    alt: "An endocrinology consultation about metabolic health and glucose monitoring"
  },
  generatedUrologyConsultation: {
    src: generatedUrologyConsultationImage,
    alt: "A urology consultation with a clinician and patient over video"
  },
  generatedGastroenterologyConsultation: {
    src: generatedGastroenterologyConsultationImage,
    alt: "A gastroenterology consultation about digestive health over video"
  },
  generatedNephrologyConsultation: {
    src: generatedNephrologyConsultationImage,
    alt: "A nephrology consultation about kidney health over video"
  },
  generatedInternalMedicineConsultation: {
    src: generatedInternalMedicineConsultationImage,
    alt: "An internal medicine consultation reviewing adult health and vital signs"
  },
  generatedOccupationalTherapyConsultation: {
    src: generatedOccupationalTherapyConsultationImage,
    alt: "An occupational therapy consultation focused on daily living and mobility"
  },
  generatedSpeechTherapyConsultation: {
    src: generatedSpeechTherapyConsultationImage,
    alt: "A speech and language therapy consultation over video"
  },
  generatedHomeCareAssessment: {
    src: generatedHomeCareAssessmentImage,
    alt: "A clinician assessing home-care needs with a patient over video"
  },
  generatedCareNavigation: {
    src: generatedCareNavigationImage,
    alt: "A clinician coordinating a patient's next care step over video"
  },
  generatedSurgeryCoordination: {
    src: generatedSurgeryCoordinationImage,
    alt: "A surgical referral consultation reviewing a treatment plan over video"
  },
  generatedEndoscopyReview: {
    src: generatedEndoscopyReviewImage,
    alt: "A gastroenterologist reviewing digestive reports with a patient over video"
  },
  generatedClinicalOfficerConsultation: {
    src: generatedClinicalOfficerConsultationImage,
    alt: "A primary-care clinician providing practical guidance over video"
  },
  generatedTreatmentMonitoring: {
    src: generatedTreatmentMonitoringImage,
    alt: "A clinician reviewing treatment progress with a patient over video"
  },
  generatedLifestyleWellness: {
    src: generatedLifestyleWellnessImage,
    alt: "A wellness professional discussing healthy routines with a patient over video"
  },
  generatedSpecialistTreatmentReview: {
    src: generatedSpecialistTreatmentReviewImage,
    alt: "A specialist reviewing treatment progress with a patient over video"
  },
  generatedCareCoordination: {
    src: generatedCareCoordinationImage,
    alt: "A care coordinator connecting a patient's care plan over video"
  },
  generatedDischargePlanReview: {
    src: generatedDischargePlanReviewImage,
    alt: "A clinician explaining a hospital discharge plan over video"
  },
  generatedPostOperativeReview: {
    src: generatedPostOperativeReviewImage,
    alt: "A clinician reviewing post-operative recovery with a patient over video"
  },
  generatedCardiacReportReview: {
    src: generatedCardiacReportReviewImage,
    alt: "A cardiologist reviewing cardiac investigation results with a patient over video"
  },
  generatedNeurologicalReportReview: {
    src: generatedNeurologicalReportReviewImage,
    alt: "A neurologist reviewing brain imaging with a patient over video"
  },
  generatedOrthopaedicConsultation: {
    src: generatedOrthopaedicConsultationImage,
    alt: "An orthopaedic clinician discussing joint and mobility concerns over video"
  },
  generatedUrologyFollowUp: {
    src: generatedUrologyFollowUpImage,
    alt: "A urologist reviewing ongoing care with a patient over video"
  },
  generatedSpecialistSecondOpinion: {
    src: generatedSpecialistSecondOpinionImage,
    alt: "A specialist reviewing scans and a treatment plan for a second opinion over video"
  }
} satisfies Record<string, TelemedicineImage>;

// Category level: only FirstCare is uniformly one family. The other four categories mix unrelated
// families (CareConnect spans referrals, surgery coordination, pharmacy, lab and imaging), so a
// single category image would misdescribe most of their services.
const CATEGORY_IMAGES: Record<string, TelemedicineImage> = {
  firstcare: IMAGES.generalConsultation
};

const SUBCATEGORY_IMAGES: Record<string, TelemedicineImage> = {
  "general-practitioners": IMAGES.generalConsultation,
  "clinical-officers": IMAGES.generalConsultation,
  paediatrics: IMAGES.paediatricConsultation,
  "obstetrics-gynaecology": IMAGES.womensHealth,
  oncology: IMAGES.cancerCare,
  dermatology: IMAGES.dermatology,
  ent: IMAGES.ent,
  "chronic-disease-follow-up": IMAGES.chronicDiseaseCare,
  "chronic-disease-education": IMAGES.chronicDiseaseCare,
  "nutrition-dietetics": IMAGES.nutritionAdvice,
  "psychology-counselling": IMAGES.mentalHealthSupport,
  // Psychiatry is the same care area as psychology/counselling from a client's point of view.
  psychiatry: IMAGES.mentalHealthSupport,
  physiotherapy: IMAGES.physiotherapy,
  "imaging-diagnostics": IMAGES.imagingReview,
  "laboratory-services": IMAGES.labResultsReview,
  pharmacy: IMAGES.medicationReview,
  "medication-follow-up": IMAGES.medicationReview
};

// Service level wins over subcategory: used where one subcategory holds services that a single
// family image would describe poorly (paediatrics, obstetrics, laboratory) or where a service
// belongs to a related family that lives under another subcategory (chronic conditions, imaging).
const SERVICE_IMAGES: Record<string, TelemedicineImage> = {
  "child-growth-development-review": IMAGES.childGrowthReview,
  "childrens-health-consultation": IMAGES.paediatricConsultation,
  "antenatal-consultation": IMAGES.maternityCare,
  "post-delivery-follow-up": IMAGES.maternityCare,
  "womens-health-consultation": IMAGES.womensHealth,
  "laboratory-test-guidance": IMAGES.labTestGuidance,
  "laboratory-results-review": IMAGES.labResultsReview,
  "multi-condition-care-review": IMAGES.chronicDiseaseCare,
  "diabetes-hypertension-review": IMAGES.chronicDiseaseCare,
  "complex-diabetes-review": IMAGES.chronicDiseaseCare,
  "chronic-kidney-disease-follow-up": IMAGES.chronicDiseaseCare,
  "injury-imaging-review": IMAGES.imagingReview,
  "specialist-follow-up-consultation": IMAGES.generatedSpecialistFollowUp,
  "post-hospitalisation-review": IMAGES.generatedPostHospitalisationReview,
  "post-operative-wound-guidance": IMAGES.generatedPostOperativeWoundGuidance,
  "second-medical-opinion": IMAGES.generatedSecondMedicalOpinion,
  "cardiology-consultation": IMAGES.generatedCardiologyConsultation,
  "neurology-consultation": IMAGES.generatedNeurologyConsultation,
  "endocrinology-consultation": IMAGES.generatedEndocrinologyConsultation,
  "urology-consultation": IMAGES.generatedUrologyConsultation,
  "digestive-health-consultation": IMAGES.generatedGastroenterologyConsultation,
  "kidney-health-consultation": IMAGES.generatedNephrologyConsultation,
  "internal-medicine-consultation": IMAGES.generatedInternalMedicineConsultation,
  "occupational-therapy-assessment": IMAGES.generatedOccupationalTherapyConsultation,
  "occupational-therapy-follow-up": IMAGES.generatedOccupationalTherapyConsultation,
  "speech-language-assessment": IMAGES.generatedSpeechTherapyConsultation,
  "speech-therapy-follow-up": IMAGES.generatedSpeechTherapyConsultation,
  "home-care-assessment": IMAGES.generatedHomeCareAssessment,
  "home-care-coordination": IMAGES.generatedHomeCareAssessment,
  "hospital-referral-coordination": IMAGES.generatedCareNavigation,
  "facility-care-navigation": IMAGES.generatedCareNavigation,
  "surgery-referral-consultation": IMAGES.generatedSurgeryCoordination,
  "surgical-care-coordination": IMAGES.generatedSurgeryCoordination,
  "endoscopy-report-review": IMAGES.generatedEndoscopyReview,
  "clinical-officer-consultation": IMAGES.generatedClinicalOfficerConsultation,
  "recovery-monitoring-consultation": IMAGES.generatedTreatmentMonitoring,
  "treatment-progress-review": IMAGES.generatedTreatmentMonitoring,
  "lifestyle-wellness-consultation": IMAGES.generatedLifestyleWellness,
  "wellness-follow-up": IMAGES.generatedLifestyleWellness,
  "specialist-treatment-review": IMAGES.generatedSpecialistTreatmentReview,
  "care-coordination-follow-up": IMAGES.generatedCareCoordination,
  "long-term-care-planning": IMAGES.generatedCareCoordination,
  "discharge-plan-review": IMAGES.generatedDischargePlanReview,
  "post-operative-review": IMAGES.generatedPostOperativeReview,
  "cardiac-report-review": IMAGES.generatedCardiacReportReview,
  "neurological-report-review": IMAGES.generatedNeurologicalReportReview,
  "orthopaedic-consultation": IMAGES.generatedOrthopaedicConsultation,
  "urology-follow-up": IMAGES.generatedUrologyFollowUp,
  "specialist-second-opinion": IMAGES.generatedSpecialistSecondOpinion
};

export type TelemedicineImageSource = "service" | "subcategory" | "category" | "none";

export type TelemedicineServiceAsset = TelemedicineVisualAsset & {
  // Which level of the lookup supplied `image`; "none" means the icon + tint is the whole visual.
  imageSource: TelemedicineImageSource;
};

export type TelemedicineServiceAssetKeys = {
  serviceKey?: string | null;
  subcategoryKey?: string | null;
  categoryKey?: string | null;
};

// Lookup order: service key -> subcategory key -> category key -> neutral icon. The icon and tint
// always come from the existing specialty/category chain so a service without an image (or whose
// image fails to load) is still visually identifiable without inventing an unrelated picture.
export const getTelemedicineServiceAsset = ({
  serviceKey,
  subcategoryKey,
  categoryKey
}: TelemedicineServiceAssetKeys): TelemedicineServiceAsset => {
  const iconAsset = getTelemedicineSpecialtyAsset(subcategoryKey, categoryKey);

  const candidates: Array<[TelemedicineImageSource, TelemedicineImage | undefined]> = [
    ["service", serviceKey ? SERVICE_IMAGES[serviceKey] : undefined],
    ["subcategory", subcategoryKey ? SUBCATEGORY_IMAGES[subcategoryKey] : undefined],
    ["category", categoryKey ? CATEGORY_IMAGES[categoryKey] : undefined]
  ];
  const match = candidates.find(([, image]) => image !== undefined);

  if (!match || !match[1]) {
    if (serviceKey && DISTINCT_ICON_SERVICE_KEYS.has(serviceKey)) {
      return { ...serviceIconAssetForKey(serviceKey), image: undefined, imageAlt: undefined, imageSource: "none" };
    }
    return { ...iconAsset, image: undefined, imageAlt: undefined, imageSource: "none" };
  }
  return { ...iconAsset, image: match[1].src, imageAlt: match[1].alt, imageSource: match[0] };
};
