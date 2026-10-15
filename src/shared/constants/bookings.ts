export type CancellationReason = {
  value: string;
  label: string;
  description?: string;
};

export const ADMIN_CANCELLATION_REASONS: CancellationReason[] = [
  {
    value: "client_request",
    label: "Client asked us to cancel",
    description: "The client told an administrator they no longer need it."
  },
  {
    value: "provider_no_show",
    label: "Provider no-show",
    description: "Provider missed the appointment window."
  },
  {
    value: "safety_concern",
    label: "Safety concern",
    description: "Ops flagged the booking due to safety or compliance issues."
  },
  {
    value: "scheduling_conflict",
    label: "Scheduling conflict",
    description: "Logistics conflict prevented fulfillment."
  },
  {
    value: "other",
    label: "Other (internal note)",
    description: "Use sparingly—add an internal note."
  }
];

// The stored text always says an administrator cancelled it. "Client asked us to cancel" is the
// reason given, not who pressed the button; without the suffix it read as if the client cancelled.
export const ADMIN_CANCELLATION_SUFFIX = "(cancelled by an administrator)";

export const formatCancellationReason = (reasonValue: string, note?: string) => {
  const reason = ADMIN_CANCELLATION_REASONS.find((entry) => entry.value === reasonValue);
  const base = reason ? `[${reason.value}] ${reason.label} ${ADMIN_CANCELLATION_SUFFIX}` : note ? note : "Unknown reason";
  return note && reason ? `${base} - ${note}` : base;
};
