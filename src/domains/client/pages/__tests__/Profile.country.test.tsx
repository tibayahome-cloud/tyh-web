/**
 * The client's profile has no country field. Where a client is comes from their phone number, so saving the profile
 * must not send a country either: sending one would overwrite what the number says with whatever the form held.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

// One object for every render: the page re-reads the form whenever the user object changes, so a new object each time
// would re-render it forever.
const { patch, bootstrapMe, USER } = vi.hoisted(() => ({
  patch: vi.fn(),
  bootstrapMe: vi.fn(),
  USER: {
    id: "u1",
    fullName: "Amina Client",
    email: "amina@example.com",
    phone: "+254712345678",
    avatarUrl: null,
    countryCode: "KE"
  }
}));

vi.mock("../../../../shared/libs/api", () => ({
  default: { patch, post: vi.fn(), delete: vi.fn() }
}));
vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: USER, bootstrapMe })
}));
vi.mock("../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn() })
}));

import ClientProfilePage from "../Profile";

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <ClientProfilePage />
    </QueryClientProvider>
  );

beforeEach(() => {
  patch.mockReset();
  patch.mockResolvedValue({});
  bootstrapMe.mockReset();
  bootstrapMe.mockResolvedValue(null);
});

describe("the client profile", () => {
  it("has no country field, and says what the phone number is used for", () => {
    renderPage();

    expect(screen.queryByLabelText(/country/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/select your country/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toHaveAccessibleDescription(
      "Remote consultations are available for Kenyan numbers (+254) for now."
    );
  });

  it("saves the name, email and phone, and sends no country", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.clear(screen.getByLabelText("Phone"));
    await user.type(screen.getByLabelText("Phone"), "0722 000 111");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith("/users/u1", {
      full_name: "Amina Client",
      email: "amina@example.com",
      phone: "0722 000 111"
    });
    expect(Object.keys(patch.mock.calls[0][1])).not.toContain("country_code");
  });
});
