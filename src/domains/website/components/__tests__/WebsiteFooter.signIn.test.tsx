/** The footer gives a returning client and facility staff a way in, so nobody has to edit the address bar. */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { WebsiteFooter } from "../WebsiteFooter";

describe("the site footer sign-in links", () => {
  it("links to the personal sign-in page and to the facility sign-in page", () => {
    render(
      <MemoryRouter>
        <WebsiteFooter />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Clinic and facility sign in" })).toHaveAttribute("href", "/facility/login");
  });
});
