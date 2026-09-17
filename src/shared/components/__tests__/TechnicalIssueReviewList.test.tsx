/**
 * The list only ever received `issues` and `isLoading` -- a failed fetch had no way to say so,
 * and rendered the same "No open reports." copy as a genuinely clean queue. It's shared by both
 * the facility-scoped admin.ops queue and the platform-wide super-admin view, so this fix (and
 * this test) covers both call sites at once.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TechnicalIssueReviewList } from "../TechnicalIssueReviewList";

describe("TechnicalIssueReviewList", () => {
  it("shows a retryable error banner instead of the empty-state message when the fetch fails", () => {
    const onRetry = vi.fn();
    render(<TechnicalIssueReviewList issues={[]} isLoading={false} isError error={new Error()} onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load technical issue reports/i)).toBeInTheDocument();
    expect(screen.queryByText(/no open reports/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("still shows the plain empty-state message when there genuinely are no open issues", () => {
    render(<TechnicalIssueReviewList issues={[]} isLoading={false} />);

    expect(screen.getByText("No open reports.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the loading state ahead of the error state", () => {
    render(<TechnicalIssueReviewList issues={[]} isLoading isError error={new Error()} />);

    expect(screen.getByText(/loading review flags/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
