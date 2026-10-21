import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookingKindBadge } from "../BookingKindBadge";

describe("BookingKindBadge", () => {
  it("says Telemedicine for a remote consultation and Home based for a home visit, in words", () => {
    const { unmount } = render(<BookingKindBadge isTelemedicine />);
    expect(screen.getByText("Telemedicine")).toBeInTheDocument();
    expect(screen.queryByText(/video/i)).not.toBeInTheDocument();
    unmount();

    render(<BookingKindBadge isTelemedicine={false} />);
    expect(screen.getByText("Home based")).toBeInTheDocument();
  });
});
