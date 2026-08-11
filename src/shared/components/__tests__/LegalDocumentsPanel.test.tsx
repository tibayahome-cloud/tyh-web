import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalDocumentLinks } from "../LegalDocumentsPanel";

describe("LegalDocumentLinks", () => {
  it("renders current Terms and Privacy document links", () => {
    render(<LegalDocumentLinks />);

    expect(screen.getByRole("link", { name: /Terms of Service/i })).toHaveAttribute(
      "href",
      "/legal/terms-of-service-v1.0.pdf"
    );
    expect(screen.getByRole("link", { name: /Privacy Policy/i })).toHaveAttribute(
      "href",
      "/legal/privacy-policy-v1.0.pdf"
    );
    expect(screen.getAllByText(/v1.0 effective 2026-08-11/i)).toHaveLength(2);
    expect(screen.getAllByText("Status unavailable")).toHaveLength(2);
  });

  it("renders accepted legal document status from the consent summary", () => {
    render(
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
  });

  it("renders pending status when a current document has not been accepted", () => {
    render(
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
});
