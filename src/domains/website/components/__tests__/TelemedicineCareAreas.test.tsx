import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TelemedicineCareAreas } from "../TelemedicineCareAreas";

describe("TelemedicineCareAreas (public landing strip)", () => {
  it("lists six equal care areas, mental health among them", () => {
    render(<TelemedicineCareAreas />);

    const list = screen.getByRole("list", { name: "Care areas available online" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(within(list).getByText("Mental health")).toBeInTheDocument();
    expect(within(list).getByText("General consultations")).toBeInTheDocument();
  });

  it("gives every area an identical footprint so mental health is not promoted over the rest", () => {
    render(<TelemedicineCareAreas />);

    const items = screen.getAllByRole("listitem");
    const shape = (item: HTMLElement) =>
      (item.querySelector("[data-visual-source]") as HTMLElement).className.replace(/\bbg-[a-z]+-\d+\b/g, "").trim();
    const first = shape(items[0]);
    items.forEach((item) => expect(shape(item)).toBe(first));
    expect(first).toContain("aspect-square");
  });

  it("uses decorative, lazy, fixed-size pictures and keeps the visible labels as the meaning", () => {
    render(<TelemedicineCareAreas />);

    const images = Array.from(document.querySelectorAll("img"));
    expect(images.length).toBe(6);
    images.forEach((image) => {
      expect(image).toHaveAttribute("alt", "");
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("width", "256");
      expect(image).toHaveAttribute("height", "256");
    });
    const mental = screen.getByText("Mental health").closest("li") as HTMLElement;
    expect(mental.querySelector("img")?.getAttribute("src")).toContain("mental-health-support");
  });

  it("degrades to an icon when a picture fails, keeping the label", () => {
    render(<TelemedicineCareAreas />);

    const mental = screen.getByText("Mental health").closest("li") as HTMLElement;
    fireEvent.error(mental.querySelector("img") as HTMLImageElement);

    expect(mental.querySelector("img")).toBeNull();
    expect(mental.querySelector("[data-visual-source]")).toHaveAttribute("data-visual-source", "icon");
    expect(within(mental).getByText("Mental health")).toBeInTheDocument();
  });

  it("is static: no controls, no ambulance imagery, no catalogue identifiers", () => {
    const { container } = render(<TelemedicineCareAreas />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/ambulance|referral|care-?connect/i);
    expect(container.textContent ?? "").not.toMatch(/\b[a-z0-9]+(?:[-_][a-z0-9]+){1,}\b/);
  });
});
