import { useState } from "react";

import { Card } from "../../../../shared/components/Card";
import { Button } from "../../../../shared/components/Button";
import { Loading } from "../../../../shared/components/Loading";
import { useToast } from "../../../../shared/components/ToastProvider";
import { useAssignProviderMutation, useAssignmentQueue, useTelemedicinePolicy } from "../../../../shared/hooks/useTelemedicine";
import { formatTelemedicineDateTime } from "../../../../shared/utils/telemedicine";
import type { TelemedicineAssignmentBooking } from "../../../../shared/schemas/telemedicine";

const AssignmentRow = ({ booking, timezone }: { booking: TelemedicineAssignmentBooking; timezone: string | undefined }) => {
  const toast = useToast();
  const [providerUserId, setProviderUserId] = useState("");
  const assignMutation = useAssignProviderMutation();

  const handleAssign = async () => {
    if (!providerUserId) return;
    try {
      await assignMutation.mutateAsync({ bookingId: booking.id, providerUserId });
      toast.showToast({ title: "Provider assigned", variant: "success" });
    } catch (error) {
      toast.showToast({
        title: "Unable to assign provider",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    }
  };

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-900">{booking.serviceName ?? "Consultation"}</div>
        <div className="text-xs text-slate-500">{booking.id}</div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-900">{booking.clientFullName ?? booking.clientUserId}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{formatTelemedicineDateTime(booking.scheduledAt, timezone)}</td>
      <td className="px-4 py-3">
        {booking.assignableProviders.length === 0 ? (
          <span className="text-xs font-semibold text-danger-600">No eligible providers free</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={providerUserId}
              onChange={(event) => setProviderUserId(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="">Select provider</option>
              {booking.assignableProviders.map((provider) => (
                <option key={provider.providerUserId} value={provider.providerUserId}>
                  {provider.fullName ?? provider.providerUserId}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!providerUserId}
              loading={assignMutation.isPending}
              onClick={handleAssign}
            >
              Assign
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
};

const AssignmentQueuePage = () => {
  const queueQuery = useAssignmentQueue({ refetchInterval: 30_000 });
  const policyQuery = useTelemedicinePolicy();
  const bookings = queueQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Telemedicine assignment</h1>
        <p className="text-sm text-slate-500">
          Paid remote-consultation appointments awaiting an eligible provider.
        </p>
      </div>

      <Card>
        {queueQuery.isLoading ? (
          <div className="py-12 text-center">
            <Loading label="Loading assignment queue…" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No consultations waiting for assignment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Consultation</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Scheduled</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Assign provider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bookings.map((booking) => (
                  <AssignmentRow key={booking.id} booking={booking} timezone={policyQuery.data?.defaultTimezone} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AssignmentQueuePage;
