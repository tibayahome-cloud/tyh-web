/**
 * After the verification code, a person goes to the area the sign-in they used was for. That only matters for someone who holds
 * more than one area, such as a facility admin who is also a provider: the personal sign-in opens the provider area and a staff
 * sign-in the admin area, and the menu then offers the other.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyTwoFactor } = vi.hoisted(() => ({ verifyTwoFactor: vi.fn() }));

vi.mock("../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ verifyTwoFactor, logout: vi.fn(), roles: [] })
}));
vi.mock("../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn(), push: vi.fn() }) }));
vi.mock("../../shared/libs/api", () => ({ default: { post: vi.fn() } }));

import { saveTwofaChallenge } from "../../shared/utils/twofaStorage";
import { TwoFactorPage } from "../TwoFactorPage";

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

const verifyAs = async (origin: "client" | "admin", roles: string[]) => {
  saveTwofaChallenge({ method: "sms", sessionHint: "hint-1", userId: "u1", origin });
  verifyTwoFactor.mockResolvedValue({ status: "authenticated", user: { roles } });
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/two-factor"]}>
      <Routes>
        <Route path="/two-factor" element={<TwoFactorPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
  await user.type(await screen.findByLabelText("Verification code"), "123456");
  await user.click(screen.getByRole("button", { name: "Confirm code" }));
};

describe("where two-factor verification leads", () => {
  beforeEach(() => {
    window.localStorage.clear();
    verifyTwoFactor.mockReset();
  });

  it("opens the provider area for someone who is both an admin and a provider and used the personal sign-in", async () => {
    await verifyAs("client", ["admin.ops", "provider"]);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/pro/home"));
  });

  it("opens the admin area for the same person when they used a staff sign-in", async () => {
    await verifyAs("admin", ["provider", "admin.ops"]);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin/facility"));
  });

  it("still sends a provider, a patient and an administrator where they always went", async () => {
    await verifyAs("client", ["provider"]);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/pro/home"));
  });

  it("still sends a patient to the patient home", async () => {
    await verifyAs("client", ["client"]);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app/home"));
  });

  it("still sends an administrator to the admin area, even from the personal sign-in", async () => {
    await verifyAs("client", ["admin.super"]);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin/dashboard"));
  });
});
