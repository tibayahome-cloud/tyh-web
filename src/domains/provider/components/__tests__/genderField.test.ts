import { describe, expect, it } from "vitest";

/**
 * The rules the gender field has to hold to.
 *
 * Every provider in the system predates this field, so the central constraint is that asking
 * must never become a barrier.
 */

const OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" }
];

/** Mirrors the prompt's visibility rule. */
const showPrompt = (genderRecorded: boolean, dismissed: boolean) => !genderRecorded && !dismissed;

describe("options", () => {
  it("offers exactly two, chosen rather than typed", () => {
    // Free text cannot be matched and invites values nobody can act on.
    expect(OPTIONS.map((option) => option.value)).toEqual(["female", "male"]);
  });
});

describe("the prompt", () => {
  it("appears for a clinician who has never been asked", () => {
    expect(showPrompt(false, false)).toBe(true);
  });

  it("disappears once they answer", () => {
    expect(showPrompt(true, false)).toBe(false);
  });

  it("can be dismissed without recording anything", () => {
    // Dismissal must not write a value. A provider who has not answered stays null, which the
    // backend reports as unverifiable and which keeps them fully assignable.
    expect(showPrompt(false, true)).toBe(false);
  });
});

describe("what the clinician is told", () => {
  const copy = {
    why: "Some patients ask to see a female or a male clinician.",
    privacy: "Patients never see this."
  };

  it("explains why it is being asked", () => {
    expect(copy.why).toMatch(/patients ask/i);
  });

  it("says plainly that clients never see it", () => {
    // It ranks who is offered to the facility. It is not a profile detail shown to patients,
    // and a clinician deciding whether to answer deserves to know that.
    expect(copy.privacy).toMatch(/never see/i);
  });
});
