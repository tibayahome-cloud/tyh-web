import { Card } from "../../../shared/components/Card";
import { providerTelemedicineReadiness } from "../../../shared/utils/telemedicineReadiness";

export type SpecialtyRow = {
  id: string;
  subcategoryId: string;
  status: string;
  name: string;
  subcategoryStatus: string | null;
  categoryName: string | null;
  categoryStatus: string | null;
};

type Props = {
  verified: boolean;
  telemedicineEnabled: boolean;
  accountStatus: string | null;
  specialties: SpecialtyRow[];
  windows: Array<{ deliveryMode: string | null }>;
};

// Whether clients can book this provider for telemedicine, and the specialties behind it.
// A specialty that was archived after it was assigned is listed as archived and does not count.
export const ProviderTelemedicineCard = ({ verified, telemedicineEnabled, accountStatus, specialties, windows }: Props) => {
  const active = specialties.filter((item) => item.status === "active");
  const history = specialties.filter((item) => item.status !== "active");
  const usable = (item: SpecialtyRow) => item.subcategoryStatus !== "archived" && item.categoryStatus !== "archived";
  const readiness = providerTelemedicineReadiness(
    {
      verified,
      telemedicineEnabled,
      user: accountStatus ? { status: accountStatus } : undefined,
      telemedicineSubcategoryAssignments: specialties.map((item) => ({ subcategoryId: item.subcategoryId, status: usable(item) ? item.status : "archived" })),
      availability: windows.map((window) => ({ deliveryMode: window.deliveryMode ?? undefined }))
    } as never,
    null
  );
  const byCategory = new Map<string, SpecialtyRow[]>();
  active.forEach((item) => byCategory.set(item.categoryName ?? "Other", [...(byCategory.get(item.categoryName ?? "Other") ?? []), item]));

  return (
    <Card title="Telemedicine" description="Whether clients can book this provider by video, and the specialties they cover.">
      {readiness.ready ? (
        <p className="mb-4 text-sm font-medium text-green-700">Ready for telemedicine bookings</p>
      ) : (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          <p className="font-medium">Not bookable for telemedicine</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {readiness.blockers.map((blocker) => (
              <li key={blocker.code}>
                <span className="font-medium">{blocker.label}.</span> {blocker.fix}
              </li>
            ))}
          </ul>
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900">Specialties ({active.length})</h3>
      {active.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">No telemedicine specialties assigned at this facility.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm" aria-label="Telemedicine specialties">
          {[...byCategory.entries()].map(([category, rows]) => (
            <li key={category}>
              <p className="text-xs font-semibold text-slate-500">{category}</p>
              <p className="mt-0.5 flex flex-wrap gap-1.5">
                {rows.map((row) => (
                  <span
                    key={row.id}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${usable(row) ? "bg-slate-50 text-slate-700 ring-slate-200" : "bg-red-50 text-red-700 ring-red-200"}`}
                  >
                    {row.name}
                    {!usable(row) ? " (archived)" : ""}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
      {history.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Previously assigned: {history.map((row) => `${row.name} (${row.status})`).join(", ")}.
        </p>
      )}
    </Card>
  );
};
