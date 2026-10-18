import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActionMenu } from "../ActionMenu";

const setup = () => {
  const items = [
    { key: "a", label: "Approve facility", onSelect: vi.fn() },
    { key: "b", label: "Suspend facility", onSelect: vi.fn() }
  ];
  render(<ActionMenu label="Manage" subject="Karen Clinic" items={items} />);
  return items;
};

describe("ActionMenu", () => {
  it("is a labelled menu button that names its subject and starts closed", () => {
    setup();
    const button = screen.getByRole("button", { name: "Manage Karen Clinic" });
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens with the keyboard, moves with the arrows and selects with Enter", async () => {
    const user = userEvent.setup();
    const items = setup();
    screen.getByRole("button", { name: "Manage Karen Clinic" }).focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("menu", { name: "Manage Karen Clinic" })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(items[1].onSelect).toHaveBeenCalledTimes(1));
    expect(items[0].onSelect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("closes on Escape without selecting and returns focus to the button", async () => {
    const user = userEvent.setup();
    const items = setup();
    const button = screen.getByRole("button", { name: "Manage Karen Clinic" });
    await user.click(button);
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(items.every((item) => item.onSelect.mock.calls.length === 0)).toBe(true);
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("renders nothing when there are no items", () => {
    const { container } = render(<ActionMenu label="Manage" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
