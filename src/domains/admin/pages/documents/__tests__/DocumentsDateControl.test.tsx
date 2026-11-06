/** The documents date: everyone reads it, only the super admin moves it or removes it, and a failure keeps the dialog open. */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentsDateControl } from "../DocumentsDateControl";

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

describe("Documents date", () => {
  it("shows the date, or says there is none", () => {
    const { rerender } = render(<DocumentsDateControl dueOn="2026-12-01" subject="Example Clinic" canChange={false} onSave={vi.fn()} />);
    expect(screen.getByText("Documents date: 1 Dec 2026")).toBeInTheDocument();

    rerender(<DocumentsDateControl dueOn={null} subject="Example Clinic" canChange={false} onSave={vi.fn()} />);
    expect(screen.getByText("No documents date")).toBeInTheDocument();
  });

  it("gives only the super admin a way to change it", () => {
    const { rerender } = render(<DocumentsDateControl dueOn="2026-12-01" subject="Example Clinic" canChange={false} onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Change date" })).not.toBeInTheDocument();

    rerender(<DocumentsDateControl dueOn="2026-12-01" subject="Example Clinic" canChange onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Change date" })).toBeInTheDocument();
  });

  it("will not save until a date is chosen, then saves it", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<DocumentsDateControl dueOn="2026-12-01" subject="Example Clinic" canChange onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Change date" }));
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save date" });
    expect(save).toBeDisabled();
    expect(dialog).toHaveTextContent("Nothing is suspended either way");

    fireEvent.change(within(dialog).getByLabelText("New date"), { target: { value: tomorrow() } });
    fireEvent.click(save);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(tomorrow()));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("removes the date when asked, with no date typed", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<DocumentsDateControl dueOn="2026-12-01" subject="Example Clinic" canChange onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Change date" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Remove the date"));
    expect(within(dialog).getByLabelText("New date")).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save date" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it("keeps the dialog open when saving fails, so nothing typed is lost", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("no"));
    render(<DocumentsDateControl dueOn={null} subject="Example Clinic" canChange onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Change date" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("New date"), { target: { value: tomorrow() } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save date" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByLabelText("New date")).toHaveValue(tomorrow());
  });
});
