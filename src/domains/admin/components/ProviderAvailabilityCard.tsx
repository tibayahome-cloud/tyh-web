import { Card } from "../../../shared/components/Card";
import { groupAvailabilityByDay, remoteWindowCount, type AvailabilityWindowInput } from "../../../shared/utils/providerAvailability";

type Props = { windows: AvailabilityWindowInput[]; timezone: string | null };

// The provider's weekly schedule by day, with the delivery mode of each window. Telemedicine
// bookings are only offered inside windows set to remote or both.
export const ProviderAvailabilityCard = ({ windows, timezone }: Props) => {
  const days = groupAvailabilityByDay(windows);
  const remote = remoteWindowCount(windows);
  return (
    <Card
      title="Availability"
      description={`Weekly schedule${timezone ? `, in ${timezone} time` : ""}. Times are when this provider can be booked.`}
    >
      {windows.length === 0 ? (
        <p className="text-sm text-slate-600">No availability configured. The provider sets their weekly hours in their own app.</p>
      ) : (
        <>
          {remote === 0 && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
              None of these windows is set to remote, so clients cannot book this provider for telemedicine.
            </p>
          )}
          <ul className="divide-y divide-slate-100 text-sm" aria-label="Weekly availability">
            {days.map((day) => (
              <li key={day.weekday} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-4">
                <span className="w-28 shrink-0 font-medium text-slate-900">{day.name}</span>
                {day.windows.length === 0 ? (
                  <span className="text-slate-400">Not available</span>
                ) : (
                  <ul className="space-y-1">
                    {day.windows.map((window) => (
                      <li key={window.id} className="flex flex-wrap items-center gap-2 text-slate-700">
                        <span className="font-medium">
                          {window.from} to {window.to}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${window.remote ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {window.mode}
                        </span>
                        {window.effective && <span className="text-xs text-slate-500">{window.effective}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
};
