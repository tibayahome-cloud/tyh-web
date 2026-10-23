import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookingKindBadge } from "../BookingKindBadge";
import { CareTypeBadge, careTypeLabel, toCareType } from "../CareTypeBadge";

describe("CareTypeBadge", () => {
  it("uses one set of words for the three kinds of care", () => {
    expect(careTypeLabel("telemedicine")).toBe("Telemedicine");
    expect(careTypeLabel("home_based")).toBe("Home based");
    expect(careTypeLabel("ambulance")).toBe("Ambulance");
  });

  it("shows the word, not just a colour", () => {
    render(<CareTypeBadge careType="ambulance" />);

    expect(screen.getByText("Ambulance")).toBeInTheDocument();
  });

  it("reads an unknown or missing care type as home based, never as nothing", () => {
    expect(toCareType(undefined)).toBe("home_based");
    expect(toCareType("spaceship")).toBe("home_based");
    expect(toCareType("telemedicine")).toBe("telemedicine");
  });
});

describe("BookingKindBadge uses the same kinds", () => {
  it("says Telemedicine for a consultation, Ambulance for an ambulance booking, Home based otherwise", () => {
    const { rerender } = render(<BookingKindBadge isTelemedicine />);
    expect(screen.getByText("Telemedicine")).toBeInTheDocument();

    rerender(<BookingKindBadge isTelemedicine={false} careType="ambulance" />);
    expect(screen.getByText("Ambulance")).toBeInTheDocument();

    rerender(<BookingKindBadge isTelemedicine={false} />);
    expect(screen.getByText("Home based")).toBeInTheDocument();
  });
});
