import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SegmentedProgress } from "../SegmentedProgress";

describe("SegmentedProgress", () => {
  it("shows one segment per required document and fills the ones that are sent", () => {
    const { container } = render(<SegmentedProgress done={2} total={3} label="Documents provided" />);

    const bar = screen.getByRole("progressbar", { name: "Documents provided" });
    expect(bar).toHaveAttribute("aria-valuemax", "3");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    const segments = container.querySelectorAll("span");
    expect(segments).toHaveLength(3);
    expect(Array.from(segments).filter((segment) => segment.className.includes("bg-tiba-blue"))).toHaveLength(2);
  });

  it("never fills more than there are, and copes with nothing required", () => {
    const { container, rerender } = render(<SegmentedProgress done={9} total={3} label="x" />);
    expect(container.querySelectorAll("span.bg-tiba-blue")).toHaveLength(3);
    rerender(<SegmentedProgress done={0} total={0} label="x" />);
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });
});
