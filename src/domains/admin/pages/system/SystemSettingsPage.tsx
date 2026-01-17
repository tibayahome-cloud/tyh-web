import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Card } from "../../../../shared/components/Card";
import { Loading } from "../../../../shared/components/Loading";
import { Button } from "../../../../shared/components/Button";
import { Input } from "../../../../shared/components/Input";
import { useToast } from "../../../../shared/components/ToastProvider";
import {
  fetchBroadcastRadiusSetting,
  updateBroadcastRadiusSetting
} from "../../../../shared/libs/systemSettings";

const MIN_RADIUS = 250;
const MAX_RADIUS = 20000;

export const SystemSettingsPage = () => {
  const toast = useToast();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["system-settings", "broadcast-radius"],
    queryFn: fetchBroadcastRadiusSetting
  });
  const [pendingValue, setPendingValue] = useState<number | null>(null);
  const mutation = useMutation({
    mutationFn: updateBroadcastRadiusSetting,
    onSuccess: (result) => {
      setPendingValue(result.value);
      toast.showToast({
        title: "Broadcast radius updated",
        description: "New requests will use the updated radius immediately.",
        variant: "success"
      });
      refetch().catch(() => undefined);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to update broadcast radius.";
      toast.showToast({
        title: "Update failed",
        description: message,
        variant: "error"
      });
    }
  });

  const setting = data ?? { key: "broadcast_radius_m", value: 0, default: 1500 };
  const currentValue = pendingValue ?? setting.value;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentValue < MIN_RADIUS || currentValue > MAX_RADIUS) {
      toast.showToast({
        title: "Invalid radius",
        description: `Radius must be between ${MIN_RADIUS}m and ${MAX_RADIUS}m.`,
        variant: "error"
      });
      return;
    }
    mutation.mutate(currentValue);
  };

  if (isLoading && !data) {
    return <Loading fullHeight />;
  }

  return (
    <div className="space-y-6">
      <Card
        title="Provider broadcast radius"
        description="Control the default radius (in meters) used when matching new bookings to available providers."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Radius in meters"
            type="number"
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            value={currentValue}
            onChange={(event) => setPendingValue(event.target.value ? Number(event.target.value) : MIN_RADIUS)}
            hint={`Default: ${setting.default}m`}
          />
          <p className="text-xs text-slate-500">
            Only verified, available providers whose home base is within this radius will receive broadcast invitations.
            Admins can still trigger manual waves with a custom radius if needed.
          </p>
          <div className="flex justify-end">
            <Button type="submit" loading={mutation.isPending}>
              Save radius
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default SystemSettingsPage;
