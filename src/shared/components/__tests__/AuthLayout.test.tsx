import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthLayout } from "../AuthLayout";

describe("AuthLayout split variant", () => {
  const renderSplit = () =>
    render(
      <AuthLayout split title="Sign in to continue" subtitle="Welcome back" footer={<a href="/signup">Create account</a>}>
        <button type="button">Sign in</button>
      </AuthLayout>
    );

  it("renders the title, card content and footer in the form column", () => {
    renderSplit();

    expect(screen.getByRole("heading", { level: 1, name: "Sign in to continue" })).toBeInTheDocument();
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" })).toBeInTheDocument();
  });

  it("shows the image panel only from md up, as a decorative lazy-loaded picture", () => {
    const { container } = renderSplit();

    const panel = container.querySelector("aside") as HTMLElement;
    expect(panel.className).toContain("hidden");
    expect(panel.className).toContain("md:block");
    expect(panel).toHaveAttribute("aria-hidden", "true");

    const image = panel.querySelector("img") as HTMLImageElement;
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image.className).toContain("object-cover");
  });

  it("keeps the picture out of the accessibility tree and out of the reading order", () => {
    renderSplit();

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("leaves every other auth page on the centred layout", () => {
    const { container } = render(
      <AuthLayout title="Reset password">
        <p>form</p>
      </AuthLayout>
    );

    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getByRole("img", { name: "Tiba Ya Home" })).toBeInTheDocument();
  });
});
