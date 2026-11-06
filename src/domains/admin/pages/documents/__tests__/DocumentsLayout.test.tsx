/** The documents area: the two kinds of documents side by side, with tabs and a landing that depend on the role. */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ superAdmin: false, attention: { providers_waiting: 0, facilities_waiting: 0, facility_sent_back: 0, total: 0 } }));
vi.mock("../../../../../shared/hooks/useRbac", () => ({ useRbac: () => ({ hasRole: () => state.superAdmin, roles: [] }) }));
vi.mock("../../../hooks/useDocumentsAttention", () => ({ useDocumentsAttention: () => ({ data: state.attention }) }));

import { DocumentsIndexRedirect, DocumentsLayout } from "../DocumentsLayout";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/documents" element={<DocumentsLayout />}>
          <Route index element={<DocumentsIndexRedirect />} />
          <Route path="providers" element={<p>providers page</p>} />
          <Route path="providers/:applicationId" element={<p>one provider</p>} />
          <Route path="facility" element={<p>our documents page</p>} />
          <Route path="facilities" element={<p>facilities page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  state.superAdmin = false;
  state.attention = { providers_waiting: 0, facilities_waiting: 0, facility_sent_back: 0, total: 0 };
});

describe("Documents area", () => {
  it("counts what needs a facility admin on each tab, and stays quiet at zero", () => {
    state.attention = { providers_waiting: 3, facilities_waiting: 0, facility_sent_back: 2, total: 5 };
    renderAt("/admin/documents/providers");

    expect(screen.getByLabelText("3 providers waiting for review")).toHaveTextContent("3");
    expect(screen.getByLabelText("2 documents sent back")).toHaveTextContent("2");
  });

  it("counts the facilities and providers waiting for a super admin", () => {
    state.superAdmin = true;
    state.attention = { providers_waiting: 1, facilities_waiting: 4, facility_sent_back: 0, total: 5 };
    renderAt("/admin/documents/facilities");

    expect(screen.getByLabelText("4 facilities waiting for review")).toBeInTheDocument();
    expect(screen.getByLabelText("1 providers waiting for review")).toBeInTheDocument();
  });

  it("shows no badge when nothing is waiting", () => {
    renderAt("/admin/documents/providers");

    expect(screen.queryByLabelText(/waiting for review|sent back/)).not.toBeInTheDocument();
  });

  it("gives a facility admin their providers' documents and their own", () => {
    renderAt("/admin/documents/providers");

    const links = screen.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]);
    expect(links).toEqual([
      ["Provider documents", "/admin/documents/providers"],
      ["Our documents", "/admin/documents/facility"]
    ]);
    expect(screen.getByRole("link", { name: "Provider documents" })).toHaveAttribute("aria-current", "page");
  });

  it("gives a super admin the facilities and the providers", () => {
    state.superAdmin = true;
    renderAt("/admin/documents/facilities");

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Facilities", "Providers"]);
    expect(screen.getByRole("link", { name: "Facilities" })).toHaveAttribute("aria-current", "page");
  });

  it("lands a facility admin on their providers' documents", () => {
    renderAt("/admin/documents");

    expect(screen.getByText("providers page")).toBeInTheDocument();
  });

  it("lands a super admin on the facilities", () => {
    state.superAdmin = true;
    renderAt("/admin/documents");

    expect(screen.getByText("facilities page")).toBeInTheDocument();
  });

  it("keeps the Providers tab current while one provider's documents are open", () => {
    state.superAdmin = true;
    renderAt("/admin/documents/providers/app-1");

    expect(screen.getByText("one provider")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Providers" })).toHaveAttribute("aria-current", "page");
  });
});
