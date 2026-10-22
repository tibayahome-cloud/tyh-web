import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../Button";
import { Input } from "../Input";

describe("icons on Button and Input", () => {
  it("shows a button icon before the label and hides it from screen readers", () => {
    render(<Button icon={<svg data-testid="icon" />}>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toContainElement(screen.getByTestId("icon"));
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("does not pass the icon to the DOM element", () => {
    render(<Button icon={<svg data-testid="icon" />}>Save</Button>);

    expect(screen.getByRole("button")).not.toHaveAttribute("icon");
  });

  it("shows an input icon and makes room for it", () => {
    render(<Input aria-label="Phone" icon={<svg data-testid="icon" />} />);

    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toHaveClass("pl-10");
  });

  it("leaves the input padding alone without an icon", () => {
    render(<Input aria-label="Phone" />);

    expect(screen.getByLabelText("Phone")).not.toHaveClass("pl-10");
  });
});
