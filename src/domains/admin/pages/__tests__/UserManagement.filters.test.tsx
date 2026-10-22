/**
 * The Filters popover on the Users page opens from the Filters button towards the right. It used to be right-aligned
 * to the button, which pushed it under the left sidebar where half of it was hidden.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/libs/api", () => ({
  api: { get: vi.fn().mockResolvedValue({ data: { data: [], meta: {} } }) }
}));
vi.mock("../../../../shared/hooks/useRbac", () => ({ useRbac: () => ({ hasPermission: () => false }) }));
vi.mock("../../../../shared/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));

import UserManagementPage from "../UserManagement";

describe("Users page filters popover", () => {
  it("opens aligned to the left edge of the Filters button, never pushed left under the sidebar", () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <UserManagementPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));

    const popover = screen.getByText("Status", { selector: "span" }).closest("div.absolute") as HTMLElement;
    expect(popover).toHaveClass("left-0");
    expect(popover).not.toHaveClass("md:right-0");
    expect(popover).not.toHaveClass("md:left-auto");
  });
});
