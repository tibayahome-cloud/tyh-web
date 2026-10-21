import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "../Modal";

describe("Modal", () => {
  it("always has a visible Close button, because a full-screen popup on a phone has no backdrop to tap", () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Report a problem" onClose={onClose}>
        <p>body</p>
      </Modal>
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("has the Close button even without a title", () => {
    render(
      <Modal open onClose={vi.fn()}>
        <p>body</p>
      </Modal>
    );

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
