import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn()
}));

vi.mock("../api", () => ({
  __esModule: true,
  default: {
    post: mockPost
  }
}));

vi.mock("../fieldInclude", () => ({
  buildFieldParams: () => ({ fields: "id" }),
  bookingCard: {},
  bookingDetail: {},
  bookingEventFields: {},
  bookingTimeline: {}
}));

import { createBooking } from "../bookings";

describe("booking API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends facility selection fields when creating B2B bookings", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          id: "booking-1",
          status: "pending",
          booking_type: "immediate",
          facility_id: "facility-1",
          request_mode: "selected_facility",
          price_cents: 150000,
          currency: "KES",
          meta: {}
        }
      }
    });

    await createBooking({
      serviceId: "service-1",
      facilityId: "facility-1",
      requestMode: "selected_facility",
      addressText: "Kilimani",
      lat: -1.2921,
      lng: 36.8219
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/bookings",
      expect.objectContaining({
        service_id: "service-1",
        facility_id: "facility-1",
        request_mode: "selected_facility",
        address_text: "Kilimani"
      }),
      { params: { fields: "id" } }
    );
  });
});
