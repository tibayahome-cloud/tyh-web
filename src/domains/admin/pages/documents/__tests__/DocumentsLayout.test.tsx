/** The documents area: the two kinds of documents side by side, with tabs and a landing that depend on the role. */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ superAdmin: false }));
vi.mock("../../../../../shared/hooks/useRbac", () => ({ useRbac: () => ({ hasRole: () => state.superAdmin, roles: [] }) }));

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
});

describe("Documents area", () => {
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
