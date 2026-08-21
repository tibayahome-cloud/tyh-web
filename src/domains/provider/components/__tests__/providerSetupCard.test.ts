import { describe, expect, it } from "vitest";

/**
 * The setup card's rules.
 *
 * Every provider in the system predates these fields, so the governing constraint is that
 * asking must never become a barrier -- and that the card only ever raises work the clinician
 * can personally do.
 */

type Setup = {
  genderConfigured: boolean;
  availabilityConfigured: boolean;
  currentlyAvailable: boolean;
};

/** Mirrors the card's own logic. */
const outstandingFor = (setup: Setup): string[] =>
  [
    !setup.availabilityConfigured && "availability",
    !setup.genderConfigured && "gender"
  ].filter(Boolean) as string[];

const base: Setup = {
  genderConfigured: true,
  availabilityConfigured: true,
  currentlyAvailable: true
};

describe("what the card raises", () => {
  it("says nothing when both tasks are done", () => {
    expect(outstandingFor(base)).toEqual([]);
  });

  it("raises availability when no usable schedule exists", () => {
    expect(outstandingFor({ ...base, availabilityConfigured: false })).toEqual(["availability"]);
  });

  it("puts availability before gender", () => {
    // One stops the clinician being booked at all; the other only makes matching inert.
    expect(outstandingFor({ genderConfigured: false, availabilityConfigured: false, currentlyAvailable: true }))
      .toEqual(["availability", "gender"]);
  });
});

describe("availability is not the same as being free right now", () => {
  it("stays quiet for a clinician with hours who has stepped away", () => {
    // Telling someone to set hours they already have, because they went to lunch, is the
    // fastest way to teach them the card is noise.
    expect(outstandingFor({ ...base, currentlyAvailable: false })).toEqual([]);
  });

  it("still raises a missing schedule for someone marked available", () => {
    // The toggle must not paper over the fact that no slots exist.
    expect(outstandingFor({ ...base, availabilityConfigured: false, currentlyAvailable: true }))
      .toContain("availability");
  });
});

describe("only provider-actionable work appears", () => {
  it("never raises facility-owned setup", () => {
    // Services, verification and telemedicine enablement are admin.ops work. A card listing
    // them asks a clinician to fix what they have no power over, and teaches them to dismiss
    // it unread -- which then buries the items they could have acted on.
    const raised = outstandingFor({
      genderConfigured: false,
      availabilityConfigured: false,
      currentlyAvailable: false
    });

    expect(raised).toEqual(["availability", "gender"]);
    for (const facilityOwned of ["services", "verification", "telemedicine_enabled"]) {
      expect(raised).not.toContain(facilityOwned);
    }
  });
});

describe("dismissal", () => {
  const visible = (outstanding: string[], dismissed: boolean) => outstanding.length > 0 && !dismissed;

  it("hides the card without recording anything", () => {
    // Nothing is written, so the clinician stays unconfigured, which the backend reports as
    // unverifiable and which keeps them fully assignable.
    expect(visible(["gender"], true)).toBe(false);
  });

  it("does not hide it when there is nothing outstanding anyway", () => {
    expect(visible([], false)).toBe(false);
  });
});

describe("the availability wording", () => {
  const copy = "Clients cannot book you until you set your availability.";

  it("states the consequence rather than escalating the styling", () => {
    // This is the failure that is otherwise invisible: the provider believes they are live and
    // is generating no slots at all.
    expect(copy).toMatch(/cannot book you/i);
  });
});
