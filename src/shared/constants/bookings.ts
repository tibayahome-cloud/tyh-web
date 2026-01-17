export type CancellationReason = {
  value: string;
  label: string;
  description?: string;
};

export const ADMIN_CANCELLATION_REASONS: CancellationReason[] = [
  {
    value: "client_request",
    label: "Client requested cancellation",
    description: "Client confirmed they no longer need the service."
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

export const formatCancellationReason = (reasonValue: string, note?: string) => {
  const reason = ADMIN_CANCELLATION_REASONS.find((entry) => entry.value === reasonValue);
  const base = reason ? `[${reason.value}] ${reason.label}` : note ? note : "Unknown reason";
  return note && reason ? `${base} - ${note}` : base;
};
