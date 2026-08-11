const STATUS_THEMES: Record<
  string,
  {
    label: string;
    className: string;
  }
> = {
  scheduled: { label: "Scheduled", className: "bg-violet-100 text-violet-700" },
  requested: { label: "Requested", className: "bg-slate-100 text-slate-700" },
  broadcasting: { label: "Broadcasting", className: "bg-amber-100 text-amber-700" },
  accepted: { label: "Accepted", className: "bg-blue-100 text-blue-700" },
  en_route: { label: "En route", className: "bg-sky-100 text-sky-700" },
  nearby: { label: "Nearby", className: "bg-cyan-100 text-cyan-700" },
  arrived: { label: "Arrived", className: "bg-indigo-100 text-indigo-700" },
  in_service: { label: "In Service", className: "bg-purple-100 text-purple-700" },
  completed_by_provider: { label: "Awaiting Client Confirmation", className: "bg-emerald-100 text-emerald-700" },
  client_completed: { label: "Client Completed", className: "bg-emerald-100 text-emerald-700" },
  client_confirmed: { label: "Client Confirmed", className: "bg-emerald-100 text-emerald-700" },
  fully_completed: { label: "Fully Completed", className: "bg-green-100 text-green-700" },
  paid: { label: "Paid", className: "bg-green-100 text-green-700" },
  cancelled_by_client: { label: "Cancelled by Client", className: "bg-rose-100 text-rose-700" },
  cancelled_by_admin: { label: "Cancelled by Ops", className: "bg-rose-100 text-rose-700" },
  expired_no_accept: { label: "Expired", className: "bg-slate-200 text-slate-600" },
  reassigned: { label: "Reassigned", className: "bg-slate-200 text-slate-600" },
  disputed: { label: "Disputed", className: "bg-amber-200 text-amber-800" },
  // Telemedicine pre-service payment states (see BOOKING_STATUS_TELEMEDICINE_* on the backend).
  telemedicine_payment_pending: { label: "Awaiting Payment", className: "bg-amber-100 text-amber-700" },
  telemedicine_paid_pending_assignment: { label: "Awaiting Provider", className: "bg-blue-100 text-blue-700" }
};

// Telemedicine video-session lifecycle states (TelemedicineSession.status), a separate domain
// from booking status even though a couple of labels look similar.
const SESSION_STATUS_THEMES: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Not Started", className: "bg-slate-100 text-slate-700" },
  joined: { label: "Waiting", className: "bg-amber-100 text-amber-700" },
  in_progress: { label: "In Progress", className: "bg-emerald-100 text-emerald-700" },
  ended: { label: "Ended", className: "bg-slate-200 text-slate-600" },
  expired: { label: "Expired", className: "bg-rose-100 text-rose-700" }
};

const humanize = (value: string) =>
  value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

export const getBookingStatusTheme = (status: string) => {
  const normalized = status?.toLowerCase() ?? "";
  return (
    STATUS_THEMES[normalized] ?? {
      label: humanize(normalized || "Unknown"),
      className: "bg-slate-100 text-slate-700"
    }
  );
};

export const formatBookingStatus = (status: string) => getBookingStatusTheme(status).label;

export const getSessionStatusTheme = (status: string) => {
  const normalized = status?.toLowerCase() ?? "";
  return (
    SESSION_STATUS_THEMES[normalized] ?? {
      label: humanize(normalized || "Unknown"),
      className: "bg-slate-100 text-slate-700"
    }
  );
};
