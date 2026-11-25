import { describe, expect, it } from "vitest";

import { areaFromPath, notificationPath } from "../notificationLink";

describe("notificationPath", () => {
  it("opens a conversation in the inbox of the area the person is in", () => {
    const data = { thread_id: "t-1" };

    expect(notificationPath(data, "/app")).toBe("/app/inbox/t-1");
    expect(notificationPath(data, "/pro")).toBe("/pro/inbox/t-1");
    expect(notificationPath(data, "/admin")).toBe("/admin/conversations/t-1");
  });

  it("opens a booking in that area's booking page", () => {
    const data = { booking_id: "b-1" };

    expect(notificationPath(data, "/app")).toBe("/app/bookings/b-1");
    expect(notificationPath(data, "/pro")).toBe("/pro/bookings/b-1");
    expect(notificationPath(data, "/admin")).toBe("/admin/bookings/b-1");
  });

  it("prefers the conversation when a notification names both", () => {
    expect(notificationPath({ thread_id: "t-1", booking_id: "b-1" }, "/app")).toBe("/app/inbox/t-1");
  });

  it("gives nothing for a notification about nothing the person can open", () => {
    expect(notificationPath({}, "/app")).toBeNull();
    expect(notificationPath(null, "/app")).toBeNull();
    expect(notificationPath({ thread_id: 5 }, "/app")).toBeNull();
  });

  it("works out the area from the address", () => {
    expect(areaFromPath("/admin/conversations")).toBe("/admin");
    expect(areaFromPath("/pro/inbox")).toBe("/pro");
    expect(areaFromPath("/app/home")).toBe("/app");
  });
});
