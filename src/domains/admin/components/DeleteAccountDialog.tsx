import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { Modal } from "../../../shared/components/Modal";
import { api } from "../../../shared/libs/api";
import { getApiError } from "../../../shared/utils/errors";

type Obligation = { code: string; message: string };
type DeletionCheck = { canDelete: boolean; obligations: Obligation[] };

type Props = {
  open: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
  onDeleted: () => void;
  // Offered when something blocks the delete: the account can be suspended instead.
  onSuspendInstead?: () => void;
};

const fetchDeletionCheck = async (userId: string): Promise<DeletionCheck> => {
  const response = await api.get(`/users/${userId}/deletion-check`);
  const data = (response.data?.data ?? {}) as { can_delete?: boolean; obligations?: Obligation[] };
  return { canDelete: Boolean(data.can_delete), obligations: Array.isArray(data.obligations) ? data.obligations : [] };
};

// Deleting signs the person out and wipes the email and phone the platform reaches them on, so it is only
// offered when nothing is owed to them or by them and nothing is waiting on them. The reasons it is
// blocked come from the server, which makes the same check again when the delete is sent.
export const DeleteAccountDialog = ({ open, userId, userName, onClose, onDeleted, onSuspendInstead }: Props) => {
  const [error, setError] = useState<string | null>(null);

  const check = useQuery({
    queryKey: ["admin", "users", userId, "deletion-check"],
    queryFn: () => fetchDeletionCheck(userId),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    retry: false
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/users/${userId}`, { data: { reason: "admin_delete" } }),
    onSuccess: () => {
      setError(null);
      onDeleted();
    },
    onError: (err: unknown) => {
      setError(getApiError(err, "We could not delete the account."));
      void check.refetch();
    }
  });

  const obligations = check.data?.obligations ?? [];
  const blocked = obligations.length > 0;
  const close = () => {
    if (!remove.isPending) {
      setError(null);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={close} title="Delete account?" maxWidth="sm">
      <div className="space-y-4">
        {check.isLoading ? (
          <Loading label="Checking whether this account can be deleted" />
        ) : check.isError ? (
          <p className="text-sm text-danger-600" role="alert">
            {getApiError(check.error, "We could not check this account.")} Try again before deleting.
          </p>
        ) : blocked ? (
          <>
            <p className="text-sm text-slate-700">
              {userName} cannot be deleted yet. Deleting would sign them out and remove the phone number a payout goes to.
            </p>
            <ul className="space-y-2" aria-label="Why this account cannot be deleted">
              {obligations.map((item) => (
                <li key={item.code} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {item.message}
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-700">Suspend the account instead. Nothing is lost, and you can reactivate it later.</p>
          </>
        ) : (
          <p className="text-sm text-slate-700">
            This signs {userName} out everywhere and removes their email and phone number from the account. It cannot be undone.
          </p>
        )}
        {error && (
          <p className="text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={remove.isPending}>
            {blocked ? "Close" : "Cancel"}
          </Button>
          {blocked && onSuspendInstead && <Button onClick={onSuspendInstead}>Suspend instead</Button>}
          <Button
            variant="secondary"
            className="border-rose-200 text-rose-600 hover:bg-rose-50"
            loading={remove.isPending}
            disabled={!check.data || blocked || check.isFetching}
            onClick={() => remove.mutate()}
          >
            Delete account
          </Button>
        </div>
      </div>
    </Modal>
  );
};
