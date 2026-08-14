import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiErrorBanner } from "../ApiErrorBanner";

describe("ApiErrorBanner", () => {
  it("renders the backend's own message, not a client-invented one", () => {
    render(<ApiErrorBanner category="bad_request" message="This hold has expired or is no longer active" />);

    expect(screen.getByRole("alert")).toHaveTextContent("This hold has expired or is no longer active");
  });

  it("shows a category-appropriate title for each category", () => {
    const { rerender } = render(<ApiErrorBanner category="forbidden" message="x" />);
    expect(screen.getByText("Not allowed")).toBeInTheDocument();

    rerender(<ApiErrorBanner category="unavailable" message="x" />);
    expect(screen.getByText("Temporarily unavailable")).toBeInTheDocument();
  });

  it("only shows a retry action when the caller provides one", () => {
    const { rerender } = render(<ApiErrorBanner category="timeout" message="x" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    const onRetry = vi.fn();
    rerender(<ApiErrorBanner category="timeout" message="x" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
