import { describe, expect, it } from "vitest";

import { conversationOptions } from "../inboxOptions";

const booking = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  scheduledAt: "2026-10-21T08:00:00Z",
  service: { name: "Wound dressing" },
  client: { id: "c1", fullName: "Amina Client" },
  provider: { id: "p1", fullName: "Dr Example" },
  ...overrides
});

describe("conversationOptions", () => {
  it("names the other person, the service and the day, never the booking id", () => {
    const [option] = conversationOptions([booking("9255e426-aaaa")], "client");

    expect(option).toMatchObject({ bookingId: "9255e426-aaaa", name: "Amina Client", service: "Wound dressing", when: "21 Oct" });
    expect(`${option.name} ${option.service} ${option.when}`).not.toMatch(/9255e426/);
  });

  it("lists the person with the newest booking first", () => {
    const options = conversationOptions(
      [
        booking("old", { scheduledAt: "2026-09-01T08:00:00Z", client: { id: "c-old", fullName: "Old Client" } }),
        booking("new", { scheduledAt: "2026-10-20T08:00:00Z", client: { id: "c-new", fullName: "New Client" } })
      ],
      "client"
    );

    expect(options.map((o) => o.bookingId)).toEqual(["new", "old"]);
  });

  it("lists a person once however many bookings they share, with the latest booking and the count", () => {
    const options = conversationOptions(
      [
        booking("b1", { scheduledAt: "2026-09-01T08:00:00Z", service: { name: "Review My Lab Results" } }),
        booking("b3", { scheduledAt: "2026-10-17T08:00:00Z", service: { name: "Counselling" } }),
        booking("b2", { scheduledAt: "2026-10-14T08:00:00Z", service: { name: "Counselling" } })
      ],
      "provider"
    );

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ bookingId: "b3", name: "Dr Example", service: "Counselling", when: "17 Oct", count: 3 });
  });

  it("skips a booking that has no one to write to", () => {
    expect(conversationOptions([booking("b", { provider: null })], "provider")).toEqual([]);
  });

  it("uses the day in Nairobi, so an evening booking stays on its own day", () => {
    const [option] = conversationOptions([booking("b", { scheduledAt: "2026-10-21T21:30:00Z" })], "client");

    expect(option.when).toBe("22 Oct");
  });
});
