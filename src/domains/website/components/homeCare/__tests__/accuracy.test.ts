import { describe, expect, it } from "vitest";

import { accuracyNote } from "../accuracy";

describe("what we tell the person about how sure the device is", () => {
  it("says nothing when the device gave no accuracy", () => {
    expect(accuracyNote(null)).toBeNull();
    expect(accuracyNote(Number.NaN)).toBeNull();
  });

  it("is reassuring for a close reading, but still asks to check the pin", () => {
    const note = accuracyNote(20);
    expect(note?.tone).toBe("ok");
    expect(note?.text).toMatch(/within about 20 metres/);
    expect(note?.text).toMatch(/pin is at your gate/);
  });

  it("never claims better than five metres", () => {
    expect(accuracyNote(1)?.text).toMatch(/about 5 metres/);
  });

  it("asks the person to move the map for a middling reading", () => {
    const note = accuracyNote(180);
    expect(note?.tone).toBe("warn");
    expect(note?.text).toMatch(/about 180 metres.*Move the map/);
  });

  it("says plainly that a rough reading is rough, in kilometres when it is that far, and offers the address search", () => {
    const note = accuracyNote(2300);
    expect(note?.tone).toBe("warn");
    expect(note?.text).toMatch(/only place you roughly \(about 2\.3 km\)/);
    expect(note?.text).toMatch(/search for your address/);
    expect(accuracyNote(600)?.text).toMatch(/about 600 metres/);
  });
});
