import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../Button";
import { Input } from "../Input";

describe("colour overrides on shared components", () => {
  it("lets a page restyle a button: its colours replace the variant's, so the label is not white on white", () => {
    render(<Button className="bg-white text-brand-600">Continue</Button>);

    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toHaveClass("bg-white", "text-brand-600");
    expect(button).not.toHaveClass("bg-tiba-blue");
    expect(button).not.toHaveClass("text-white");
  });

  it("keeps the variant colours when the page adds only layout classes", () => {
    render(<Button className="h-12 rounded-2xl">Continue</Button>);

    expect(screen.getByRole("button", { name: "Continue" })).toHaveClass("bg-tiba-blue", "text-white", "h-12");
  });

  it("applies the same rule to a secondary button on a translucent surface", () => {
    render(
      <Button variant="secondary" className="bg-white/60 text-slate-900">
        Save
      </Button>
    );

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("bg-white/60", "text-slate-900");
    expect(button).not.toHaveClass("bg-tiba-gold");
  });

  it("makes the loading spinner follow the label colour", () => {
    render(
      <Button loading className="bg-white text-brand-600">
        Save
      </Button>
    );

    const spinner = screen.getByRole("button").querySelector("span[aria-hidden]");
    expect(spinner).toHaveClass("border-current");
  });

  it("lets an input take a page's border colour and drops the default", () => {
    render(<Input aria-label="Name" className="border-emerald-500" />);

    const input = screen.getByLabelText("Name");
    expect(input).toHaveClass("border-emerald-500");
    expect(input).not.toHaveClass("border-slate-200");
  });

  it("shows only the error border on an input in error", () => {
    render(<Input aria-label="Name" error="Required" />);

    const input = screen.getByLabelText("Name");
    expect(input).toHaveClass("border-red-400");
    expect(input).not.toHaveClass("border-slate-200");
  });
});
