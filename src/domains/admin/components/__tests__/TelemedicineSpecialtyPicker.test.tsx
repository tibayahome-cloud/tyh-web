import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { holdersBySpecialty, offeredServicesBySpecialty } from "../../../../shared/utils/specialtyContext";
import { TelemedicineSpecialtyPicker } from "../TelemedicineSpecialtyPicker";

const cat = { id: "c1", name: "WellnessCare" };
const specialties = [
  { id: "psych", name: "Psychology and Counselling", category: cat },
  { id: "ortho", name: "Orthopaedics", category: { id: "c2", name: "SpecialistCare" } },
  { id: "cardio", name: "Cardiology", category: { id: "c2", name: "SpecialistCare" } }
];

const renderPicker = (over: Partial<React.ComponentProps<typeof TelemedicineSpecialtyPicker>> = {}) => {
  const onToggle = vi.fn();
  render(
    <TelemedicineSpecialtyPicker
      specialties={specialties}
      selectedIds={[]}
      onToggle={onToggle}
      offered={new Map([["psych", ["counselling and mental health care"]]])}
      holders={new Map()}
      {...over}
    />
  );
  return onToggle;
};

describe("TelemedicineSpecialtyPicker", () => {
  it("lists the specialties the facility already offers first, naming the service and that nobody holds it yet", () => {
    renderPicker();
    const offered = screen.getByText("Offered at this facility").parentElement as HTMLElement;
    expect(within(offered).getByText("Psychology and Counselling")).toBeInTheDocument();
    expect(within(offered).getByText(/Offered here: counselling and mental health care/)).toBeInTheDocument();
    expect(within(offered).getByText("No provider holds this yet")).toBeInTheDocument();
    expect(within(offered).queryByText("Orthopaedics")).not.toBeInTheDocument();
  });

  it("says how many providers already hold an offered specialty", () => {
    renderPicker({ holders: new Map([["psych", 2]]) });
    expect(screen.getByText("2 providers hold this")).toBeInTheDocument();
  });

  it("finds a specialty by the name of the service the admin added", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.type(screen.getByRole("textbox", { name: "Search specialties" }), "mental health");
    expect(screen.getByText("Psychology and Counselling")).toBeInTheDocument();
    expect(screen.queryByText("Cardiology")).not.toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.type(screen.getByRole("textbox", { name: "Search specialties" }), "zzz");
    expect(screen.getByText(/No specialty or service matches "zzz"/)).toBeInTheDocument();
  });

  it("toggles a specialty", async () => {
    const user = userEvent.setup();
    const onToggle = renderPicker();
    await user.click(screen.getByRole("checkbox", { name: /Psychology and Counselling/ }));
    expect(onToggle).toHaveBeenCalledWith("psych");
  });
});

describe("specialty context", () => {
  it("maps each specialty to the active services the facility offers under it", () => {
    const offered = offeredServicesBySpecialty(
      [
        { serviceId: "s1", active: true, service: { name: "counselling and mental health care" } },
        { serviceId: "s2", active: false, service: { name: "inactive one" } },
        { serviceId: "s3", active: true, service: null }
      ],
      [
        { id: "s1", subcategoryId: "psych", name: "x" },
        { id: "s2", subcategoryId: "psych", name: "y" },
        { id: "s3", subcategoryId: "ortho", name: "Orthopaedic review" }
      ]
    );
    expect(offered.get("psych")).toEqual(["counselling and mental health care"]);
    expect(offered.get("ortho")).toEqual(["Orthopaedic review"]);
  });

  it("counts providers holding a specialty, ignoring removed assignments", () => {
    const holders = holdersBySpecialty([
      { telemedicineSubcategoryAssignments: [{ subcategoryId: "psych", status: "active" }] },
      { telemedicineSubcategoryAssignments: [{ subcategoryId: "psych", status: "removed" }, { subcategoryId: "ortho", status: "active" }] }
    ]);
    expect(holders.get("psych")).toBe(1);
    expect(holders.get("ortho")).toBe(1);
  });
});
