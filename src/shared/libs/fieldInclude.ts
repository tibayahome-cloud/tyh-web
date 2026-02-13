type IncludeNode = {
  fields?: string[];
  children?: Record<string, IncludeNode>;
};

export type FieldPreset = {
  resource: string;
  fields?: string[];
  includes?: Record<string, IncludeNode>;
};

const buildIncludeList = (
  includes: Record<string, IncludeNode> | undefined,
  parentPath = ""
): string[] => {
  if (!includes) {
    return [];
  }

  const segments: string[] = [];
  for (const [relation, node] of Object.entries(includes)) {
    const path = parentPath ? `${parentPath}.${relation}` : relation;
    const fields = node.fields?.filter(Boolean) ?? [];
    const segment = fields.length ? `${path}:${fields.join(",")}` : path;
    segments.push(segment);
    segments.push(...buildIncludeList(node.children, path));
  }
  return segments;
};

export const buildFieldParams = (preset: FieldPreset) => {
  const params: Record<string, string> = {};
  if (preset.fields?.length) {
    params.fields = preset.fields.join(",");
  }
  const includeList = buildIncludeList(preset.includes);
  if (includeList.length) {
    params.include = includeList.join(",");
  }
  return params;
};

export const userPublic: FieldPreset = {
  resource: "users",
  fields: ["id", "full_name", "email", "phone", "avatar_url", "meta_data"],
  includes: {
    roles: {
      fields: ["id", "key", "name"]
    }
  }
};

export const userAdminList: FieldPreset = {
  resource: "users",
  fields: ["id", "full_name", "email", "phone", "status", "created_at"],
  includes: {
    roles: {
      fields: ["id", "key", "name"]
    }
  }
};

export const svcCard: FieldPreset = {
  resource: "services",
  fields: [
    "id",
    "key",
    "name",
    "description",
    "base_price_cents",
    "default_estimate_minutes",
    "is_emergency_capable",
    "active"
  ],
  includes: {
    category: {
      fields: ["id", "name"]
    }
  }
};

export const servicePublic: FieldPreset = {
  resource: "services",
  fields: [
    "id",
    "key",
    "name",
    "description",
    "base_price_cents",
    "default_estimate_minutes",
    "is_emergency_capable",
    "active"
  ],
  includes: {
    category: {
      fields: ["id", "name", "key"]
    }
  }
};

export const reqType: FieldPreset = {
  resource: "requirement_types",
  fields: ["id", "key", "label", "input_type", "is_universal", "is_sensitive", "display_order", "is_active"],
  includes: {}
};

export const provApp: FieldPreset = {
  resource: "provider_applications",
  fields: ["id", "status", "submitted_at", "reviewed_at", "notes"],
  includes: {
    items: {
      fields: ["id", "status", "value_text", "file_url", "download_url", "comment"],
      children: {
        requirement_type: {
          fields: ["id", "label", "input_type"]
        }
      }
    },
    user: {
      fields: ["id", "full_name", "email"]
    }
  }
};

export const providerProfile: FieldPreset = {
  resource: "providers",
  fields: [
    "id",
    "user_id",
    "verified",
    "is_available",
    "daily_request_limit",
    "can_emergency",
    "home_lat",
    "home_lng",
    "rating_avg",
    "rating_count",
    "priority_score",
    "current_lat",
    "current_lng",
    "zone_id"
  ],
  includes: {
    user: {
      fields: ["id", "full_name", "email", "phone", "avatar_url"]
    },
    services: {
      fields: ["id", "service_id", "active"],
      children: {
        service: {
          fields: ["id", "name", "key"]
        }
      }
    }
  }
};

export const providerDetail: FieldPreset = {
  resource: "providers",
  fields: [
    "id",
    "user_id",
    "verified",
    "verified_at",
    "is_available",
    "daily_request_limit",
    "can_emergency",
    "rating_avg",
    "rating_count",
    "timezone",
    "home_lat",
    "home_lng",
    "current_lat",
    "current_lng",
    "location_updated_at",
    "zone_id",
    "priority_score"
  ],
  includes: {
    user: {
      fields: ["id", "full_name", "email", "phone", "avatar_url", "status"]
    },
    services: {
      fields: ["id", "service_id", "active"],
      children: {
        service: {
          fields: ["id", "name", "key", "base_price_cents", "default_estimate_minutes"]
        }
      }
    },
    availability: {
      fields: ["id", "weekday", "start_time", "end_time", "effective_from", "effective_to"]
    },
    blackouts: {
      fields: ["id", "start_at", "end_at", "reason"]
    }
  }
};

