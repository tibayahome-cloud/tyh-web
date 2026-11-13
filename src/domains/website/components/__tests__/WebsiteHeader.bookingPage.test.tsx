/**
 * On the booking page the page is the booking, so the site header steps back: no "Book Now" (it goes to the sign-in page,
 * away from a booking in progress), no menu button that opens a menu with nothing else in it, a way to ring on a phone,
 * and a slimmer bar so the first choice is not pushed down the screen. Everywhere else the header is as it was.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { COMPANY_PHONE, COMPANY_PHONE_DISPLAY } from "../../../../shared/constants/contact";
import { WebsiteHeader } from "../WebsiteHeader";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <WebsiteHeader />
    </MemoryRouter>
  );

describe("the site header on the booking page", () => {
  it("offers no Book Now, which would lead to sign-in and away from the booking", () => {
    renderAt("/book/telemedicine");

    expect(screen.queryByRole("link", { name: "Book Now" })).not.toBeInTheDocument();
  });

  it("has no menu button, because the menu held only that one link", () => {
    renderAt("/book/telemedicine");

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets a phone visitor ring with one tap, in a touch-sized target", () => {
    renderAt("/book/telemedicine");

    const call = screen.getByRole("link", { name: `Call ${COMPANY_PHONE_DISPLAY}` });
    expect(call).toHaveAttribute("href", `tel:${COMPANY_PHONE}`);
    expect(call).toHaveClass("h-11", "w-11");
  });

  it("keeps the number on the bar for wider screens, and the logo as the way home", () => {
    renderAt("/book/telemedicine");

    expect(screen.getByRole("link", { name: COMPANY_PHONE_DISPLAY })).toHaveAttribute("href", `tel:${COMPANY_PHONE}`);
    expect(screen.getByRole("link", { name: "Tiba Ya Home" })).toHaveAttribute("href", "/");
  });

  it("is a slimmer bar than elsewhere", () => {
    const { container } = renderAt("/book/telemedicine");

    expect(container.querySelector("header")).toHaveClass("py-2");
    expect(container.querySelector("header > div > div")).toHaveClass("h-14");
  });
});

describe("the site header on the home care booking page", () => {
  it("steps back the same way: no Book Now to itself and no empty menu, and the number stays one tap away", () => {
    renderAt("/book/home-care");

    expect(screen.queryByRole("link", { name: "Book Now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Call ${COMPANY_PHONE_DISPLAY}` })).toHaveAttribute("href", `tel:${COMPANY_PHONE}`);
  });
});

describe("the site header elsewhere", () => {
  it("keeps Book Now and the menu button on the landing page", () => {
    renderAt("/");

    expect(screen.getByRole("link", { name: "Book Now" })).toHaveAttribute("href", "/book/home-care");
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: `Call ${COMPANY_PHONE_DISPLAY}` })).not.toBeInTheDocument();
  });

  it("keeps its full height on the landing page", () => {
    const { container } = renderAt("/");

    expect(container.querySelector("header")).toHaveClass("py-5");
    expect(container.querySelector("header > div > div")).toHaveClass("h-20");
  });
});
