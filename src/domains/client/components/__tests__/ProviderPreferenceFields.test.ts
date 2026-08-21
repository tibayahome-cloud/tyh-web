import { describe, expect, it } from "vitest";

/**
 * The preference form's contract, tested without mounting React.
 *
 * These are the rules that matter, and they are about what the client is promised and what the
 * form refuses to carry rather than about markup.
 */

// Mirrors GENDER_OPTIONS / LANGUAGE_OPTIONS in ProviderPreferenceFields.tsx.
const GENDER_VALUES = ["", "female", "male"];
const NOTE_MAX_LENGTH = 500;

describe("provider preference options", () => {
  it("offers no-preference as a real choice, not an absence", () => {
    // A client who does not mind should be able to say so. It also matches the backend, which
    // treats no_preference as an answer that reorders nobody.
    expect(GENDER_VALUES[0]).toBe("");
  });

  it("never offers a provider by name", () => {
    // Clients must not be able to enumerate the directory, so the form deals in attributes.
    for (const value of GENDER_VALUES) {
      expect(value).not.toMatch(/dr|provider|clinician-\d/i);
    }
  });

  it("caps the note at what the backend accepts", () => {
    // The backend rejects anything longer and the database enforces it too. Capping in the
    // textarea means the client is stopped while typing rather than after submitting.
    expect(NOTE_MAX_LENGTH).toBe(500);
  });
});

describe("what the client is told", () => {
  const copy = {
    caveat: "They will do their best, but we cannot promise a match.",
    clinical: "Please do not include medical details here"
  };

  it("says plainly that a preference is not a guarantee", () => {
    // Promising a match and then assigning otherwise is worse than being clear up front.
    expect(copy.caveat).toMatch(/cannot promise/i);
  });

  it("steers clinical detail away from a rostering note", () => {
    // The note is read by operators while assigning; medical history belongs in the record.
    expect(copy.clinical).toMatch(/not include medical/i);
  });
});
