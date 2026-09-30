/**
 * The facility portal's front door. One facility opens straight away, several show a selector,
 * none explains itself, and a failed request can be retried. The list comes from the API, which
 * only returns facilities this account may manage.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchFacilitiesMock = vi.fn();

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: (...args: unknown[]) => fetchFacilitiesMock(...args)
}));

import FacilityHomePage from "../FacilityHomePage";

const facility = (id: string, name: string, county = "Nairobi", status = "active") =>
  ({ id, name, county, status }) as never;

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/admin/facility"]}>
        <Routes>
          <Route path="/admin/facility" element={<FacilityHomePage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("facility portal front door", () => {
  beforeEach(() => {
    fetchFacilitiesMock.mockReset();
  });

  it("opens the only permitted facility without asking", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [facility("f-1", "Kilimani Clinic")] });
    renderPage();

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin/facilities/f-1"));
    expect(screen.queryByText("Choose a facility")).not.toBeInTheDocument();
  });

  it("shows a selector only when the account has several facilities", async () => {
    fetchFacilitiesMock.mockResolvedValue({
      facilities: [facility("f-1", "Kilimani Clinic", "Nairobi"), facility("f-2", "Nyali Hospital", "Mombasa", "pending")]
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Choose a facility" })).toBeInTheDocument();
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/admin/facilities/f-1", "/admin/facilities/f-2"]);
    expect(within(links[0]).getByText("Kilimani Clinic")).toBeInTheDocument();
    expect(within(links[1]).getByText(/Mombasa · Pending approval/)).toBeInTheDocument();
    links.forEach((link) => expect(link.className).toContain("min-h-14"));
  });

  it("opens the chosen facility", async () => {
    const user = userEvent.setup();
    fetchFacilitiesMock.mockResolvedValue({ facilities: [facility("f-1", "Kilimani Clinic"), facility("f-2", "Nyali Hospital")] });
    renderPage();

    await user.click(await screen.findByRole("link", { name: /Nyali Hospital/ }));

    expect(screen.getByTestId("where")).toHaveTextContent("/admin/facilities/f-2");
  });

  it("asks the API for the account's facilities and links to nothing it did not return", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [facility("f-1", "A"), facility("f-2", "B")] });
    renderPage();

    await screen.findByRole("heading", { name: "Choose a facility" });
    expect(fetchFacilitiesMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/admin/facilities/f-1",
      "/admin/facilities/f-2"
    ]);
  });

  it("explains when no facility is linked and offers support", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [] });
    renderPage();

    expect(await screen.findByText(/No active facility is linked to your account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "/admin/conversations");
  });

  it("shows a loading state first", () => {
    fetchFacilitiesMock.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(screen.queryByText("Choose a facility")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/No active facility/);
  });

  it("shows an error in an alert and retries from the button", async () => {
    const user = userEvent.setup();
    fetchFacilitiesMock.mockRejectedValueOnce(new Error("Network Error"));
    fetchFacilitiesMock.mockResolvedValueOnce({ facilities: [facility("f-1", "A"), facility("f-2", "B")] });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Network Error");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Choose a facility" })).toBeInTheDocument();
    expect(fetchFacilitiesMock).toHaveBeenCalledTimes(2);
  });
});
