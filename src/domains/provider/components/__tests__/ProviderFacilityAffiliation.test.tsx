import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProviderFacilityAffiliation, facilityAffiliationSummary } from "../ProviderFacilityAffiliation";

describe("facilityAffiliationSummary", () => {
  it("names the facility with its type and county", () => {
    expect(facilityAffiliationSummary({ id: "f1", name: "Care Point", facility_type: "clinic", county: "Nairobi" })).toEqual({
      name: "Care Point", known: true, detail: "Clinic · Nairobi"
    });
  });

  it("shows only the parts that are known", () => {
    expect(facilityAffiliationSummary({ id: "f1", name: "Care Point", county: "Nairobi" })?.detail).toBe("Nairobi");
    expect(facilityAffiliationSummary({ id: "f1", name: "Care Point", facility_type: "specialist_centre" })?.detail).toBe("Specialist centre");
    expect(facilityAffiliationSummary({ id: "f1", name: "Care Point" })?.detail).toBeNull();
  });

  it("does not invent a name when the facility has none", () => {
    expect(facilityAffiliationSummary({ id: "f1", name: "  " })).toMatchObject({ name: "Facility details unavailable", known: false });
  });

  it("shows nothing for a provider with no facility", () => {
    expect(facilityAffiliationSummary(null)).toBeNull();
    expect(facilityAffiliationSummary(undefined)).toBeNull();
    expect(facilityAffiliationSummary({ name: "Orphan" })).toBeNull();
  });
});

describe("ProviderFacilityAffiliation", () => {
  it("is a labelled, read-only section with no controls", () => {
    render(<ProviderFacilityAffiliation facility={{ id: "f1", name: "Care Point", facility_type: "clinic", county: "Nairobi" }} />);
    const region = screen.getByRole("region", { name: "Your facility" });
    expect(region).toHaveTextContent("Care Point");
    expect(region).toHaveTextContent("Clinic · Nairobi");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders nothing without a facility", () => {
    const { container } = render(<ProviderFacilityAffiliation facility={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says details are unavailable rather than leaving a blank name", () => {
    render(<ProviderFacilityAffiliation facility={{ id: "f1", name: null }} />);
    expect(screen.getByText("Facility details unavailable")).toBeInTheDocument();
  });
});
