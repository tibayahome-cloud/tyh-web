import classNames from "classnames";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  Calendar as CalendarIcon,
  Zap,
  AlertCircle,
  HelpCircle,
  Activity,
  CalendarCheck2,
  History,
  ShieldCheck,
  ArrowRight,
  Rocket
} from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { Loading } from "../../../shared/components/Loading";
import ConfirmDialog from "../../../shared/components/ConfirmDialog";
import { useAuth } from "../../../shared/hooks/useAuth";
import { api } from "../../../shared/libs/api";
import { useToast } from "../../../shared/components/ToastProvider";
import { useBookingList } from "../../../shared/hooks/useBookings";
import type { Booking } from "../../../shared/schemas/booking";

type AvailabilityRow = {
  id: string;
  weekday: string;
  start_time: string;
  end_time: string;
  effective_from?: string | null;
  effective_to?: string | null;
  slot_duration_minutes?: number | null;
};

type Blackout = {
  id: string;
  start_at: string;
  end_at: string;
  reason?: string | null;
};

type Envelope<T> = {
  data: T;
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WEEKDAY_LABELS: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday"
};
const CALENDAR_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const BOOKING_CALENDAR_STATUSES = [
  "broadcasting",
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service",
  "completed_by_provider",
  "client_completed",
  "fully_completed",
  "client_confirmed",
  "paid"
] as const;

const toLocalInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const buildCalendarDays = (anchor: Date) => {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = monthStart.getDay();
  const gridStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const timeStringToDate = (anchor: Date, value: string) => {
  const [hours, minutes] = value.split(":").map((part) => Number(part) || 0);
  const next = new Date(anchor);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const useAvailabilityQuery = (userId: string | undefined) =>
  useQuery({
    queryKey: ["provider", "availability", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return [] as AvailabilityRow[];
      }
      const response = await api.get<Envelope<AvailabilityRow[]>>(`/providers/${userId}/availability`);
      return response.data.data;
    }
  });

const useBlackoutsQuery = (userId: string | undefined) =>
  useQuery({
    queryKey: ["provider", "blackouts", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return [] as Blackout[];
      }
      const response = await api.get<Envelope<Blackout[]>>(`/providers/${userId}/blackouts`);
      return response.data.data;
    }
  });

const toTimeInput = (value?: string | null) => {
  if (!value) {
    return "09:00";
  }
  if (value.includes("T")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
    }
  }
  const [hours = "00", minutes = "00"] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const fromTimeInput = (value: string) => {
  if (!value) {
    return "00:00";
  }
  const [hours = "00", minutes = "00"] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const toDateInput = (value?: string | null) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
};

const fromDateInput = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

const defaultRow = (weekday = "mon"): AvailabilityRow => ({
  id: crypto.randomUUID(),
  weekday,
  start_time: "09:00",
  end_time: "17:00",
  effective_from: undefined,
  effective_to: undefined
});

const AvailabilityPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: availability, isLoading: loadingAvailability } = useAvailabilityQuery(user?.id);
  const { data: blackouts, isLoading: loadingBlackouts } = useBlackoutsQuery(user?.id);

  const [rows, setRows] = useState<AvailabilityRow[]>([defaultRow()]);
  const [hasChanges, setHasChanges] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState<Date | null>(null);
  const [dialogStart, setDialogStart] = useState("");
  const [dialogEnd, setDialogEnd] = useState("");
  const [dialogReason, setDialogReason] = useState("");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<
    | {
      type: "save_availability" | "delete_window" | "delete_blackout" | "delete_upcoming";
      payload?: unknown;
      message: string;
      confirmLabel?: string;
    }
    | null
  >(null);

  useEffect(() => {
    if (availability && availability.length > 0) {
      setRows(
        availability.map((row: any) => ({
          ...row,
          id: crypto.randomUUID(),
          start_time: toTimeInput(row.start_time),
          end_time: toTimeInput(row.end_time),
          effective_from: toDateInput(row.effective_from ?? undefined),
          effective_to: toDateInput(row.effective_to ?? undefined)
        }))
      );
      setHasChanges(false);
    }
  }, [availability]);

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (payload: AvailabilityRow[]) => {
      if (!user?.id) {
        throw new Error("Missing provider id");
      }
      const body = payload.map((row) => ({
        weekday: row.weekday,
        start_time: fromTimeInput(row.start_time),
        end_time: fromTimeInput(row.end_time),
        effective_from: fromDateInput(row.effective_from ?? undefined),
        effective_to: fromDateInput(row.effective_to ?? undefined),
        slot_duration_minutes: row.slot_duration_minutes
      }));
      await api.put(`/providers/${user.id}/availability`, body);
    },
    onSuccess: () => {
      toast.showToast({
        title: "Availability updated",
        description: "Your recurring hours are saved.",
        variant: "success"
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["provider", "availability", user?.id] });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to save availability",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error"
      });
    }
  });

  const createBlackoutMutation = useMutation({
    mutationFn: async (payload: { start_at: string; end_at: string; reason?: string }) => {
      if (!user?.id) {
        throw new Error("Missing provider id");
      }
      await api.post(`/providers/${user.id}/blackouts`, payload);
    }
  });

  const deleteBlackoutMutation = useMutation({
    mutationFn: async (blackoutId: string) => {
      if (!user?.id) {
        throw new Error("Missing provider id");
      }
      await api.delete(`/providers/${user.id}/blackouts/${blackoutId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider", "blackouts", user?.id] });
      toast.showToast({
        title: "Blackout removed",
        description: "Availability restored for that window.",
        variant: "success"
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to delete blackout",
        description: error instanceof Error ? error.message : "Please retry shortly.",
        variant: "error"
      });
    }
  });

  const weeklyByWeekday = useMemo(() => {
    const map: Record<string, AvailabilityRow[]> = {};
    rows.forEach((row: AvailabilityRow) => {
      if (!map[row.weekday]) {
        map[row.weekday] = [];
      }
      map[row.weekday].push(row);
    });
    Object.values(map).forEach((list: AvailabilityRow[]) => list.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [rows]);

  const calendarWindowStart = useMemo(
    () => startOfDay(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), -7)),
    [calendarMonth]
  );
  const calendarWindowEnd = useMemo(
    () => endOfDay(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 7)),
    [calendarMonth]
  );

  const bookingsQuery = useBookingList(
    {
      statuses: [...BOOKING_CALENDAR_STATUSES],
      providerId: user?.id ?? undefined,
      from: calendarWindowStart.toISOString(),
      to: calendarWindowEnd.toISOString(),
      pageSize: 250,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  );

  const bookingsByDay = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    (bookingsQuery.data?.bookings ?? []).forEach((booking: Booking) => {
      const scheduled =
        (typeof booking.meta?.scheduled_for === "string" && booking.meta?.scheduled_for) ||
        booking.acceptedAt ||
        booking.arrivedAt ||
        booking.serviceStartedAt ||
        booking.serviceCompletedAt ||
        booking.clientConfirmedAt ||
        booking.paidAt ||
        booking.createdAt;
      if (!scheduled) {
        return;
      }
      const key = dateKey(new Date(scheduled));
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(booking);
    });
    return map;
  }, [bookingsQuery.data?.bookings]);

  const blackoutRanges = useMemo(
    () =>
      (blackouts ?? []).map((entry) => ({
        ...entry,
        start: new Date(entry.start_at),
        end: new Date(entry.end_at)
      })),
    [blackouts]
  );

  const calendarDays = useMemo(() => {
    const matrix = buildCalendarDays(calendarMonth);
    return matrix.map((date) => {
      const weekdayKey = WEEKDAYS[date.getDay()];
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const blackoutCount = blackoutRanges.filter((range) => dayEnd >= range.start && dayStart <= range.end).length;
      const bookings = bookingsByDay[dateKey(date)] ?? [];
      const key = dateKey(date);
      return {
        date,
        key,
        weekdayKey,
        availability: weeklyByWeekday[weekdayKey] ?? [],
        blackoutCount,
        bookings,
        isCurrentMonth: date.getMonth() === calendarMonth.getMonth(),
        isToday:
          date.getFullYear() === new Date().getFullYear() &&
          date.getMonth() === new Date().getMonth() &&
          date.getDate() === new Date().getDate(),
        isSelected: selectedDates.has(key)
      };
    });
  }, [calendarMonth, blackoutRanges, weeklyByWeekday, bookingsByDay]);

  const sortedBlackouts = useMemo(() => {
    return blackoutRanges
      .slice()
      .sort((a: any, b: any) => a.start.getTime() - b.start.getTime())
      .map((entry: any) => ({
        id: entry.id,
        start_at: entry.start_at,
        end_at: entry.end_at,
        reason: entry.reason
      }));
  }, [blackoutRanges]);

  const addRowForWeekday = (weekday: string) => {
    setRows((prev: AvailabilityRow[]) => [...prev, defaultRow(weekday)]);
    setHasChanges(true);
  };

  const updateRow = (id: string, updates: Partial<AvailabilityRow>) => {
    setRows((prev: AvailabilityRow[]) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
    setHasChanges(true);
  };

  const removeRow = (id: string) => {
    setRows((prev: AvailabilityRow[]) => prev.filter((row) => row.id !== id));
    setHasChanges(true);
  };

  const toggleDateSelection = (date: Date) => {
    const key = dateKey(date);
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const openDialogForSelected = () => {
    if (selectedDates.size === 0) {
      return;
    }
    const firstKey = Array.from(selectedDates)[0];
    const firstDate = new Date(firstKey);
    const weekdayKey = WEEKDAYS[firstDate.getDay()];

    setDialogDate(firstDate); // We'll use this for UI context, but handle batch later
    const defaultStart = weeklyByWeekday[weekdayKey]?.[0]?.start_time ?? "09:00";
    const defaultEnd = weeklyByWeekday[weekdayKey]?.[0]?.end_time ?? "17:00";

    setDialogStart(toLocalInputValue(timeStringToDate(firstDate, defaultStart)));
    setDialogEnd(toLocalInputValue(timeStringToDate(firstDate, defaultEnd)));
    setDialogReason("");
    setDialogOpen(true);
  };

  const openDialogForDate = (day: Date) => {
    setSelectedDates(new Set([dateKey(day)]));
    const weekdayKey = WEEKDAYS[day.getDay()];
    setDialogDate(day);
    const defaultStart = weeklyByWeekday[weekdayKey]?.[0]?.start_time ?? "09:00";
    const defaultEnd = weeklyByWeekday[weekdayKey]?.[0]?.end_time ?? "17:00";
    setDialogStart(toLocalInputValue(timeStringToDate(day, defaultStart)));
    setDialogEnd(toLocalInputValue(timeStringToDate(day, defaultEnd)));
    setDialogReason("");
    setDialogOpen(true);
  };

  const handleConfirmBlackout = async () => {
    if (!dialogStart || !dialogEnd) {
      toast.showToast({
        title: "Select times",
        description: "Pick a start and end time for the blackout.",
        variant: "error"
      });
      return;
    }

    const startT = dialogStart.split("T")[1];
    const endT = dialogEnd.split("T")[1];
    const targets = Array.from(selectedDates);

    try {
      await Promise.all(
        targets.map((dateStr) => {
          const s = new Date(`${dateStr}T${startT}`);
          const e = new Date(`${dateStr}T${endT}`);
          return createBlackoutMutation.mutateAsync({
            start_at: s.toISOString(),
            end_at: e.toISOString(),
            reason: dialogReason || undefined
          });
        })
      );

      toast.showToast({
        title: "Tactical Overrides Committed",
        description: `${targets.length} blackout windows have been deployed.`,
        variant: "success"
      });

      setDialogOpen(false);
      setDialogReason("");
      setSelectedDates(new Set());
      queryClient.invalidateQueries({ queryKey: ["provider", "blackouts", user?.id] });
    } catch (error: any) {
      toast.showToast({
        title: "Batch Operation Failed",
        description: error.message || "Some overrides could not be deployed.",
        variant: "error"
      });
    }
  };

  const selectedDateKey = dialogDate ? dateKey(dialogDate) : null;
  const selectedWeekdayKey = dialogDate ? WEEKDAYS[dialogDate.getDay()] : null;
  const daySlots = selectedWeekdayKey ? weeklyByWeekday[selectedWeekdayKey] ?? [] : [];
  const dayBookings = selectedDateKey ? bookingsByDay[selectedDateKey] ?? [] : [];
  const dayBlackouts = useMemo(
    () =>
      dialogDate
        ? (blackouts ?? []).filter((entry) => {
          const start = new Date(entry.start_at);
          return start.toDateString() === dialogDate.toDateString();
        })
        : [],
    [blackouts, dialogDate]
  );

  const isBatch = selectedDates.size > 1;
  const selectedDatesList = Array.from(selectedDates).sort().map(d => new Date(d));

  return (
    <div className="relative min-h-screen pb-20">
      {/* Immersive Header */}
      <header className="relative mb-12 overflow-hidden rounded-[48px] bg-slate-900 p-8 text-white shadow-2xl md:p-12">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-brand-500/20 blur-[100px]" />
        <div className="absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-[100px]" />

        <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30">
                <CalendarCheck2 className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">Mission Control</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Professional <span className="text-brand-400">Schedule.</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg font-medium text-slate-400 leading-relaxed">
              Precision timing is mission-critical. Coordinate your recurring availability,
              manage tactical blackouts, and monitor deployment windows.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-4 md:w-auto">
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Windows</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black">{availability?.length ?? 0}</span>
                <span className="text-xs font-bold text-emerald-400">Online</span>
              </div>
            </div>
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Upcoming Shifts</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black">{(bookingsQuery.data?.bookings ?? []).length}</span>
                <span className="text-xs font-bold text-brand-400">Deployed</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-8">
          {/* Calendar Card */}
          <Card
            className="relative overflow-hidden border-none bg-white p-8 shadow-xl ring-1 ring-black/5"
            title={<span className="text-2xl font-black text-slate-900">Deployment Calendar</span>}
            description="Manage tactical availability and monitor scheduled deployments."
          >
            <div className="mt-8 flex items-center justify-between rounded-[24px] bg-slate-50 p-4 ring-1 ring-black/5">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:text-brand-600"
                onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-black text-slate-900">
                {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </h3>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:text-brand-600"
                onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-8 grid grid-cols-7 gap-3 text-center text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              {CALENDAR_DAY_NAMES.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-7 gap-3">
              {calendarDays.map((day) => (
                <button
                  key={day.date.toISOString()}
                  type="button"
                  onClick={(e) => {
                    if (e.shiftKey || e.metaKey || e.ctrlKey) {
                      toggleDateSelection(day.date);
                    } else {
                      openDialogForDate(day.date);
                    }
                  }}
                  className={classNames(
                    "group relative flex min-h-[100px] flex-col rounded-[24px] border border-transparent p-4 text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500",
                    day.isCurrentMonth
                      ? "bg-slate-50/50 hover:bg-white hover:shadow-xl hover:ring-1 hover:ring-black/5"
                      : "bg-slate-50/20 text-slate-300 opacity-50",
                    day.blackoutCount > 0 && "bg-amber-50/50 ring-1 ring-amber-500/20",
                    day.isToday && "ring-2 ring-brand-500 bg-white shadow-lg",
                    day.isSelected && "ring-2 ring-brand-500 bg-brand-50 shadow-brand-100"
                  )}
                >
                  <span className={classNames(
                    "text-lg font-black",
                    day.isCurrentMonth ? (day.isToday ? "text-brand-600" : "text-slate-900") : "text-slate-300"
                  )}>
                    {day.date.getDate()}
                  </span>

                  <div className="mt-auto flex flex-wrap gap-1">
                    {day.availability.length > 0 && (
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    )}
                    {day.blackoutCount > 0 && (
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    )}
                    {day.bookings.length > 0 && (
                      <div className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                    )}
                  </div>

                  {day.bookings.length > 0 && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-lg bg-brand-50 text-[10px] font-black text-brand-600 ring-1 ring-brand-500/20">
                      {day.bookings.length}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* Recurring Availability Setup */}
          <Card
            className="relative border-none bg-white p-8 shadow-xl ring-1 ring-black/5"
            title={<span className="text-2xl font-black text-slate-900">Combat Schedule</span>}
            description="Configure your baseline recurring operations per weekday."
          >
            <div className="mt-8 space-y-6">
              {WEEKDAYS.map((weekday) => {
                const slots = weeklyByWeekday[weekday] ?? [];
                return (
                  <div key={weekday} className="rounded-[32px] bg-slate-50/50 p-6 ring-1 ring-black/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-black/5">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-900">{WEEKDAY_LABELS[weekday]}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {slots.length} Active Slots
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addRowForWeekday(weekday)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-black/10 transition-all hover:bg-brand-50 hover:shadow-md"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>

                    {slots.length > 0 ? (
                      <div className="mt-6 space-y-3">
                        {slots.map((slot) => (
                          <div key={slot.id} className="group relative flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={slot.start_time}
                                onChange={(e) => updateRow(slot.id, { start_time: e.target.value })}
                                className="h-10 rounded-xl border-none bg-slate-50 px-3 text-sm font-bold text-slate-900 ring-1 ring-black/5 focus:ring-2 focus:ring-brand-500"
                              />
                              <span className="text-[10px] font-black uppercase text-slate-300">to</span>
                              <input
                                type="time"
                                value={slot.end_time}
                                onChange={(e) => updateRow(slot.id, { end_time: e.target.value })}
                                className="h-10 rounded-xl border-none bg-slate-50 px-3 text-sm font-bold text-slate-900 ring-1 ring-black/5 focus:ring-2 focus:ring-brand-500"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="h-4 w-[1px] bg-slate-100 hidden sm:block" />
                              <input
                                type="date"
                                value={slot.effective_from ?? ""}
                                onChange={(e) => updateRow(slot.id, { effective_from: e.target.value || undefined })}
                                className="h-10 rounded-xl border-none bg-slate-50 px-3 text-[11px] font-bold text-slate-600 ring-1 ring-black/5 focus:ring-2 focus:ring-brand-500"
                              />
                              <span className="text-slate-300">→</span>
                              <input
                                type="date"
                                value={slot.effective_to ?? ""}
                                onChange={(e) => updateRow(slot.id, { effective_to: e.target.value || undefined })}
                                className="h-10 rounded-xl border-none bg-slate-50 px-3 text-[11px] font-bold text-slate-600 ring-1 ring-black/5 focus:ring-2 focus:ring-brand-500"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => setConfirmAction({
                                type: "delete_window",
                                payload: slot.id,
                                message: `Remove this window from ${WEEKDAY_LABELS[weekday]}?`,
                                confirmLabel: "Remove Slot"
                              })}
                              className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-[11px] font-medium italic text-slate-400">Offline - No deployments scheduled.</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex justify-end">
              <Button
                className="h-14 rounded-2xl px-12 text-sm font-black uppercase tracking-widest shadow-xl shadow-brand-100"
                onClick={() => setConfirmAction({
                  type: "save_availability",
                  message: "Update your permanent recurring operations profile?",
                  confirmLabel: "Sync Schedule"
                })}
                disabled={!hasChanges || updateAvailabilityMutation.isPending}
                loading={updateAvailabilityMutation.isPending}
              >
                <Zap className="mr-2 h-5 w-5" />
                Commit Baseline
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Blackouts Summary */}
          <Card
            className="border-none bg-white p-8 shadow-xl ring-1 ring-black/5"
            title={<span className="text-xl font-black text-slate-900">Tactical Blackouts</span>}
            description="Active overrides and maneuvers."
          >
            {sortedBlackouts.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center rounded-[32px] bg-slate-50 p-8 text-center ring-1 ring-black/5">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm ring-1 ring-black/5">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold text-slate-400">No blackout windows active.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {sortedBlackouts.map((entry) => (
                  <div key={entry.id} className="group relative flex flex-col gap-3 rounded-[24px] bg-slate-50/50 p-5 ring-1 ring-black/5 transition-all hover:bg-white hover:shadow-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shadow-sm ring-1 ring-amber-200">
                        <History className="h-4 w-4" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({
                          type: "delete_blackout",
                          payload: entry.id,
                          message: "Restore availability for this tactical window?",
                          confirmLabel: "Abort Blackout"
                        })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-black/5 transition-all hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Mission Blackout</p>
                      <p className="mt-1 text-xs font-bold text-slate-900">
                        {new Date(entry.start_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500">
                        {new Date(entry.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(entry.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {entry.reason && (
                        <p className="mt-2 text-[10px] font-medium leading-relaxed italic text-slate-400">
                          &quot;{entry.reason}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Guide */}
          <div className="rounded-[32px] bg-slate-900 p-8 text-white shadow-xl">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[20px] bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30">
              <HelpCircle className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-black tracking-tight">System Intel</h4>
            <ul className="mt-6 space-y-4">
              {[
                "Recurring hours set your baseline deployment slots.",
                "Blackouts override any baseline availability.",
                "Accepted bookings are prioritized and visible here.",
                "Mission status is auto-synced with Dispatch."
              ].map((text, i) => (
                <li key={i} className="flex gap-3 text-xs font-medium text-slate-400 leading-relaxed">
                  <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand-50 text-brand-600 ring-1 ring-brand-500/20">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-slate-900 leading-none">
                {dialogDate ? dialogDate.toLocaleDateString(undefined, { weekday: "long" }) : "Edit Day"}
              </p>
              <p className="mt-1 text-[11px] font-bold text-slate-400 leading-none">
                {dialogDate ? dialogDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Schedule Overrides"}
              </p>
            </div>
          </div>
        }
        description="Synchronize your recurring baseline or execute a tactical blackout for this deployment window."
        confirmLabel="Execute Blackout"
        onConfirm={handleConfirmBlackout}
        onClose={() => setDialogOpen(false)}
        loading={createBlackoutMutation.isPending}
      >
        {!isBatch && selectedWeekdayKey && (
          <div className="space-y-3">
            <div className="rounded-[28px] bg-slate-50/50 p-6 ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-900">
                    Recurring Baseline
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addRowForWeekday(selectedWeekdayKey)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm ring-1 ring-black/10 transition-all hover:bg-brand-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {daySlots.length === 0 && <p className="mt-2 text-xs text-slate-500">No recurring hours for this weekday yet.</p>}
              <div className="mt-3 space-y-3">
                {daySlots.map((slot) => (
                  <div key={slot.id} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      value={slot.start_time}
                      onChange={(event) => updateRow(slot.id, { start_time: event.target.value })}
                      className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                    <span className="text-xs font-semibold text-slate-500">to</span>
                    <input
                      type="time"
                      value={slot.end_time}
                      onChange={(event) => updateRow(slot.id, { end_time: event.target.value })}
                      className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                    <input
                      type="date"
                      value={slot.effective_from ?? ""}
                      onChange={(event) => updateRow(slot.id, { effective_from: event.target.value || undefined })}
                      className="w-36 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                    <span className="text-xs font-semibold text-slate-500">→</span>
                    <input
                      type="date"
                      value={slot.effective_to ?? ""}
                      onChange={(event) => updateRow(slot.id, { effective_to: event.target.value || undefined })}
                      className="w-36 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          type: "delete_window",
                          payload: slot.id,
                          message: `Remove ${slot.start_time} – ${slot.end_time} from ${WEEKDAY_LABELS[selectedWeekdayKey]}?`,
                          confirmLabel: "Remove Slot"
                        })
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete window"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right">
                <Button
                  className="h-10 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-100"
                  onClick={() =>
                    setConfirmAction({
                      type: "save_availability",
                      message: "Sync your recurring baseline changes with Mission Control?",
                      confirmLabel: "Sync Profile"
                    })
                  }
                  disabled={!hasChanges || updateAvailabilityMutation.isPending}
                  loading={updateAvailabilityMutation.isPending}
                >
                  Sync Baseline
                </Button>
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-500" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">Tactical Override</p>
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-400">Block one-off deployment windows.</p>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {isBatch ? "Operational Start Time" : "Intelligence Start"}
                  </span>
                  <input
                    type={isBatch ? "time" : "datetime-local"}
                    value={dialogStart}
                    onChange={(event) => setDialogStart(event.target.value)}
                    className="h-11 rounded-xl border-none bg-slate-50 px-4 text-sm font-bold text-slate-900 ring-1 ring-black/5 focus:ring-2 focus:ring-brand-500"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {isBatch ? "Operational End Time" : "Intelligence End"}
                  </span>
                  <input
                    type={isBatch ? "time" : "datetime-local"}
                    value={dialogEnd}
                    onChange={(event) => setDialogEnd(event.target.value)}
                    className="h-11 rounded-xl border-none bg-slate-50 px-4 text-sm font-bold text-slate-900 ring-1 ring-black/5 focus:ring-2 focus:ring-brand-500"
                  />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deployment Reasoning</span>
                <textarea
                  rows={2}
                  value={dialogReason}
                  placeholder="Intel/Reason for blackout..."
                  onChange={(event) => setDialogReason(event.target.value)}
                  className="rounded-xl border-none bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 ring-1 ring-black/5 focus:ring-2 focus:ring-brand-500"
                />
              </label>
            </div>

            <div className="rounded-[28px] bg-slate-50/50 p-6 ring-1 ring-black/5">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">Active Blackouts</p>
              </div>
              {dayBlackouts.length === 0 ? (
                <p className="mt-2 text-[11px] font-bold text-slate-400 italic">No blackouts for this deployment.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {dayBlackouts.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {new Date(entry.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{" "}
                          {new Date(entry.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {entry.reason && <p className="text-[10px] font-medium text-slate-400 italic">{entry.reason}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmAction({
                            type: "delete_blackout",
                            payload: entry.id,
                            message: "Abort this blackout?",
                            confirmLabel: "Abort"
                          })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-all hover:text-rose-600"
                        aria-label="Remove blackout"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-[28px] bg-slate-900 p-6 text-white shadow-xl">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-brand-400" />
                <p className="text-xs font-black uppercase tracking-widest text-brand-400">Deployments</p>
              </div>
              {dayBookings.length === 0 ? (
                <p className="mt-2 text-[11px] font-bold text-slate-500 italic">No active missions scheduled.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {dayBookings.map((booking) => {
                    const scheduled =
                      (typeof booking.meta?.scheduled_for === "string" && booking.meta?.scheduled_for) ||
                      booking.acceptedAt ||
                      booking.createdAt;
                    return (
                      <li key={booking.id} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-white">{booking.service?.name ?? "Service"}</p>
                          <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand-400 ring-1 ring-brand-500/30">
                            {booking.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                          {booking.client?.fullName ?? "Client"} •{" "}
                          {scheduled ? new Date(scheduled).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
        {isBatch && (
          <div className="space-y-4">
            <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-500" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">Batch Tactical Override</p>
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-400">Applying universal blackout to selected deployment windows.</p>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Time</span>
                  <input
                    type="time"
                    value={dialogStart.includes("T") ? dialogStart.split("T")[1].substring(0, 5) : dialogStart}
                    onChange={(event) => setDialogStart(event.target.value)}
                    className="h-11 rounded-xl border-none bg-slate-50 px-4 text-sm font-bold text-slate-900 ring-1 ring-black/5 focus:ring-2 focus:ring-brand-500"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Time</span>
                  <input
                    type="time"
                    value={dialogEnd.includes("T") ? dialogEnd.split("T")[1].substring(0, 5) : dialogEnd}
                    onChange={(event) => setDialogEnd(event.target.value)}
                    className="h-11 rounded-xl border-none bg-slate-50 px-4 text-sm font-bold text-slate-900 ring-1 ring-black/5 focus:ring-2 focus:ring-brand-500"
                  />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deployment Reasoning</span>
                <textarea
                  rows={2}
                  value={dialogReason}
                  placeholder="Shared reason for this batch..."
                  onChange={(event) => setDialogReason(event.target.value)}
                  className="rounded-xl border-none bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 ring-1 ring-black/5 focus:ring-2 focus:ring-brand-500"
                />
              </label>
            </div>

            <div className="rounded-[28px] bg-slate-50/50 p-6 ring-1 ring-black/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Target Dates</p>
              <div className="flex flex-wrap gap-2">
                {selectedDatesList.map(date => (
                  <span key={date.toISOString()} className="rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold text-slate-900 ring-1 ring-black/5 shadow-sm">
                    {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-amber-50 text-amber-600 ring-1 ring-amber-500/20">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="text-sm font-black text-slate-900">Confirm Tactical Action</p>
          </div>
        }
        description={confirmAction?.message}
        confirmLabel={confirmAction?.confirmLabel ?? "Confirm Execution"}
        onConfirm={() => {
          if (!confirmAction) {
            return;
          }
          if (confirmAction.type === "save_availability") {
            updateAvailabilityMutation.mutate(rows);
          } else if (confirmAction.type === "delete_window" && typeof confirmAction.payload === "string") {
            removeRow(confirmAction.payload);
          } else if (
            (confirmAction.type === "delete_blackout" || confirmAction.type === "delete_upcoming") &&
            typeof confirmAction.payload === "string"
          ) {
            deleteBlackoutMutation.mutate(confirmAction.payload);
          }
          setConfirmAction(null);
        }}
        onClose={() => setConfirmAction(null)}
        loading={updateAvailabilityMutation.isPending || deleteBlackoutMutation.isPending}
      />

      {/* Batch Action Bar */}
      {selectedDates.size > 1 && (
        <div className="fixed bottom-10 left-1/2 z-50 flex -translate-x-1/2 items-center gap-6 rounded-[32px] bg-slate-900 px-8 py-5 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition-all animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black">{selectedDates.size} Days Selected</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Multi-Day Context</p>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-white/10" />

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedDates(new Set())}
              className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Clear
            </button>
            <Button
              className="h-11 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-500/20"
              onClick={openDialogForSelected}
            >
              Apply Override
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityPage;