export const walletAccountPreset: FieldPreset = {
  resource: "wallet_accounts",
  fields: ["id", "balance_cents", "pending_withdrawal_cents", "currency", "status"],
  includes: {
    ledger_entries: {
      fields: ["id", "entry_type", "amount_cents", "balance_after_cents", "ref_type", "ref_id", "narrative", "posted_at"]
    },
    withdrawals: {
      fields: ["id", "amount_cents", "currency", "status", "channel", "requested_at", "disbursed_at", "failure_reason"]
    }
  }
};

export const threadListPreset: FieldPreset = {
  resource: "threads",
  fields: ["id", "scope", "booking_id", "status", "last_message_at", "title"],
  includes: {
    participants: {
      fields: ["id", "user_id", "role_hint", "muted"],
      children: {
        user: {
          fields: ["id", "full_name", "avatar_url"]
        }
      }
    },
    messages: {
      fields: ["id", "kind", "body", "sender_user_id", "created_at", "delivery_status"],
      children: {
        sender: {
          fields: ["id", "full_name", "avatar_url"]
        }
      }
    }
  }
};

export const bookingEventFields: FieldPreset = {
  resource: "booking_events",
  fields: ["id", "action", "payload", "at"],
  includes: {
    actor: {
      fields: ["id", "full_name", "avatar_url"]
    }
  }
};

export const messagePreset: FieldPreset = {
  resource: "messages",
  fields: ["id", "thread_id", "kind", "body", "sender_user_id", "created_at", "delivery_status", "redacted"],
  includes: {
    sender: {
      fields: ["id", "full_name", "avatar_url"]
    },
    attachment: {
      fields: ["id", "file_name", "mime", "bytes", "virus_scan_status"]
    }
  }
};

export const providerApplicationAdmin: FieldPreset = {
  resource: "provider_applications",
  fields: ["id", "user_id", "status", "submitted_at", "reviewed_at", "progress_percent", "current_step", "notes"],
  includes: {
    items: {
      fields: ["id", "status", "value_text", "file_url", "download_url", "comment", "requirement_type_id"],
      children: {
        requirement_type: {
          fields: ["id", "key", "label", "input_type"]
        }
      }
    }
  }
};

export const serviceCategoryAdmin: FieldPreset = {
  resource: "service_categories",
  fields: ["id", "key", "name", "description"],
  includes: {}
};

export const notificationList: FieldPreset = {
  resource: "notifications",
  fields: [
    "id",
    "title",
    "body",
    "status",
    "priority",
    "event_key",
    "event_name",
    "data",
    "read_at",
    "delivered_at",
    "created_at",
    "updated_at"
  ],
  includes: {
    deliveries: {
      fields: ["channel", "status", "sent_at", "delivered_at", "read_at", "error_message"]
    }
  }
};

export const notificationEventPreferences: FieldPreset = {
  resource: "notification_event_preferences",
  fields: ["event", "channels", "effective_channels"],
  includes: {
    event: {
      fields: [
        "key",
        "name",
        "category",
        "description",
        "supported_channels",
        "default_channels",
        "allow_user_toggle",
        "critical"
      ]
    },
    channels: {
      fields: ["channel", "enabled", "source", "snoozed_until"]
    }
  }
};

export const serviceWithLocales: FieldPreset = {
  resource: "services",
  fields: [
    "id",
    "key",
    "name",
    "description",
    "base_price_cents",
    "default_estimate_minutes",
    "is_emergency_capable",
    "active"
  ],
  includes: {
    locales: {
      fields: ["id", "locale", "name", "description"]
    },
    category: {
      fields: ["id", "name"]
    }
  }
};

export const userDetail: FieldPreset = {
  resource: "users",
  fields: [
    "id",
    "full_name",
    "email",
    "phone",
    "status",
    "avatar_url",
    "preferred_lang",
    "tz",
    "twofa_enabled",
    "twofa_method",
    "email_verified_at",
    "phone_verified_at",
    "last_login_at",
    "created_at",
    "updated_at"
  ],
  includes: {
    roles: {
      fields: ["id", "key", "name"]
    }
  }
};

