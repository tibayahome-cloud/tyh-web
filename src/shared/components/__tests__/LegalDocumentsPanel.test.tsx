import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LegalDocumentLinks } from "../LegalDocumentsPanel";

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("LegalDocumentLinks", () => {
  it("renders current Terms and Privacy document links", () => {
    renderWithRouter(<LegalDocumentLinks />);

    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    const viewLinks = screen.getAllByRole("link", { name: /View document/i });
    expect(viewLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/legal/terms-of-service-v1.0.pdf",
      "/legal/privacy-policy-v1.0.pdf"
    ]);
    expect(screen.getAllByText(/v1.0 effective 2026-08-11/i)).toHaveLength(2);
    expect(screen.getAllByText("Status unavailable")).toHaveLength(2);
  });

  it("renders accepted legal document status from the consent summary", () => {
    renderWithRouter(
      <LegalDocumentLinks
        acceptedBy="Demo Admin"
        consentDocuments={[
          {
            type: "terms",
            version: "v1.0",
            accepted: true,
            accepted_at: "2026-08-11T10:00:00+00:00"
          },
          {
            type: "privacy",
            version: "v1.0",
            accepted: true,
            accepted_at: "2026-08-11T10:00:00+00:00"
          }
        ]}
      />
    );

    expect(screen.getAllByText("Completed")).toHaveLength(2);
    expect(screen.getAllByText(/Accepted by Demo Admin on Aug 11, 2026/i)).toHaveLength(2);
    expect(screen.queryByText(/Review & accept/i)).not.toBeInTheDocument();
  });

  it("renders pending status when a current document has not been accepted", () => {
    renderWithRouter(
      <LegalDocumentLinks
        acceptedBy="Demo Admin"
        consentDocuments={[
          {
            type: "terms",
            version: "v1.0",
            accepted: true,
            accepted_at: "2026-08-11T10:00:00+00:00"
          },
          {
            type: "privacy",
            version: "v1.0",
            accepted: false,
            accepted_at: null
          }
        ]}
      />
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText(/Not accepted for this account/i)).toBeInTheDocument();
  });

  it("links a pending document to the in-app consent flow, not just the raw PDF", () => {
    renderWithRouter(
      <LegalDocumentLinks
        acceptedBy="Demo Provider"
        consentDocuments={[
          { type: "terms", version: "v1.0", accepted: false, accepted_at: null },
          { type: "privacy", version: "v1.0", accepted: false, accepted_at: null }
        ]}
      />
    );

    const reviewLinks = screen.getAllByRole("link", { name: /Review & accept/i });
    expect(reviewLinks).toHaveLength(2);
    reviewLinks.forEach((link) => expect(link).toHaveAttribute("href", "/legal/consent"));
  });

  it("does not offer to accept a document whose status is unknown", () => {
    renderWithRouter(<LegalDocumentLinks />);

    expect(screen.queryByText(/Review & accept/i)).not.toBeInTheDocument();
  });
});
