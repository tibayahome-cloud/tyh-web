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
  });
});
