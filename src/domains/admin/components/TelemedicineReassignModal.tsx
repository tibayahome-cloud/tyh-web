import { useState } from "react";

import { Button } from "../../../shared/components/Button";
import { Input } from "../../../shared/components/Input";
import { Loading } from "../../../shared/components/Loading";
import { Modal } from "../../../shared/components/Modal";
import { useToast } from "../../../shared/components/ToastProvider";
import { useReassignTelemedicineProviderMutation } from "../../../shared/hooks/useTelemedicine";
import { useEligibleProviders } from "../../../shared/hooks/useProviders";

type TelemedicineReassignModalProps = {
  bookingId: string | null;
  currentProviderName?: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export const TelemedicineReassignModal = ({
  bookingId,
  currentProviderName,
  open,
  onClose,
  onSuccess
}: TelemedicineReassignModalProps) => {
  const [search, setSearch] = useState("");
  const toast = useToast();
  const { data: candidates, isLoading } = useEligibleProviders({
    bookingId,
    search,
    limit: 25,
    enabled: open
  });
  const reassignMutation = useReassignTelemedicineProviderMutation();

  const handleAssign = async (providerUserId: string) => {
    if (!bookingId) {
      return;
    }
    try {
      await reassignMutation.mutateAsync({ bookingId, providerUserId });
      toast.showToast({ title: "Consultation provider reassigned", variant: "success" });
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
    <Modal open={open} onClose={onClose} title="Reassign consultation provider" maxWidth="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Choose an eligible provider for this scheduled consultation. The appointment time and client payment stay unchanged.
        </p>
        {currentProviderName && (
          <p className="text-xs text-slate-500">Current provider: <span className="font-semibold">{currentProviderName}</span></p>
        )}
        <Input
          placeholder="Search providers by name, email, or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {isLoading ? (
          <div className="py-6 text-center">
            <Loading label="Fetching eligible providers..." />
          </div>
        ) : !candidates || candidates.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No eligible providers match this consultation.</p>
        ) : (
          <div className="grid gap-3">
            {candidates.map((provider) => (
              <div
                key={provider.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{provider.fullName}</p>
                  <p className="text-xs text-slate-500">{provider.email ?? "No email"} · {provider.phone ?? "No phone"}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Rating: {provider.ratingAvg?.toFixed(2) ?? "New"} ({provider.ratingCount})</span>
                    <span>{provider.activeAssignments} active jobs</span>
                    {provider.nextAvailableAt && <span>Next slot: {new Date(provider.nextAvailableAt).toLocaleString()}</span>}
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

export default TelemedicineReassignModal;
