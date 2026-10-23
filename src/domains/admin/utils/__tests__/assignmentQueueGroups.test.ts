import { describe, expect, it } from "vitest";

import { groupAssignmentQueue, requestUrgency } from "../assignmentQueueGroups";

const NOW = new Date("2026-10-22T08:00:00Z").getTime();
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();
const item = (id: string, recoveryState: string, minutes: number | null) =>
  ({ id, recoveryState, scheduledAt: minutes === null ? null : at(minutes) }) as never;
const ids = (list: unknown[]) => list.map((entry) => (entry as { id: string }).id);

describe("groupAssignmentQueue", () => {
  it("puts requests waiting for a provider first, then new-time offers, then waiting for the client", () => {
    const groups = groupAssignmentQueue([
      item("w", "awaiting_client", 10),
      item("r", "needs_rebooking", 20),
      item("a", "assignable", 30)
    ]);

    expect(ids(groups.assign)).toEqual(["a"]);
    expect(ids(groups.rebook)).toEqual(["r"]);
    expect(ids(groups.waiting)).toEqual(["w"]);
  });

  it("sorts each group by the appointment that starts soonest, and a request with no time last", () => {
    const groups = groupAssignmentQueue([
      item("later", "assignable", 600),
      item("none", "assignable", null),
      item("soon", "assignable", 20),
      item("overdue", "assignable", -15)
    ]);

    expect(ids(groups.assign)).toEqual(["overdue", "soon", "later", "none"]);
  });

  it("drops nothing and invents nothing", () => {
    const all = [item("a", "assignable", 1), item("r", "needs_rebooking", 2), item("w", "awaiting_client", 3)];
    const groups = groupAssignmentQueue(all);

    expect(groups.assign.length + groups.rebook.length + groups.waiting.length).toBe(3);
  });
});

describe("requestUrgency", () => {
  it("says assign now when the appointment has already started", () => {
    expect(requestUrgency({ scheduledAt: at(-12) }, NOW)).toEqual({ label: "Started 12 min ago. Assign now", tone: "overdue" });
  });

  it("marks an appointment within the hour as soon, and within a day as later, in words", () => {
    expect(requestUrgency({ scheduledAt: at(25) }, NOW)).toEqual({ label: "Starts in 25 min", tone: "soon" });
    expect(requestUrgency({ scheduledAt: at(197) }, NOW)).toEqual({ label: "Starts in 3 h 17 min", tone: "later" });
  });

  it("shows no tag for an appointment more than a day away, or with no time", () => {
    expect(requestUrgency({ scheduledAt: at(3 * 24 * 60) }, NOW)).toBeNull();
    expect(requestUrgency({ scheduledAt: null }, NOW)).toBeNull();
  });
});
