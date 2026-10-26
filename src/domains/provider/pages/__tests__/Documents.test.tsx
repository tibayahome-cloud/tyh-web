/**
 * The provider's Documents page: one place for the documents we need (add, replace, remove and send are all on it) and the
 * legal agreements they have accepted.
 */

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ legal: [] as unknown[] }));

vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "p1", legalConsent: { required: true, complete: true, documents: state.legal } } }) }));
vi.mock("../../components/onboarding/VerificationPanel", () => ({ VerificationPanel: () => <section aria-label="Verification status">PANEL</section> }));

import DocumentsPage from "../Documents";

const renderPage = () =>
  render(
    <MemoryRouter>
      <DocumentsPage />
    </MemoryRouter>
  );

beforeEach(() => {
  state.legal = [];
});

describe("Documents page", () => {
  it("holds the verification documents itself, so nobody is sent to another page to add or remove one", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Verification status" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /verification page|Add them|Add your documents/ })).not.toBeInTheDocument();
  });

  it("lists each legal document with its version, when it was accepted and a link to read it", () => {
    state.legal = [
      { type: "terms", version: "2026-01", accepted: true, accepted_at: "2026-03-05T09:00:00+00:00", public_url: "https://example.test/terms" },
      { type: "privacy", version: "2026-01", accepted: true, accepted_at: null, public_url: "https://example.test/privacy" }
    ];
    renderPage();

    const list = screen.getByRole("list", { name: "Legal documents" });
    expect(within(list).getByText("Terms of Service")).toBeInTheDocument();
    expect(within(list).getByText(/Version 2026-01, accepted 5 Mar 2026/)).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "Read Terms of Service" })).toHaveAttribute("href", "https://example.test/terms");
    expect(within(list).getByRole("link", { name: "Read Privacy Policy" })).toHaveAttribute("target", "_blank");
  });

  it("says so when there are no legal documents to show", () => {
    renderPage();
    expect(screen.getByText("No legal documents to show yet.")).toBeInTheDocument();
  });
});