export const bookingCard: FieldPreset = {
  resource: "bookings",
  fields: [
    "id",
    "status",
    "price_cents",
    "currency",
    "estimate_duration_minutes",
    "accepted_at",
    "arrived_at",
    "service_started_at",
    "service_completed_at",
    "client_confirmed_at",
    "paid_at",
    "escalation_at",
    "lat",
    "lng",
    "meta_data"
  ],
  includes: {
    service: {
      fields: ["id", "name", "key", "base_price_cents", "default_estimate_minutes"],
      children: {
        category: {
          fields: ["id", "name", "key"]
        }
      }
    },
    client: {
      fields: ["id", "full_name", "email", "phone", "avatar_url"]
    },
    provider: {
      fields: ["id", "full_name", "email", "phone", "avatar_url"]
    }
  }
};

export const bookingDetail: FieldPreset = {
  resource: "bookings",
  fields: [
    "id",
    "status",
    "address_text",
    "lat",
    "lng",
    "price_cents",
    "currency",
    "estimate_duration_minutes",
    "accepted_at",
    "arrived_at",
    "service_started_at",
    "service_completed_at",
    "client_confirmed_at",
    "paid_at",
    "cancelled_at",
    "cancel_reason",
    "escalation_at",
    "escalated_at",
    "meta_data"
  ],
  includes: {
    service: {
      fields: ["id", "name", "key", "base_price_cents", "default_estimate_minutes"],
      children: {
        category: {
          fields: ["id", "name", "key"]
        }
      }
    },
    client: {
      fields: ["id", "full_name", "email", "phone", "avatar_url"]
    },
    provider: {
      fields: ["id", "full_name", "email", "phone", "avatar_url"]
    },
    locations: {
      fields: ["id", "who", "lat", "lng", "recorded_at"]
    },
    events: {
      fields: ["id", "action", "payload", "at"],
      children: {
        actor: {
          fields: ["id", "full_name", "avatar_url"]
        }
      }
    },
    disputes: {
      fields: ["id", "status", "reason", "resolution", "resolved_at"],
      children: {
        opened_by: {
          fields: ["id", "full_name"]
        }
      }
    },
    feedback: {
      fields: ["id", "score", "tags", "comment", "rated_at"],
      children: {
        rater: {
          fields: ["id", "full_name", "avatar_url"]
        },
        target: {
          fields: ["id", "full_name", "avatar_url"]
        },
        analysis: {
          fields: ["sentiment_score", "sentiment_label", "summary"]
        }
      }
    }
  }
};

export const bookingTimeline: FieldPreset = {
  resource: "bookings",
  fields: [
    "id",
    "status",
    "accepted_at",
    "arrived_at",
    "service_started_at",
    "service_completed_at",
    "client_confirmed_at",
    "paid_at"
  ],
  includes: {
    events: {
      fields: ["id", "action", "payload", "at"],
      children: {
        actor: {
          fields: ["id", "full_name", "avatar_url"]
        }
      }
    }
  }
};

export const paymentAdminList: FieldPreset = {
  resource: "payments",
  fields: [
    "id",
    "booking_id",
    "client_user_id",
    "provider_user_id",
    "status",
    "channel",
    "amount_cents",
    "currency",
    "retry_count",
    "failure_reason",
    "mpesa_receipt_number",
    "completed_at",
    "created_at"
  ],
  includes: {
    booking: {
      fields: ["id", "status", "price_cents", "currency"],
      children: {
        client: {
          fields: ["id", "full_name"]
        },
        provider: {
          fields: ["id", "full_name"]
        }
      }
    }
  }
};

export const paymentDetailPreset: FieldPreset = {
  resource: "payments",
  fields: [
    "id",
    "booking_id",
    "client_user_id",
    "provider_user_id",
    "status",
    "channel",
    "amount_cents",
    "currency",
    "description",
    "merchant_request_id",
    "checkout_request_id",
    "mpesa_receipt_number",
    "failure_reason",
    "retry_count",
    "completed_at",
    "created_at",
    "updated_at",
    "refund_status",
    "refunded_at"
  ],
  includes: {
    attempts: {
      fields: ["id", "status", "request_payload", "response_payload", "created_at"]
    },
    booking: {
      fields: ["id", "status", "price_cents", "currency"],
      children: {
        client: {
          fields: ["id", "full_name"]
        },
        provider: {
          fields: ["id", "full_name"]
        }
      }
    }
  }
};

export type FieldIncludePreset = typeof userPublic;
