import { getTelemedicineServiceAsset, type TelemedicineServiceAssetKeys } from "../../../shared/libs/telemedicineCategoryAssets";
import { TelemedicineServiceVisual } from "../../../shared/components/TelemedicineServiceVisual";

// Static marketing copy for the public page -- nothing here is fetched from the catalogue and no
// provider, price or availability appears. The catalog keys only pick which supplied picture to
// show; each area gets an identical tile so no single service is visually promoted over another.
const CARE_AREAS: Array<{ label: string; keys: TelemedicineServiceAssetKeys }> = [
  { label: "General consultations", keys: { subcategoryKey: "general-practitioners", categoryKey: "firstcare" } },
  { label: "Children's health", keys: { subcategoryKey: "paediatrics", categoryKey: "specialistcare" } },
  { label: "Women's health", keys: { subcategoryKey: "obstetrics-gynaecology", categoryKey: "specialistcare" } },
  { label: "Mental health", keys: { subcategoryKey: "psychology-counselling", categoryKey: "mental-health" } },
  { label: "Nutrition", keys: { subcategoryKey: "nutrition-dietetics", categoryKey: "wellnesscare" } },
  { label: "Skin care", keys: { subcategoryKey: "dermatology", categoryKey: "specialistcare" } }
];

export const TelemedicineCareAreas = () => (
  <div className="mb-10">
    <p className="mb-3 text-sm font-semibold text-slate-700">Care you can get online</p>
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6" aria-label="Care areas available online">
      {CARE_AREAS.map(({ label, keys }) => (
        <li key={label} className="min-w-0">
          <TelemedicineServiceVisual asset={getTelemedicineServiceAsset(keys)} size="lg" />
          <span className="mt-2 block text-xs font-medium leading-tight text-slate-700">{label}</span>
        </li>
      ))}
    </ul>
  </div>
);
