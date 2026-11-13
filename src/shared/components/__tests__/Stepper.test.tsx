import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stepper } from "../Stepper";

const steps = [{ title: "Service" }, { title: "Facility" }, { title: "Slot" }, { title: "Confirm" }];

describe("Stepper", () => {
  it("colours the current step with the app's blue, not an undefined colour (it used to be white on white)", () => {
    render(<Stepper steps={steps} current={1} />);

    const badge = screen.getByText("2");
    expect(badge.className).toContain("bg-tiba-blue");
    expect(badge.className).not.toContain("primary");
    expect(screen.getByText("Facility").className).toContain("text-tiba-blue");
  });

  it("marks finished steps and leaves later ones grey", () => {
    render(<Stepper steps={steps} current={2} />);

    expect(screen.getAllByText("✓")).toHaveLength(2);
    expect(screen.getByText("4").className).toContain("bg-slate-200");
  });

  it("offers a one-line version for phones: step number, name and a progress bar", () => {
    render(<Stepper steps={steps} current={1} compactOnMobile />);

    const progress = screen.getByRole("group", { name: "Progress" });
    expect(progress).toHaveTextContent("Step 2 of 4: Facility");
    expect(progress.className).toContain("sm:hidden");
    // The full list stays for larger screens and is hidden below them.
    expect(screen.getByRole("list").className).toContain("hidden");
  });

  it("shows only the full list when the compact version is not asked for", () => {
    render(<Stepper steps={steps} current={0} />);

    expect(screen.queryByRole("group", { name: "Progress" })).not.toBeInTheDocument();
    expect(screen.getByRole("list").className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });
});
