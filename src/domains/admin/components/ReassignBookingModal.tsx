import { useState } from "react";

import { Modal } from "../../../shared/components/Modal";
import { Input } from "../../../shared/components/Input";
import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { useEligibleProviders } from "../../../shared/hooks/useProviders";
import { useReassignBookingMutation } from "../../../shared/hooks/useBookings";
import { useToast } from "../../../shared/components/ToastProvider";

type ReassignBookingModalProps = {
  bookingId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export const ReassignBookingModal = ({ bookingId, open, onClose, onSuccess }: ReassignBookingModalProps) => {
  const [search, setSearch] = useState("");
  const toast = useToast();
  const { data: candidates, isLoading } = useEligibleProviders({
    bookingId,
    search,
    limit: 25,
    enabled: open
  });
  const reassignMutation = useReassignBookingMutation("detail");

  const handleAssign = async (providerUserId: string) => {
    if (!bookingId) {
      return;
    }
    try {
      await reassignMutation.mutateAsync({ bookingId, providerUserId });
      toast.showToast({ title: "Booking reassigned", variant: "success" });
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.showToast({
        title: "Reassignment failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "error"
      });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Assign provider" maxWidth="md">
      <div className="space-y-4">
        <Input
          placeholder="Search providers by name, email, or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      {isLoading ? (
        <div className="py-6 text-center">
          <Loading label="Fetching providers…" />
        </div>
      ) : !candidates || candidates.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">No eligible providers match this booking.</p>
      ) : (
        <div className="grid gap-3">
          {candidates.map((provider) => (
            <div
              key={provider.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{provider.fullName}</p>
                <p className="text-xs text-slate-500">
                  {provider.email ?? "No email"} · {provider.phone ?? "No phone"}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>
                    Rating: {provider.ratingAvg?.toFixed(2) ?? "New"} ({provider.ratingCount})
                  </span>
                  {provider.distanceM != null && (
                    <span>{(provider.distanceM / 1000).toFixed(1)} km away</span>
                  )}
                  <span>{provider.activeAssignments} active jobs</span>
                  {provider.canEmergency && <span className="text-emerald-600">Emergency-ready</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>Daily limit: {provider.dailyRequestLimit}</span>
                  <span>
                    Last assignment:{" "}
                    {provider.lastAssignedAt ? new Date(provider.lastAssignedAt).toLocaleString() : "No history"}
                  </span>
                  <span>
                    Next slot:{" "}
                    {provider.nextAvailableAt ? new Date(provider.nextAvailableAt).toLocaleString() : "Not provided"}
                  </span>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => handleAssign(provider.userId)}
                loading={reassignMutation.isPending}
                >
                  Assign
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ReassignBookingModal;
