import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProviderAvailabilityCard } from "../ProviderAvailabilityCard";
import { ProviderTelemedicineCard, type SpecialtyRow } from "../ProviderTelemedicineCard";

const win = (over: Record<string, unknown> = {}) =>
  ({ id: "w", weekday: "mon", startTime: "", endTime: "", startTimeLocal: "08:00:00", endTimeLocal: "17:00:00", deliveryMode: "remote", effectiveFrom: null, effectiveTo: null, ...over }) as never;

describe("ProviderAvailabilityCard", () => {
  it("shows every day with its hours and delivery mode, and the timezone", () => {
    render(<ProviderAvailabilityCard windows={[win(), win({ id: "x", weekday: "sat", startTimeLocal: "09:00:00", endTimeLocal: "13:00:00", deliveryMode: "both" })]} timezone="Africa/Nairobi" />);
    const list = screen.getByRole("list", { name: "Weekly availability" });
    expect(within(list).getAllByText(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/)).toHaveLength(7);
    expect(screen.getByText("08:00 to 17:00")).toBeInTheDocument();
    expect(screen.getByText("09:00 to 13:00")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
    expect(screen.getByText("Remote and in person")).toBeInTheDocument();
    expect(screen.getAllByText("Not available")).toHaveLength(5);
    expect(screen.getByText(/in Africa\/Nairobi time/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("warns that in-person-only hours cannot be booked for telemedicine", () => {
    render(<ProviderAvailabilityCard windows={[win({ deliveryMode: "in_person" })]} timezone={null} />);
    expect(screen.getByRole("status")).toHaveTextContent(/clients cannot book this provider for telemedicine/i);
  });

  it("explains an empty schedule", () => {
    render(<ProviderAvailabilityCard windows={[]} timezone={null} />);
    expect(screen.getByText(/No availability configured/)).toBeInTheDocument();
  });
});

const specialty = (over: Partial<SpecialtyRow> = {}): SpecialtyRow => ({
  id: "a1", subcategoryId: "s1", status: "active", name: "Cardiology", subcategoryStatus: "active", categoryName: "Specialist care", categoryStatus: "active", ...over
});
const base = { verified: true, telemedicineEnabled: true, accountStatus: "active", windows: [{ deliveryMode: "both" }] };

describe("ProviderTelemedicineCard", () => {
  it("says a fully set up provider is ready and groups specialties by category", () => {
    render(<ProviderTelemedicineCard {...base} specialties={[specialty(), specialty({ id: "a2", subcategoryId: "s2", name: "Dermatology", categoryName: "Skin" })]} />);
    expect(screen.getByText("Ready for telemedicine bookings")).toBeInTheDocument();
    expect(screen.getByText("Specialties (2)")).toBeInTheDocument();
    expect(screen.getByText("Specialist care")).toBeInTheDocument();
    expect(screen.getByText("Skin")).toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });

  it("lists every blocker with what to do, for a provider with nothing set up", () => {
    render(<ProviderTelemedicineCard verified={false} telemedicineEnabled={false} accountStatus="pending" specialties={[]} windows={[]} />);
    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent("Not bookable for telemedicine");
    for (const text of ["Account setup not finished", "Not verified", "Telemedicine is off", "No telemedicine specialties", "No remote availability"]) {
      expect(alert).toHaveTextContent(text);
    }
    expect(screen.getByText(/No telemedicine specialties assigned at this facility/)).toBeInTheDocument();
  });

  it("marks an archived specialty and does not count it", () => {
    render(<ProviderTelemedicineCard {...base} specialties={[specialty({ subcategoryStatus: "archived" })]} />);
    expect(screen.getByText("Cardiology (archived)")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No telemedicine specialties");
  });

  it("keeps removed assignments as history, not as current specialties", () => {
    render(<ProviderTelemedicineCard {...base} specialties={[specialty(), specialty({ id: "a2", name: "Urology", status: "removed" })]} />);
    expect(screen.getByText("Specialties (1)")).toBeInTheDocument();
    expect(screen.getByText(/Previously assigned: Urology \(removed\)/)).toBeInTheDocument();
  });
});
