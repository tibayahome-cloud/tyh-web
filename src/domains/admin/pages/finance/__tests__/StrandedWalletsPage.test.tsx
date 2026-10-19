/**
 * Money left in a deleted account's wallet is paid out by a super admin. The screen has to make the amount
 * deliberate (retyped), the destination explicit, and has to say plainly when the server refused.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../../../../shared/libs/api", () => ({ default: api, api }));
vi.mock("../../../../../shared/components/ToastProvider", () => ({ useToast: () => toast }));

import StrandedWalletsPage from "../StrandedWalletsPage";

const row = (overrides: Record<string, unknown> = {}) => ({
  user_id: "u1",
  full_name: "Sample Person",
  deleted_at: "2026-10-15T08:00:00Z",
  currency: "KES",
  balance_cents: 100000,
  reserved_cents: 0,
  available_cents: 100000,
  withdrawals_in_progress: 0,
  can_settle: true,
  blocker: null,
  ...overrides
});

const apiError = (status: number, message: string) =>
  new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {},
    data: { error: { message } }
  } as never);

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StrandedWalletsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: [row()] } });
  api.post.mockResolvedValue({ data: {} });
});

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: "Pay out" }));
  return screen.getByRole("dialog");
};

describe("StrandedWalletsPage", () => {
  it("lists a deleted account's wallet with what is available", async () => {
    renderPage();
    expect(await screen.findByText("Sample Person")).toBeInTheDocument();
    expect(screen.getByText(/1,000\.00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay out" })).toBeEnabled();
  });

  it("says when nothing is stranded", async () => {
    api.get.mockResolvedValue({ data: { data: [] } });
    renderPage();
    expect(await screen.findByText("No deleted account is holding money.")).toBeInTheDocument();
  });

  it("shows why a wallet cannot be paid out yet and does not let anyone try", async () => {
    api.get.mockResolvedValue({
      data: {
        data: [
          row({
            reserved_cents: 6000,
            available_cents: 12000,
            can_settle: false,
            blocker: "A withdrawal for this wallet is still in progress."
          })
        ]
      }
    });
    renderPage();

    expect(await screen.findByText("A withdrawal for this wallet is still in progress.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay out" })).toBeDisabled();
    expect(screen.getByText(/is reserved for a withdrawal/)).toBeInTheDocument();
  });

  it("offers a retry when the list cannot be loaded", async () => {
    api.get.mockRejectedValueOnce(apiError(500, "boom"));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Temporarily unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Sample Person")).toBeInTheDocument();
  });

  describe("the payout dialog", () => {
    it("will not pay until the number, a reason and the retyped amount are all there", async () => {
      const user = userEvent.setup();
      renderPage();
      const dialog = within(await openDialog(user));
      const pay = dialog.getByRole("button", { name: /^Pay / });
      expect(pay).toBeDisabled();

      await user.type(dialog.getByLabelText(/M-Pesa number to pay/), "0712345678");
      await user.type(dialog.getByLabelText("Why is this being paid out?"), "Account deleted with funds");
      expect(pay).toBeDisabled();

      await user.type(dialog.getByLabelText(/Type the amount to confirm/), "900");
      expect(dialog.getByText("That is not the amount shown above.")).toBeInTheDocument();
      expect(pay).toBeDisabled();

      await user.clear(dialog.getByLabelText(/Type the amount to confirm/));
      await user.type(dialog.getByLabelText(/Type the amount to confirm/), "1,000");
      expect(pay).toBeEnabled();
    });

    it("sends exactly the amount that was shown, the number and the reason, then closes", async () => {
      const user = userEvent.setup();
      renderPage();
      const dialog = within(await openDialog(user));

      await user.type(dialog.getByLabelText(/M-Pesa number to pay/), "0712345678");
      await user.type(dialog.getByLabelText("Why is this being paid out?"), "Account deleted with funds");
      await user.type(dialog.getByLabelText(/Type the amount to confirm/), "1000");
      await user.click(dialog.getByRole("button", { name: /^Pay / }));

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith("/admin/payments/stranded-wallets/u1/settle", {
          amount_cents: 100000,
          phone_number: "0712345678",
          reason: "Account deleted with funds"
        })
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Payout started", variant: "success" }));
    });

    it("keeps the dialog open and says so plainly when the server refuses, e.g. a changed balance", async () => {
      api.post.mockRejectedValueOnce(
        apiError(409, "The balance has changed since you looked. Reload and check the amount before settling.")
      );
      const user = userEvent.setup();
      renderPage();
      const dialog = within(await openDialog(user));

      await user.type(dialog.getByLabelText(/M-Pesa number to pay/), "0712345678");
      await user.type(dialog.getByLabelText("Why is this being paid out?"), "Account deleted with funds");
      await user.type(dialog.getByLabelText(/Type the amount to confirm/), "1000");
      await user.click(dialog.getByRole("button", { name: /^Pay / }));

      expect(await dialog.findByRole("alert")).toHaveTextContent("The balance has changed since you looked");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(toast.showToast).not.toHaveBeenCalled();
    });
  });
});
