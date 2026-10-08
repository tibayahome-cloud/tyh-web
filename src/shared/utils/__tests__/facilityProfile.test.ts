import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import type { Facility } from "../../schemas/facility";
import {
  buildFacilityProfileChanges,
  buildFacilityProfileForm,
  hasFacilityProfileChanges,
  mapFacilityProfileError,
  parsePlatformFee,
  validateFacilityProfile
} from "../facilityProfile";

const facility = (overrides: Partial<Facility> = {}): Facility => ({
  id: "f-1",
  name: "Karen Clinic",
  facilityType: "clinic",
  hospitalLevel: null,
  address: "Karen, Nairobi",
  county: "Nairobi",
  countryCode: "KE",
  email: "front@karen.test",
  status: "active",
  lat: null,
  lng: null,
  platformFeePercent: 12,
  providerFinancialsVisible: true,
  fastResponseEnabled: false,
  approvedAt: null,
  suspendedAt: null,
  phones: [],
  operatingHours: [],
  services: [],
  admins: [],
  ...overrides
});

const httpError = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { error: { code: status, name: "x", message } }
  });

describe("platform fee", () => {
  it.each([
    ["0", 0],
    ["12", 12],
    ["12.5", 12.5],
    ["100", 100],
    [" 7.25 ", 7.25]
  ])("accepts %s", (raw, expected) => {
    expect(parsePlatformFee(raw)).toBe(expected);
  });

  it.each(["-1", "100.01", "101", "abc", "", "12.345", "1e2", "12%"])("rejects %j", (raw) => {
    expect(parsePlatformFee(raw)).toBeNull();
  });

  it("explains the percentage range when the fee is out of range", () => {
    const form = { ...buildFacilityProfileForm(facility()), platformFeePercent: "120" };
    expect(validateFacilityProfile(form).platformFeePercent).toMatch(/percentage from 0 to 100/);
  });
});

describe("validateFacilityProfile", () => {
  it("passes an unchanged facility", () => {
    expect(validateFacilityProfile(buildFacilityProfileForm(facility()))).toEqual({});
  });

  it("flags each blank or malformed field", () => {
    const form = {
      ...buildFacilityProfileForm(facility()),
      name: " ",
      address: "",
      county: "",
      email: "nope",
      countryCode: "KEN"
    };
    expect(Object.keys(validateFacilityProfile(form)).sort()).toEqual(["address", "countryCode", "county", "email", "name"]);
  });

  it("requires a level 1 to 6 for hospitals only", () => {
    const hospital = { ...buildFacilityProfileForm(facility()), facilityType: "hospital" as const, hospitalLevel: "" };
    expect(validateFacilityProfile(hospital).hospitalLevel).toBeDefined();
    expect(validateFacilityProfile({ ...hospital, hospitalLevel: "7" }).hospitalLevel).toBeDefined();
    expect(validateFacilityProfile({ ...hospital, hospitalLevel: "3" }).hospitalLevel).toBeUndefined();
    expect(validateFacilityProfile({ ...hospital, facilityType: "clinic" }).hospitalLevel).toBeUndefined();
  });
});

describe("buildFacilityProfileChanges", () => {
  it("sends nothing when nothing changed", () => {
    const current = facility();
    expect(buildFacilityProfileChanges(current, buildFacilityProfileForm(current))).toEqual({ update: {}, status: null });
    expect(hasFacilityProfileChanges(current, buildFacilityProfileForm(current))).toBe(false);
  });

  it("sends only changed core fields, in the API's names, and never status or identity", () => {
    const current = facility();
    const form = {
      ...buildFacilityProfileForm(current),
      name: "  Karen Family Clinic ",
      platformFeePercent: "15.5",
      fastResponseEnabled: true,
      countryCode: "ug"
    };
    const { update, status } = buildFacilityProfileChanges(current, form);
    expect(update).toEqual({ name: "Karen Family Clinic", platformFeePercent: 15.5, fastResponseEnabled: true, countryCode: "UG" });
    expect(status).toBeNull();
    expect(update).not.toHaveProperty("id");
    expect(update).not.toHaveProperty("status");
  });

  it("edits indoor location details independently from the street address", () => {
    const current = facility();
    const form = { ...buildFacilityProfileForm(current), locationDetails: "Building B, floor 2, Room 3" };
    expect(buildFacilityProfileChanges(current, form).update).toEqual({
      locationDetails: "Building B, floor 2, Room 3"
    });
  });

  it("routes a status change separately", () => {
    const current = facility();
    expect(buildFacilityProfileChanges(current, { ...buildFacilityProfileForm(current), status: "suspended" })).toEqual({
      update: {},
      status: "suspended"
    });
  });

  it("sends the hospital level together with a type change, and clears it when leaving hospital", () => {
    const clinic = facility();
    const toHospital = { ...buildFacilityProfileForm(clinic), facilityType: "hospital" as const, hospitalLevel: "4" };
    expect(buildFacilityProfileChanges(clinic, toHospital).update).toEqual({ facilityType: "hospital", hospitalLevel: 4 });

    const hospital = facility({ facilityType: "hospital", hospitalLevel: 4 });
    const toClinic = { ...buildFacilityProfileForm(hospital), facilityType: "clinic" as const };
    expect(buildFacilityProfileChanges(hospital, toClinic).update).toEqual({ facilityType: "clinic", hospitalLevel: null });
  });
});

describe("mapFacilityProfileError", () => {
  it("puts a server message that names the platform fee beside that field", () => {
    expect(mapFacilityProfileError(httpError(400, "platform_fee_percent must be between 0 and 100"))).toEqual({
      field: "platformFeePercent",
      message: "platform_fee_percent must be between 0 and 100"
    });
  });

  it("keeps a message that names no field at the form level, unchanged", () => {
    expect(mapFacilityProfileError(httpError(400, "No permitted facility fields supplied"))).toEqual({
      field: null,
      message: "No permitted facility fields supplied"
    });
  });

  it("explains a refusal for a non-super-admin", () => {
    expect(mapFacilityProfileError(httpError(403, "Forbidden")).message).toMatch(/super admin/i);
  });
});
