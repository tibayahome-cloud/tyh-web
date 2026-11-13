import { describe, expect, it } from "vitest";

import { returnPathFrom, safeReturnPath, withReturnPath } from "../returnPath";

describe("safeReturnPath", () => {
  it.each(["/app/telemedicine?book=1", "/app/bookings/abc", "/app/home", "/pro/home"])("accepts %s", (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    "https://elsewhere.example/app",
    "//elsewhere.example",
    "/\\elsewhere.example",
    "javascript:alert(1)",
    "app/home",
    "",
    "/app/home\nSet-Cookie: x=1",
    "/login",
    "/signup?next=/app/home",
    "/two-factor",
    "/legal/consent",
    "/admin/login",
    null,
    undefined,
    42
  ])("ignores %s", (value) => {
    expect(safeReturnPath(value)).toBeNull();
  });
});

describe("returnPathFrom", () => {
  it("reads ?next=", () => {
    expect(returnPathFrom({ search: "?next=%2Fapp%2Ftelemedicine%3Fbook%3D1" })).toBe("/app/telemedicine?book=1");
  });

  it("reads the route guard's from, with its query string", () => {
    expect(returnPathFrom({ search: "", state: { from: { pathname: "/app/bookings/1", search: "?tab=notes" } } })).toBe(
      "/app/bookings/1?tab=notes"
    );
  });

  it("prefers ?next= and ignores an unsafe one rather than trusting it", () => {
    expect(returnPathFrom({ search: "?next=https%3A%2F%2Fevil.example", state: { from: { pathname: "/app/home" } } })).toBe("/app/home");
    expect(returnPathFrom({ search: "?next=%2F%2Fevil.example" })).toBeNull();
  });

  it("is null when nothing was carried", () => {
    expect(returnPathFrom({ search: "" })).toBeNull();
    expect(returnPathFrom({ search: "", state: null })).toBeNull();
  });
});

describe("withReturnPath", () => {
  it("adds the destination, encoded", () => {
    expect(withReturnPath("/signup", "/app/telemedicine?book=1")).toBe("/signup?next=%2Fapp%2Ftelemedicine%3Fbook%3D1");
  });

  it("leaves the target alone when there is nowhere to return to", () => {
    expect(withReturnPath("/login", null)).toBe("/login");
  });
});
