import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";

import { TechnicalIssueDialog } from "../TechnicalIssueDialog";

const hooks = vi.hoisted(() => ({
  reportMutateAsync: vi.fn()
}));

vi.mock("../../hooks/useTelemedicine", () => ({
  useReportTechnicalIssueMutation: () => ({
    mutateAsync: hooks.reportMutateAsync,
    isPending: false
  })
}));

describe("TechnicalIssueDialog", () => {
  beforeEach(() => {
    hooks.reportMutateAsync.mockReset();
  });

  it("submits the category and description for the given booking", async () => {
    hooks.reportMutateAsync.mockResolvedValue({ id: "issue-1" });
    const onReported = vi.fn();
    const onClose = vi.fn();

    render(<TechnicalIssueDialog open bookingId="booking-1" onClose={onClose} onReported={onReported} />);

    fireEvent.change(screen.getByLabelText(/what kind of issue/i), { target: { value: "audio" } });
    fireEvent.change(screen.getByLabelText(/details/i), { target: { value: "Could not hear the provider" } });
    fireEvent.click(screen.getByRole("button", { name: "Report issue" }));

    await waitFor(() =>
      expect(hooks.reportMutateAsync).toHaveBeenCalledWith({
        bookingId: "booking-1",
        category: "audio",
        description: "Could not hear the provider"
      })
    );
    expect(onReported).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the backend's rejection reason instead of a generic failure", async () => {
    hooks.reportMutateAsync.mockRejectedValue(
      new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        statusText: "",
        headers: {},
        config: {},
        data: { error: { message: "Reporting window has passed for this appointment" } }
      })
    );

    render(<TechnicalIssueDialog open bookingId="booking-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Report issue" }));

    expect(await screen.findByText("Reporting window has passed for this appointment")).toBeInTheDocument();
  });

  it("never claims a refund or resolution in its copy", () => {
    render(<TechnicalIssueDialog open bookingId="booking-1" onClose={vi.fn()} />);
    expect(screen.getByText(/doesn't request a refund/i)).toBeInTheDocument();
  });
});
