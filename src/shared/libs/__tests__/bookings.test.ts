import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn()
}));

vi.mock("../api", () => ({
  __esModule: true,
  default: {
    get: mockGet,
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

import { createBooking, fetchBookings, rerouteBooking } from "../bookings";

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

  it("scopes provider booking lists to the assigned provider user", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "booking-1",
            status: "accepted",
            booking_type: "immediate",
            provider_user_id: "provider-user-1",
            price_cents: 150000,
            currency: "KES",
            meta: {}
          }
        ],
        meta: { page: { number: 1, size: 10, total: 1, total_pages: 1 } }
      }
    });

    await fetchBookings({
      providerId: "provider-user-1",
      pageSize: 10,
      statuses: ["accepted", "en_route"],
      preset: "card"
    });

    expect(mockGet).toHaveBeenCalledWith("/bookings", {
      params: expect.objectContaining({
        "page[size]": 10,
        "filter[provider_user_id]": "provider-user-1",
        "filter[status]": "accepted,en_route"
      })
    });
  });

  it("confirms a manual facility reroute with the selected facility", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          id: "booking-1",
          status: "broadcasting",
          booking_type: "immediate",
          facility_id: "facility-2",
          request_mode: "selected_facility",
          facility_status: "pending",
          client_confirmed_reroute_at: "2026-07-30T12:00:00Z",
          price_cents: 160000,
          currency: "KES",
          meta: {}
        }
      }
    });

    await rerouteBooking("booking-1", "facility-2");

    expect(mockPost).toHaveBeenCalledWith(
      "/bookings/booking-1/reroute",
      { facility_id: "facility-2" },
      { params: { fields: "id" } }
    );
  });
});

describe("fetchBookings telemedicine filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: { data: [], meta: {} } });
  });

  it("asks the server for in-person bookings only when isTelemedicine is false", async () => {
    // The client home page uses this to keep the "finding a provider" card off remote
    // consultations. false is a real filter, so it must survive the falsy check that omits
    // unset params -- dropping it would silently restore the bug.
    await fetchBookings({ statuses: ["broadcasting"], isTelemedicine: false });

    expect(mockGet).toHaveBeenCalledWith(
      "/bookings",
      expect.objectContaining({
        params: expect.objectContaining({ "filter[is_telemedicine]": false })
      })
    );
  });

  it("omits the filter entirely when isTelemedicine is not given", async () => {
    // Absent means "no opinion": every other caller must keep seeing both kinds of booking.
    await fetchBookings({ statuses: ["broadcasting"] });

    const params = mockGet.mock.calls[0][1].params as Record<string, unknown>;
    expect(params).not.toHaveProperty("filter[is_telemedicine]");
  });
});
