/**
 * The public homepage introduces telemedicine and hands the visitor to the client app.
 * It must not become a second booking flow, and it must not put anything non-public on
 * an unauthenticated page: no provider names, no availability, no identifiers.
 *
 * These tests pin the handover and the absence, since both are easy to erode by adding
 * "just one" field to the section later.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const useServicesMock = vi.fn();

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => useAuthMock()
}));

vi.mock("../../../../shared/hooks/useServices", () => ({
  useServices: () => useServicesMock()
}));

import { Home } from "../Home";

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
});

const TELEMEDICINE_PAGE = "client-telemedicine-page";
const CLIENT_APP_HOME = "client-app-home";
const LOGIN_PAGE = "login-page";
const NOT_FOUND_FALLBACK = "not-found-fallback";

const CTA_NAME = /Book online consultation/i;

const renderHome = ({ isAuthenticated }: { isAuthenticated: boolean }) => {
  useAuthMock.mockReturnValue({ isAuthenticated });

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app/telemedicine" element={<div>{TELEMEDICINE_PAGE}</div>} />
        <Route path="/app/*" element={<div>{CLIENT_APP_HOME}</div>} />
        <Route path="/login" element={<div>{LOGIN_PAGE}</div>} />
        <Route path="/unknown" element={<div>{NOT_FOUND_FALLBACK}</div>} />
        <Route path="*" element={<Navigate to="/unknown" replace />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("public telemedicine entry point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useServicesMock.mockReturnValue({ data: [], isLoading: false });
  });

  describe("routing", () => {
    it("sends a signed-in client to the telemedicine booking screen", async () => {
      const user = userEvent.setup();
      renderHome({ isAuthenticated: true });

      await user.click(screen.getByRole("button", { name: CTA_NAME }));

      expect(screen.getByText(TELEMEDICINE_PAGE)).toBeInTheDocument();
      expect(screen.queryByText(LOGIN_PAGE)).not.toBeInTheDocument();
      expect(screen.queryByText(NOT_FOUND_FALLBACK)).not.toBeInTheDocument();
    });

    it("sends a signed-out visitor to sign in", async () => {
      const user = userEvent.setup();
      renderHome({ isAuthenticated: false });

      await user.click(screen.getByRole("button", { name: CTA_NAME }));

      expect(screen.getByText(LOGIN_PAGE)).toBeInTheDocument();
      expect(screen.queryByText(TELEMEDICINE_PAGE)).not.toBeInTheDocument();
    });

    it("does not open a booking form on the public page", () => {
      renderHome({ isAuthenticated: false });

      // The client app owns booking. A form or dialog appearing here would mean a second
      // flow had been introduced on a page that cannot authenticate the person using it.
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  describe("what the section is allowed to say", () => {
    const section = () => {
      const heading = screen.getByRole("heading", { name: /See a Doctor Online/i });
      const element = heading.closest("section");
      if (!element) throw new Error("Telemedicine section not found");
      return element;
    };

    it("renders its copy without any catalogue data", () => {
      // The hook is stubbed empty and undefined in turn; static copy must survive both,
      // which is what proves the section does not depend on a fetch.
      for (const stub of [{ data: [], isLoading: false }, { data: undefined, isLoading: true }]) {
        useServicesMock.mockReturnValue(stub);
        const view = renderHome({ isAuthenticated: false });

        const region = within(section());
        expect(region.getByText(/Online doctor consultations/i)).toBeInTheDocument();
        expect(region.getByText(/Secure video appointments/i)).toBeInTheDocument();
        expect(region.getByRole("button", { name: CTA_NAME })).toBeInTheDocument();

        view.unmount();
      }
    });

    it("renders no identifier-shaped strings", () => {
      renderHome({ isAuthenticated: false });

      const text = section().textContent ?? "";
      const html = section().innerHTML;

      const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      expect(text).not.toMatch(uuid);
      expect(html).not.toMatch(uuid);

      // Slugs like "general-practice" are stable catalogue keys, not display copy; they
      // would mean the section had started rendering catalogue records.
      expect(text).not.toMatch(/\b[a-z0-9]+(?:[-_][a-z0-9]+){1,}\b/);
    });

    it("names no provider and offers no availability", () => {
      renderHome({ isAuthenticated: false });

      const text = section().textContent ?? "";

      expect(text).not.toMatch(/\bDr\.?\s/i);
      expect(text).not.toMatch(/\bavailable (?:today|now|slots?)\b/i);
      expect(text).not.toMatch(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i);
    });
  });
});
