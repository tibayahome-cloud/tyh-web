import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }));
vi.mock("../../../../shared/libs/api", () => ({ api }));

import { DeleteAccountDialog } from "../DeleteAccountDialog";

const renderDialog = (props: Partial<React.ComponentProps<typeof DeleteAccountDialog>> = {}) => {
  const onDeleted = vi.fn();
  const onSuspendInstead = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DeleteAccountDialog
        open
        userId="u1"
        userName="Dr Gitobu"
        onClose={() => undefined}
        onDeleted={onDeleted}
        onSuspendInstead={onSuspendInstead}
        {...props}
      />
    </QueryClientProvider>
  );
  return { onDeleted, onSuspendInstead };
};

const check = (data: unknown) => api.get.mockResolvedValue({ data: { data } });

beforeEach(() => {
  vi.clearAllMocks();
  api.delete.mockResolvedValue({});
});

describe("DeleteAccountDialog", () => {
  it("lists what blocks the delete, disables it, and offers to suspend instead", async () => {
    check({ can_delete: false, obligations: [{ code: "wallet_balance", message: "The wallet holds KES 1,000.00. Settle it to the account holder first." }] });
    const user = userEvent.setup();
    const { onSuspendInstead } = renderDialog();

    expect(await screen.findByText(/The wallet holds KES 1,000.00/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be deleted yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Suspend instead" }));
    expect(onSuspendInstead).toHaveBeenCalled();
  });

  it("deletes a clean account after the check passes", async () => {
    check({ can_delete: true, obligations: [] });
    const user = userEvent.setup();
    const { onDeleted } = renderDialog();

    const button = await screen.findByRole("button", { name: "Delete account" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByText(/It cannot be undone/)).toBeInTheDocument();
    await user.click(button);

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/users/u1", { data: { reason: "admin_delete" } }));
    expect(onDeleted).toHaveBeenCalled();
  });

  it("will not offer the delete when the check itself failed", async () => {
    api.get.mockRejectedValue(new AxiosError("x", "ERR_NETWORK"));
    renderDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Try again before deleting/);
    expect(screen.getByRole("button", { name: "Delete account" })).toBeDisabled();
  });

  it("shows the server's reasons if the server refuses anyway", async () => {
    check({ can_delete: true, obligations: [] });
    api.delete.mockRejectedValue(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 409, statusText: "", headers: {}, config: {},
        data: { error: { message: "This account cannot be deleted yet: 1 booking not yet completed or cancelled. Suspend it instead." } }
      } as never)
    );
    const user = userEvent.setup();
    renderDialog();
    const button = await screen.findByRole("button", { name: "Delete account" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(/1 booking not yet completed or cancelled/);
  });
});
