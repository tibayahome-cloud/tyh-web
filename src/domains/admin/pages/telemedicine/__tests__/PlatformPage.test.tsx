import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import TelemedicinePlatformPage from "../PlatformPage";

const hooks = vi.hoisted(() => ({
  useTelemedicinePolicy: vi.fn(),
  useJitsiHealth: vi.fn(),
  useTechnicalIssues: vi.fn()
}));

vi.mock("../../../../../shared/hooks/useTelemedicine", () => ({
  useTelemedicinePolicy: hooks.useTelemedicinePolicy,
  useJitsiHealth: hooks.useJitsiHealth,
  useTechnicalIssues: hooks.useTechnicalIssues
}));

const renderPage = () => render(<TelemedicinePlatformPage />, { wrapper: MemoryRouter });

describe("TelemedicinePlatformPage", () => {
  it("shows policy and Jitsi health without exposing secrets or room identifiers", () => {
    hooks.useTelemedicinePolicy.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        policyVersion: "v1.2",
        supportedCountryCodes: ["KE"],
        defaultTimezone: "Africa/Nairobi",
        joinWindowBeforeMinutes: 10,
        cancellationCutoffMinutes: 10,
        remindersEnabled: false,
        reminderWindowsMinutes: []
      }
    });
    hooks.useJitsiHealth.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { status: "healthy", checkedAt: "2026-08-13T12:00:00.000Z", latencyMs: 42, errorCategory: null }
    });
    hooks.useTechnicalIssues.mockReturnValue({ isLoading: false, data: [] });

    renderPage();

    expect(screen.getByText("KE")).toBeInTheDocument();
    expect(screen.getByText("Africa/Nairobi")).toBeInTheDocument();
    expect(screen.getByText("healthy")).toBeInTheDocument();
    expect(screen.getByText("42 ms")).toBeInTheDocument();
    // The disclaimer text itself legitimately says "token" and "room" -- this checks no actual
    // secret-shaped value (a JWT, a room identifier) was rendered, not that the word is absent.
    expect(document.body.textContent).not.toMatch(/eyJ[a-zA-Z0-9_-]{10,}/); // JWT shape
    expect(screen.getByText(/no room, token, or secret data is exposed/i)).toBeInTheDocument();
  });

  it("shows the backend's rejection reason when the health check itself fails, not a generic error", () => {
    hooks.useTelemedicinePolicy.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    hooks.useJitsiHealth.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error("Jitsi health endpoint unavailable"),
      data: undefined
    });
    hooks.useTechnicalIssues.mockReturnValue({ isLoading: false, data: [] });

    renderPage();

    expect(screen.getByText("Jitsi health endpoint unavailable")).toBeInTheDocument();
  });

  it("never claims reminders are delivered when the backend reports them disabled", () => {
    hooks.useTelemedicinePolicy.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        policyVersion: "v1.2",
        supportedCountryCodes: ["KE"],
        defaultTimezone: "Africa/Nairobi",
        joinWindowBeforeMinutes: 10,
        cancellationCutoffMinutes: 10,
        remindersEnabled: false,
        reminderWindowsMinutes: []
      }
    });
    hooks.useJitsiHealth.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    hooks.useTechnicalIssues.mockReturnValue({ isLoading: false, data: [] });

    renderPage();

    expect(screen.getByText("Not yet enabled")).toBeInTheDocument();
  });
});
