import { describe, expect, it } from "vitest";

import {
  mapNotification,
  mapNotificationEventPreference
} from "../notification";

describe("notification schema mappers", () => {
  it("maps notification payloads to client shape", () => {
    const payload = {
      id: "notif-1",
      title: "Booking updated",
      body: "Your booking status changed.",
      status: "delivered",
      priority: "normal",
      event_key: "booking.status_changed",
      event_name: "Booking Updates",
      data: { booking_id: "booking-9" },
      read_at: null,
      delivered_at: "2025-01-01T10:00:00Z",
      created_at: "2025-01-01T09:59:00Z",
      updated_at: "2025-01-01T09:59:30Z",
      deliveries: [
        {
          id: "delivery-1",
          channel: "in_app",
          status: "delivered",
          sent_at: "2025-01-01T09:59:10Z",
          delivered_at: "2025-01-01T09:59:15Z",
          read_at: null,
          error_message: null
        }
      ]
    };

    const result = mapNotification(payload);
    expect(result).toEqual({
      id: "notif-1",
      title: "Booking updated",
      body: "Your booking status changed.",
      status: "delivered",
      priority: "normal",
      eventKey: "booking.status_changed",
      eventName: "Booking Updates",
      data: { booking_id: "booking-9" },
      readAt: null,
      deliveredAt: "2025-01-01T10:00:00Z",
      createdAt: "2025-01-01T09:59:00Z",
      updatedAt: "2025-01-01T09:59:30Z",
      deliveries: [
        {
          id: "delivery-1",
          channel: "in_app",
          status: "delivered",
          sentAt: "2025-01-01T09:59:10Z",
          deliveredAt: "2025-01-01T09:59:15Z",
          readAt: null,
          errorMessage: null,
          externalReference: null
        }
      ]
    });
  });

  it("maps notification preference payloads", () => {
    const payload = {
      event: {
        key: "booking.status_changed",
        name: "Booking updates",
        category: "bookings",
        description: "Status changes",
        supported_channels: ["in_app", "email"],
        default_channels: ["in_app"],
        allow_user_toggle: true,
        critical: false
      },
      channels: [
        { channel: "in_app", enabled: true, source: "default", snoozed_until: null },
        { channel: "email", enabled: false, source: "user", snoozed_until: null }
      ],
      effective_channels: ["in_app"]
    };

    const result = mapNotificationEventPreference(payload);
    expect(result).toEqual({
      event: {
        key: "booking.status_changed",
        name: "Booking updates",
        category: "bookings",
        description: "Status changes",
        supportedChannels: ["in_app", "email"],
        defaultChannels: ["in_app"],
        allowUserToggle: true,
        critical: false
      },
      channels: [
        { channel: "in_app", enabled: true, source: "default", snoozedUntil: null },
        { channel: "email", enabled: false, source: "user", snoozedUntil: null }
      ],
      effectiveChannels: ["in_app"]
    });
  });
});
