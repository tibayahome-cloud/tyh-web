import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { VideoConsultationDetails } from "../VideoConsultationDetails";

const asProps = (value: Record<string, unknown>) => value as unknown as React.ComponentProps<typeof VideoConsultationDetails>;

const props = (provider: unknown): Record<string, unknown> => ({
  booking: {
    id: "b1",
    status: "telemedicine_paid_pending_assignment",
    scheduledAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    estimateDurationMinutes: 30,
    provider,
    service: { name: "General consultation" }
  } as never,
  timezone: "Africa/Nairobi",
  joinWindowBeforeMinutes: 10,
  statusLabel: "Awaiting Provider",
  statusClassName: "",
  unattended: false,
  onBack: vi.fn(),
  onJoin: vi.fn(),
  onChat: vi.fn(),
  cancel: null,
  reportNoShow: null,
  noShowReported: false,
  reportTechnicalIssue: null,
  reschedule: null,
  paymentNotice: null,
  feedback: null,
  onBackToBookings: vi.fn()
});

describe("client video consultation: Join needs a doctor", () => {
  it("offers no Join button while no doctor is assigned, even when the time has come", () => {
    render(
      <MemoryRouter>
        <VideoConsultationDetails {...asProps(props(null))} />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Join call" })).not.toBeInTheDocument();
    expect(screen.getByText(/a doctor has not been assigned/i)).toBeInTheDocument();
  });

  it("offers Join once a doctor is assigned and the call is open", () => {
    render(
      <MemoryRouter>
        <VideoConsultationDetails {...asProps(props({ id: "p1", fullName: "Dr Example" }))} />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Join call" })).toBeInTheDocument();
  });
});
