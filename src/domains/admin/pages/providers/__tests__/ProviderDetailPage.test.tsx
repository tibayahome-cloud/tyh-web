/**
 * The super-admin provider console: one header with every action, tabs for the sections, and the
 * ability to edit a provider's schedule, time off, services and details on their behalf.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

let denied: string[] = [];
let applicationStatus = "approved";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../../../shared/libs/api", () => ({ api }));
vi.mock("../../../../../shared/hooks/useRbac", () => ({
  useRbac: () => ({ roles: ["admin.super"], hasPermission: (perm: string) => !denied.includes(perm), hasRole: () => true })
}));
vi.mock("../../../../../shared/libs/facilities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../shared/libs/facilities")>()),
  fetchFacilityBookings: vi.fn().mockResolvedValue({ bookings: [], meta: null, counts: null, raw: {} }),
  updateFacilityProvider: vi.fn().mockResolvedValue({})
}));
vi.mock("../../../../../shared/libs/telemedicineCatalog", () => ({
  fetchSelectableTelemedicineSubcategories: vi.fn().mockResolvedValue([
    { id: "s1", name: "Cardiology", category: { id: "c1", name: "Specialist care" } },
    { id: "s2", name: "Dermatology", category: { id: "c1", name: "Specialist care" } }
  ])
}));

import { fetchFacilityBookings, updateFacilityProvider } from "../../../../../shared/libs/facilities";
import { ToastProvider } from "../../../../../shared/components/ToastProvider";
import ProviderDetailPage from "../ProviderDetailPage";

const providerPayload = {
  id: "p1", user_id: "u1", verified: true, telemedicine_enabled: true, is_available: true, can_emergency: false,
  daily_request_limit: 5, timezone: "Africa/Nairobi", rating_avg: 4.5, rating_count: 3,
  facility: { id: "f1", name: "Care Point" },
  user: { id: "u1", full_name: "Dr Gitobu", email: "g@care.test", phone: "+254700000001", status: "active" },
  services: [],
  availability: [
    { id: "w1", weekday: "mon", start_time: "05:00:00+00", end_time: "14:00:00+00", start_time_local: "08:00:00", end_time_local: "17:00:00", delivery_mode: "remote", slot_duration_minutes: 45, effective_from: null, effective_to: null }
  ],
  blackouts: [
    { id: "b-future", start_at: new Date(Date.now() + 86_400_000).toISOString(), end_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), reason: "Leave" },
    { id: "b-past", start_at: "2020-01-01T08:00:00Z", end_at: "2020-01-02T08:00:00Z", reason: "Old" }
  ],
  telemedicine_subcategory_assignments: [
    { id: "a1", subcategory_id: "s1", status: "active", subcategory: { id: "s1", name: "Cardiology", status: "active", category: { id: "c1", name: "Specialist care", status: "active" } } }
  ]
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/providers/u1"]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <Routes>
            <Route path="/admin/providers/:userId" element={<ProviderDetailPage />} />
          </Routes>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );

let offered: unknown[] = [];

beforeEach(() => {
  denied = [];
  offered = [];
  applicationStatus = "approved";
  vi.clearAllMocks();
  vi.mocked(fetchFacilityBookings).mockResolvedValue({ bookings: [], meta: null, counts: null, raw: {} } as never);
  api.put.mockResolvedValue({});
  api.post.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({});
  api.get.mockImplementation(async (url: string) => {
    if (url === "/providers/u1") return { data: { data: providerPayload } };
    if (url === "/providers/u1/analytics") return { data: { data: { rank: 1, total_providers: 4, rating_avg: 4.5, rating_count: 3, active_services: 2, upcoming_blackouts: 1 } } };
    if (url === "/provider-applications")
      return { data: { data: [{ id: "app1", status: applicationStatus, progress_percent: 50, items: [] }] } };
    if (url === "/users/u1/activity") return { data: { data: { audit: [{ id: "e1", action: "UPDATE", resource_type: "provider_availability", at: "2026-10-13T08:00:00Z", reason: "provider availability replaced" }], requests: [] } } };
    if (url === "/providers/u1/available-services") return { data: { data: offered } };
    return { data: { data: [] } };
  });
});

describe("provider header and actions", () => {
  it("puts every action in the header, not in a bar pinned to the bottom of the screen", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Dr Gitobu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /More actions/ })).toBeInTheDocument();
    // The old pinned bar had a bare "Back" button and a "Refresh data" button on the page.
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh data" })).not.toBeInTheDocument();
  });

  it("keeps occasional actions in the menu, with the right wording for the current state", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /More actions/ }));
    expect(screen.getByRole("menuitem", { name: "Mark offline" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Enable emergency" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Resend welcome message" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Refresh data" })).toBeInTheDocument();
  });

  it("shows Approve and Reject only while an application is waiting for a decision", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Dr Gitobu" });
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("approves with the API's decision value and the provider's facility", async () => {
    applicationStatus = "submitted";
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("button", { name: "Approve provider" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/provider-applications/app1/review", { decision: "approved", facility_id: "f1" })
    );
  });

  it("rejects with 'rejected' and the reviewer's note", async () => {
    applicationStatus = "under_review";
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Reject" }));
    await user.type(screen.getByRole("textbox"), "Missing licence");
    await user.click(screen.getByRole("button", { name: "Reject application" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/provider-applications/app1/review", { decision: "rejected", notes: "Missing licence" })
    );
  });

  it("hides editing from someone who cannot manage providers", async () => {
    denied = ["provider:verify"];
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Dr Gitobu" });
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Schedule" }));
    expect(screen.queryByRole("button", { name: "Edit weekly hours" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add time off" })).not.toBeInTheDocument();
  });

  it("no longer shows made-up insights", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Dr Gitobu" });
    expect(screen.queryByText(/Positive Sentiment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pediatric care/i)).not.toBeInTheDocument();
  });
});

describe("tabs", () => {
  it("offers a tab for each section and shows the recent activity on Overview", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Dr Gitobu" });
    for (const name of ["Overview", "Schedule", "Services and specialties", "Bookings", "Onboarding"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
    expect(await screen.findByText(/Update provider availability/i)).toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    renderPage();
    const overview = await screen.findByRole("tab", { name: "Overview" });
    overview.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Schedule" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("editing the schedule on the provider's behalf", () => {
  it("saves changed hours and keeps the delivery mode and slot length the provider's own screen cannot set", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Schedule" }));
    await user.click(screen.getByRole("button", { name: "Edit weekly hours" }));
    expect(screen.getByText(/Dr Gitobu is notified when you save/)).toBeInTheDocument();

    const end = screen.getByLabelText("Monday end time");
    await user.clear(end);
    await user.type(end, "18:00");
    await user.click(screen.getByRole("button", { name: "Save weekly hours" }));
    await user.click(screen.getByRole("button", { name: "Save and notify" }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/providers/u1/availability", [
        { weekday: "mon", start_time: "08:00", end_time: "18:00", delivery_mode: "remote", effective_from: null, effective_to: null, slot_duration_minutes: 45 }
      ])
    );
  });

  it("will not save a window that ends before it starts", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Schedule" }));
    await user.click(screen.getByRole("button", { name: "Edit weekly hours" }));
    const end = screen.getByLabelText("Monday end time");
    await user.clear(end);
    await user.type(end, "07:00");
    expect(await screen.findByRole("alert")).toHaveTextContent(/after start/);
    expect(screen.getByRole("button", { name: "Save weekly hours" })).toBeDisabled();
  });

  it("shows only upcoming time off, and removes it after confirming", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Schedule" }));
    const list = await screen.findByRole("list", { name: "Upcoming time off" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Old")).not.toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: /Remove time off starting/ }));
    await user.click(screen.getByRole("button", { name: "Remove time off" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/providers/u1/blackouts/b-future"));
  });

  it("adds time off", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Schedule" }));
    await user.click(await screen.findByRole("button", { name: "Add time off" }));
    await user.type(screen.getByLabelText("Starts"), "2030-01-10T09:00");
    await user.type(screen.getByLabelText("Ends"), "2030-01-10T17:00");
    await user.click(screen.getAllByRole("button", { name: "Add time off" }).at(-1) as HTMLElement);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/providers/u1/blackouts", expect.objectContaining({ start_at: expect.any(String), end_at: expect.any(String) }))
    );
  });
});

describe("editing details and specialties", () => {
  it("saves new contact details through the facility provider route", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit details" }));
    const name = screen.getByLabelText("Full name");
    await user.clear(name);
    await user.type(name, "Dr Gitobu Mwangi");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateFacilityProvider).toHaveBeenCalledWith("f1", "u1", { fullName: "Dr Gitobu Mwangi", email: "g@care.test", phone: "+254700000001" })
    );
  });

  it("will not save a provider with no name or no way to reach them", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit details" }));
    await user.clear(screen.getByLabelText("Email"));
    await user.clear(screen.getByLabelText("Phone"));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("saves the chosen remote specialties", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Services and specialties" }));
    await user.click(screen.getByRole("button", { name: "Edit remote specialties" }));
    await user.click(await screen.findByRole("checkbox", { name: "Dermatology" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateFacilityProvider).toHaveBeenCalledWith("f1", "u1", { telemedicineSubcategoryIds: ["s1", "s2"] }));
  });
});

describe("provider bookings", () => {
  it("asks for only this provider's bookings and opens on everything", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Bookings" }));
    await waitFor(() =>
      expect(fetchFacilityBookings).toHaveBeenCalledWith("f1", expect.objectContaining({ providerUserId: "u1", isTelemedicine: false }))
    );
    expect(screen.getByText("Bookings for Dr Gitobu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("assigning services to a provider", () => {
  const offering = (id: string, name: string, active = true) => ({ id: `o-${id}`, active, service: { id, name, key: id, active: true } });

  it("lists only what the provider's facility offers, and saves the ticked ones", async () => {
    offered = [offering("sv1", "ECG at home"), offering("sv2", "Wound dressing"), offering("sv3", "Old offer", false)];
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Services and specialties" }));
    await user.click(screen.getByRole("button", { name: "Manage services" }));

    expect(await screen.findByRole("checkbox", { name: "ECG at home" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Old offer" })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/services", expect.anything());

    await user.click(screen.getByRole("checkbox", { name: "Wound dressing" }));
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await user.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/providers/u1/services", ["sv2"]));
  });

  it("says what to do when the facility offers nothing yet", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Services and specialties" }));
    await user.click(screen.getByRole("button", { name: "Manage services" }));

    expect(await screen.findByText(/does not offer any services yet/)).toBeInTheDocument();
  });
});
