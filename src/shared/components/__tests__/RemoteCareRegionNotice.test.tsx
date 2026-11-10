/**
 * Nobody is asked to pick a country: where a client is comes from their phone number. When it cannot be worked out
 * (a number from outside Kenya, or none), the app says plainly that remote consultations are in Kenya for now and what
 * to do about it, instead of asking for a country.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RemoteCareRegionNotice } from "../RemoteCareRegionNotice";

describe("the remote care region notice", () => {
  it("says remote consultations are in Kenya for now, and how to get in", () => {
    render(<RemoteCareRegionNotice actionLabel="Update phone number" onAction={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Remote consultations are available in Kenya for now");
    expect(screen.getByRole("status")).toHaveTextContent("We read your country from your phone number");
    expect(screen.getByRole("status")).toHaveTextContent("add a Kenyan number (starting +254) to your profile");
  });

  it("never asks the person for a country", () => {
    render(<RemoteCareRegionNotice actionLabel="Update phone number" onAction={vi.fn()} />);

    expect(screen.queryByText(/country required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/add your country/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("offers one action, named by the caller, and runs it", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<RemoteCareRegionNotice actionLabel="Update phone number" onAction={onAction} />);

    await user.click(screen.getByRole("button", { name: "Update phone number" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
