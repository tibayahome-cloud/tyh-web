/**
 * An administrator sets a temporary password when adding a user. It must meet the same policy the
 * API enforces, so a password that would be rejected is caught before the request is sent.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.fn();
const getMock = vi.fn();

vi.mock("../../../../shared/libs/api", () => ({
  api: { get: (...args: unknown[]) => getMock(...args), post: (...args: unknown[]) => postMock(...args) },
  default: { get: (...args: unknown[]) => getMock(...args), post: (...args: unknown[]) => postMock(...args) }
}));

import { AddUserDialog } from "../AddUserDialog";

const renderDialog = (onSuccess = vi.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AddUserDialog open onClose={vi.fn()} onSuccess={onSuccess} />
    </QueryClientProvider>
  );

const passwordField = () => screen.getByLabelText(/^Temporary password/);

const fillDetails = async (user: ReturnType<typeof userEvent.setup>, password: string) => {
  await user.type(screen.getByLabelText(/^Full name/), "Amina Otieno");
  await user.type(screen.getByLabelText(/^Email/), "amina@example.com");
  await user.type(passwordField(), password);
};

describe("add user dialog temporary password", () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
    getMock.mockResolvedValue({ data: { data: [] } });
  });

  it("shows the requirements before anything is typed", async () => {
    renderDialog();

    expect(await screen.findByRole("list", { name: "Requirements for your password" })).toBeInTheDocument();
    expect(passwordField()).toHaveAttribute("aria-describedby", "add-user-password-requirements");
  });

  it("rejects an eight-character password that the old check allowed", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(passwordField(), "Abcde12!");

    expect(await screen.findByText("Password must be at least 10 characters", { selector: "span.text-red-500" })).toBeInTheDocument();
  });

  it("does not send the request for a password the API would reject", async () => {
    const user = userEvent.setup();
    renderDialog();

    await fillDetails(user, "abcdefg123");
    await user.click(screen.getByRole("button", { name: /add user|create|save/i }));

    expect(postMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Password needs an uppercase letter", { selector: "span.text-red-500" })).toBeInTheDocument();
  });

  it("creates the user when the password meets every rule", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    postMock.mockResolvedValue({ data: {} });
    renderDialog(onSuccess);

    await fillDetails(user, "@Qwerty123");
    await user.click(screen.getByRole("button", { name: /add user|create|save/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0][0]).toBe("/users");
    expect(postMock.mock.calls[0][1]).toMatchObject({ email: "amina@example.com", password: "@Qwerty123" });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
