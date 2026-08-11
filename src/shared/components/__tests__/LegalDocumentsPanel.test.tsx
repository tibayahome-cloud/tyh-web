import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LegalDocumentLinks } from "../LegalDocumentsPanel";

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("LegalDocumentLinks", () => {
  it("renders current Terms and Privacy documents with a view action, not a raw PDF link", () => {
    renderWithRouter(<LegalDocumentLinks />);

    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /View document/i })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /View document/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/v1.0 effective 2026-08-11/i)).toHaveLength(2);
    expect(screen.getAllByText("Status unavailable")).toHaveLength(2);
  });

  it("opens a document in an in-page preview instead of navigating away", async () => {
    const user = userEvent.setup();
    renderWithRouter(<LegalDocumentLinks />);

    expect(screen.queryByTitle("Terms of Service")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /View document/i })[0]);

    const preview = await screen.findByTitle("Terms of Service");
    expect(preview.tagName).toBe("IFRAME");
    expect(preview).toHaveAttribute("src", "/legal/terms-of-service-v1.0.pdf");
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
