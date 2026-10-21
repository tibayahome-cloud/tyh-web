import { Ambulance, House, MonitorSmartphone } from "lucide-react";

export type CareType = "telemedicine" | "home_based" | "ambulance";

const KINDS: Record<CareType, { label: string; className: string; Icon: typeof House }> = {
  telemedicine: { label: "Telemedicine", className: "bg-blue-50 text-blue-800", Icon: MonitorSmartphone },
  home_based: { label: "Home based", className: "bg-emerald-50 text-emerald-800", Icon: House },
  ambulance: { label: "Ambulance", className: "bg-rose-50 text-rose-800", Icon: Ambulance }
};

/** Reads a care type from the API; an unknown or missing one is shown as home based rather than as nothing. */
export const toCareType = (value: unknown): CareType =>
  value === "telemedicine" || value === "ambulance" || value === "home_based" ? value : "home_based";

export const careTypeLabel = (value: CareType): string => KINDS[value].label;

/**
 * Which of the three kinds of care this is, with the same words, colours and icons everywhere: telemedicine, home based
 * or ambulance. An icon and a word, never colour alone. The kind itself comes from the API (service.care_type).
 */
export const CareTypeBadge = ({ careType, className = "" }: { careType: CareType; className?: string }) => {
  const { label, className: tone, Icon } = KINDS[careType];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone} ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
};

export default CareTypeBadge;
