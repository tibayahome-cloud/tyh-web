import { useCallback, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import classNames from "classnames";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PhoneIcon from "@mui/icons-material/PhoneOutlined";
import NavigationIcon from "@mui/icons-material/NavigationOutlined";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import LocationOnIcon from "@mui/icons-material/LocationOnOutlined";
import MedicalServicesIcon from "@mui/icons-material/MedicalServicesOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCarOutlined";
import HealingIcon from "@mui/icons-material/HealingOutlined";
import DoneAllIcon from "@mui/icons-material/DoneAllOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import CompassIcon from "@mui/icons-material/ExploreOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrowOutlined";
import PauseIcon from "@mui/icons-material/PauseOutlined";
import FastForwardIcon from "@mui/icons-material/FastForwardOutlined";

import { Button } from "../../../shared/components/Button";
import type { Booking } from "../../../shared/schemas/booking";
import { useMarkBookingMutation } from "../../../shared/hooks/useBookings";

type ImmersiveProviderBookingViewProps = {
  booking: Booking;
  onClose?: () => void;
  onOpenChat?: () => void;
};

type WorkflowStep = {
  status: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
  actionLabel?: string;
  color: string;
  bgColor: string;
};

const WORKFLOW: WorkflowStep[] = [
  {
    status: "accepted",
    label: "Accepted",
    description: "You accepted this request. Start heading to the client.",
    icon: <CheckCircleIcon />,
    action: "en_route",
    actionLabel: "Start Heading There",
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-100"
  },
  {
    status: "en_route",
    label: "En Route",
    description: "You are on your way to the client's location.",
    icon: <DirectionsCarIcon />,
    action: "arrived",
    actionLabel: "I've Arrived",
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-100"
  },
  {
    status: "nearby",
    label: "Nearby",
    description: "You are close to the client's location.",
    icon: <DirectionsCarIcon />,
    action: "arrived",
    actionLabel: "I've Arrived",
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-100"
  },
  {
    status: "arrived",
    label: "Arrived",
    description: "You have arrived. Let the client know and prepare for service.",
    icon: <LocationOnIcon />,
    action: "start_service",
    actionLabel: "Start Service",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 border-emerald-100"
  },
  {
    status: "in_service",
    label: "In Service",
    description: "Service is underway. Complete when done.",
    icon: <HealingIcon />,
    action: "complete",
    actionLabel: "Complete Service",
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-100"
  },
  {
    status: "completed_by_provider",
    label: "Completed",
    description: "Awaiting client confirmation and payment.",
    icon: <DoneAllIcon />,
    action: "client_confirmed",
    actionLabel: "Request Payment (STK Push)",
    color: "text-slate-600",
    bgColor: "bg-slate-50 border-slate-100"
  }
];

const STEP_ORDER = ["accepted", "en_route", "nearby", "arrived", "in_service", "completed_by_provider"];

const NAVIGATION_STEPS = [
  { instruction: "Head north-west toward Ring Road Westlands", distance: 400, label: "400 m" },
  { instruction: "Turn right onto Ring Road Westlands", distance: 1200, label: "1.2 km" },
  { instruction: "At the roundabout, take the 2nd exit onto Waiyaki Way/A104", distance: 4500, label: "4.5 km" },
  { instruction: "Take the exit toward Westlands/Kenyatta National Hospital", distance: 800, label: "800 m" },
  { instruction: "Turn left onto client's access road", distance: 300, label: "300 m" },
  { instruction: "Arrive at client's destination on the left", distance: 0, label: "0 m" }
];

export const ImmersiveProviderBookingView = ({ booking, onClose, onOpenChat }: ImmersiveProviderBookingViewProps) => {
  const navigate = useNavigate();
  const markBooking = useMarkBookingMutation();
  const [showDetails, setShowDetails] = useState(false);
  
  // Navigation states
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndexNav, setCurrentStepIndexNav] = useState(0);
  const [simulatedProgress, setSimulatedProgress] = useState(0); // 0 to 100%
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedDistance, setSimulatedDistance] = useState(7200); // 7.2 km in meters
  const [simulatedEta, setSimulatedEta] = useState(14); // minutes
  
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clientName = booking.client?.fullName || "Client";
  const clientInitials = clientName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const currentStep = WORKFLOW.find((s) => s.status === booking.status);
  const currentStepIndex = STEP_ORDER.indexOf(booking.status ?? "");

  const handleCall = useCallback(() => {
    if (booking.client?.phone) {
      window.location.href = `tel:${booking.client.phone}`;
    }
  }, [booking.client?.phone]);

  const handleAction = useCallback(
    (action: string) => {
      markBooking.mutate({
        bookingId: booking.id,
        action: action as "en_route" | "nearby" | "arrived" | "start_service" | "complete" | "client_confirmed"
      });
    },
    [booking.id, markBooking]
  );

  // Simulation Logic
  useEffect(() => {
    if (isSimulating) {
      simulationTimerRef.current = setInterval(() => {
        setSimulatedProgress((prev) => {
          const next = prev + 5;
          if (next >= 100) {
            setIsSimulating(false);
            setCurrentStepIndexNav(NAVIGATION_STEPS.length - 1);
            setSimulatedDistance(0);
            setSimulatedEta(0);
            // Auto trigger "nearby" / "arrived" state mapping
            handleAction("arrived");
            return 100;
          }
          
          // Update navigation step based on progress percentage
          const stepIndex = Math.min(
            Math.floor((next / 100) * NAVIGATION_STEPS.length),
            NAVIGATION_STEPS.length - 2
          );
          setCurrentStepIndexNav(stepIndex);
          setSimulatedDistance(Math.max(0, Math.round(7200 * (1 - next / 100))));
          setSimulatedEta(Math.max(0, Math.round(14 * (1 - next / 100))));
          return next;
        });
      }, 1000);
    } else {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    }

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, [isSimulating, handleAction]);

  const toggleSimulation = () => {
    setIsSimulating((prev) => !prev);
  };

  const fastForwardSimulation = () => {
    setSimulatedProgress(100);
    setIsSimulating(false);
    setCurrentStepIndexNav(NAVIGATION_STEPS.length - 1);
    setSimulatedDistance(0);
    setSimulatedEta(0);
    handleAction("arrived");
  };

  const resetSimulation = () => {
    setSimulatedProgress(0);
    setIsSimulating(false);
    setCurrentStepIndexNav(0);
    setSimulatedDistance(7200);
    setSimulatedEta(14);
  };

  // Format meters to km
  const formatMeters = (m: number) => {
    if (m >= 1000) {
      return `${(m / 1000).toFixed(1)} km`;
    }
    return `${m} m`;
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)" }}>
      
      {/* ----------------- IN-APP NAVIGATION HUD VIEW ----------------- */}
      {isNavigating ? (
        <div className="absolute inset-0 z-50 flex flex-col bg-slate-950 text-white animate-in fade-in slide-in-from-bottom duration-300">
          
          {/* Navigation HUD Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-900/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <CompassIcon className="text-brand-400 animate-spin-slow" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Navigation Mode</p>
                <p className="text-sm font-bold text-white">Heading to client</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsNavigating(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white border border-white/10 hover:bg-white/20"
            >
              <CloseIcon fontSize="small" />
            </button>
          </div>

          {/* Current Turn Instruction Card */}
          <div className="m-4 p-5 rounded-3xl bg-blue-600 text-white shadow-2xl border border-blue-500 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white">
              <NavigationIcon style={{ transform: "rotate(45deg)", fontSize: 24 }} />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-blue-100">Next Instruction</p>
              <p className="mt-1 text-lg font-bold leading-snug">
                {NAVIGATION_STEPS[currentStepIndexNav]?.instruction}
              </p>
              <p className="mt-1 text-sm font-semibold text-blue-200">
                In {formatMeters(NAVIGATION_STEPS[currentStepIndexNav]?.distance || 0)}
              </p>
            </div>
          </div>

          {/* Tactical SVG Route Radar Map Fallback */}
          <div className="flex-1 relative flex items-center justify-center bg-slate-900 border-y border-white/5 overflow-hidden">
            
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
            
            {/* Radar Circle Sweeper */}
            <div className="absolute w-[280px] h-[280px] rounded-full border border-teal-500/20 flex items-center justify-center">
              <div className="w-[180px] h-[180px] rounded-full border border-teal-500/10 flex items-center justify-center">
                <div className="w-[80px] h-[80px] rounded-full border border-teal-500/5" />
              </div>
            </div>

            {/* Glowing Tactical Map Line */}
            <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 400 400">
              <defs>
                <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              
              {/* The Route Path Line */}
              <path
                d="M 100,320 C 130,220 180,240 200,160 C 220,80 270,120 300,80"
                fill="none"
                stroke="url(#routeGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                className="opacity-80"
              />
              
              {/* Completed Path Portion (Simulated Overlay) */}
              <path
                d="M 100,320 C 130,220 180,240 200,160 C 220,80 270,120 300,80"
                fill="none"
                stroke="#10b981"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="400"
                strokeDashoffset={400 - (400 * simulatedProgress) / 100}
                className="transition-all duration-300"
              />

              {/* Provider Node (pulsing blue/teal indicator) */}
              {/* Provider coordinates calculated dynamically based on path progress */}
              <g style={{
                transform: `translate(${100 + (200 * simulatedProgress) / 100}px, ${320 - (240 * simulatedProgress) / 100}px)`,
                transition: "transform 0.5s ease-out"
              }}>
                <circle r="14" fill="#3b82f6" className="opacity-20 animate-ping" />
                <circle r="8" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
                <text y="-14" textAnchor="middle" fill="#3b82f6" className="text-[10px] font-bold tracking-widest uppercase">You</text>
              </g>

              {/* Client Destination Node (green target pin) */}
              <g transform="translate(300, 80)">
                <circle r="16" fill="#10b981" className="opacity-25 animate-pulse" />
                <circle r="8" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                <text y="-14" textAnchor="middle" fill="#10b981" className="text-[10px] font-bold tracking-widest uppercase">Client</text>
              </g>
            </svg>

            {/* Floating Navigation Instructions List Overlay */}
            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 border border-white/10 rounded-2xl p-3 backdrop-blur max-h-[140px] overflow-y-auto">
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-2 border-b border-white/5 pb-1">Upcoming Steps</p>
              <div className="space-y-1.5 text-xs">
                {NAVIGATION_STEPS.slice(currentStepIndexNav + 1).map((step, idx) => (
                  <div key={idx} className="flex justify-between text-slate-300">
                    <span className="truncate">{step.instruction}</span>
                    <span className="text-slate-500 font-semibold shrink-0 ml-2">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Development-Only Simulation Dashboard (User Friendly Testing) */}
            {import.meta.env.DEV && (
              <div className="absolute top-4 left-4 right-4 bg-slate-900/95 border border-amber-500/20 rounded-2xl p-3 backdrop-blur flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Test Simulator</p>
                  <p className="text-xs text-slate-400 font-medium">Drive progress: {simulatedProgress}%</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={toggleSimulation}
                    className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-2.5 py-1.5 rounded-lg transition"
                  >
                    {isSimulating ? <PauseIcon style={{ fontSize: 14 }} /> : <PlayArrowIcon style={{ fontSize: 14 }} />}
                    {isSimulating ? "Pause" : "Drive"}
                  </button>
                  <button
                    onClick={fastForwardSimulation}
                    className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg transition"
                  >
                    <FastForwardIcon style={{ fontSize: 14 }} />
                    Arrive
                  </button>
                  <button
                    onClick={resetSimulation}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-xs px-2.5 py-1.5 rounded-lg transition"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation HUD Footer Dashboard */}
          <div className="bg-slate-900 p-6 pb-safe-bottom border-t border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ETA</p>
              <p className="text-2xl font-black text-emerald-400">{simulatedEta} mins</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Distance</p>
              <p className="text-2xl font-black text-white">{formatMeters(simulatedDistance)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Speed</p>
              <p className="text-2xl font-black text-blue-400">{isSimulating ? "45 km/h" : "0 km/h"}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ----------------- STANDARD DISPATCH OVERLAY VIEW ----------------- */}
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 pt-safe-top">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm"
        >
          <CloseIcon fontSize="small" />
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
          <div className={classNames("h-2 w-2 rounded-full animate-pulse", currentStep ? "bg-emerald-400" : "bg-slate-400")} />
          <span className="text-xs font-semibold uppercase tracking-widest text-white/80">
            {currentStep?.label ?? "Booking"}
          </span>
        </div>
        <Button
          onClick={() => setIsNavigating(true)}
          variant="primary"
          className="gap-2 rounded-full px-4 py-2 text-sm"
        >
          <NavigationIcon fontSize="small" />
          Navigate
        </Button>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-2 space-y-4">

        {/* Client card */}
        <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-sm border border-white/10">
          <div className="flex items-center gap-4">
            {booking.client?.avatarUrl ? (
              <img
                src={booking.client.avatarUrl}
                alt={clientName}
                className="h-16 w-16 rounded-2xl object-cover shadow-xl"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-700 text-xl font-bold text-white shadow-xl">
                {clientInitials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Your client</p>
              <p className="mt-0.5 text-lg font-bold text-white truncate">{clientName}</p>
              {booking.service?.name && (
                <div className="mt-1 flex items-center gap-1.5">
                  <MedicalServicesIcon style={{ fontSize: 13 }} className="text-teal-400" />
                  <p className="text-sm text-teal-300 font-medium truncate">{booking.service.name}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {booking.client?.phone && (
                <button
                  type="button"
                  onClick={handleCall}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                >
                  <PhoneIcon fontSize="small" />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenChat}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30"
              >
                <ChatBubbleOutlineIcon fontSize="small" />
              </button>
            </div>
          </div>

          {/* Address */}
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-white/5 p-3 border border-white/10">
            <LocationOnIcon className="text-rose-400 mt-0.5 shrink-0" fontSize="small" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/40 uppercase tracking-wide">Destination</p>
              <p className="text-sm font-semibold text-white mt-0.5">
                {booking.addressText || "Client's Location"}
              </p>
              {booking.lat && booking.lng && !booking.addressText && (
                <p className="text-xs text-white/30 mt-0.5 font-mono">
                  {booking.lat.toFixed(4)}, {booking.lng.toFixed(4)}
                </p>
              )}
            </div>
            {booking.lat && booking.lng && (
              <a
                href={`https://maps.google.com/?q=${booking.lat},${booking.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-white/50 hover:text-white hover:bg-white/20 transition"
                title="Open in Google Maps"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Current status highlight */}
        {currentStep && (
          <div className={classNames("rounded-3xl border p-5", currentStep.bgColor)}>
            <div className="flex items-center gap-3">
              <div className={classNames("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", currentStep.color, "bg-white shadow-md")}>
                {currentStep.icon}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Current Status</p>
                <p className="mt-0.5 text-base font-bold text-slate-800">{currentStep.label}</p>
                <p className="text-sm text-slate-500">{currentStep.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Workflow progress tracker */}
        <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-sm border border-white/10">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-4">Progress</p>
          <div className="space-y-3">
            {WORKFLOW.filter(s => s.status !== "nearby").map((step, index) => {
              const stepIdx = STEP_ORDER.indexOf(step.status);
              const done = currentStepIndex > stepIdx;
              const active = booking.status === step.status;
              return (
                <div key={step.status} className="flex items-center gap-3">
                  <div className={classNames(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                    done ? "bg-emerald-500 text-white" : active ? "bg-white text-slate-900 shadow-lg ring-4 ring-white/30" : "bg-white/10 text-white/30"
                  )}>
                    {done ? "✓" : index + 1}
                  </div>
                  <div className="flex-1">
                    <p className={classNames("text-sm font-semibold", done ? "text-emerald-400" : active ? "text-white" : "text-white/30")}>
                      {step.label}
                    </p>
                  </div>
                  {active && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white/80">Now</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Booking details toggle */}
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex w-full items-center gap-3 rounded-3xl bg-white/10 p-4 border border-white/10 text-left"
        >
          <AssignmentIcon className="text-white/40" fontSize="small" />
          <span className="flex-1 text-sm font-semibold text-white/70">Booking Details</span>
          <span className="text-xs text-white/40">{showDetails ? "Hide" : "View"}</span>
        </button>

        {showDetails && (
          <div className="rounded-3xl bg-white/10 p-5 border border-white/10 space-y-3">
            {[
              { label: "Booking ID", value: booking.id?.slice(0, 8).toUpperCase() },
              { label: "Service", value: booking.service?.name },
              { label: "Emergency", value: booking.emergency ? "Yes" : "No" },
              { label: "Scheduled", value: booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString() : "ASAP" },
            ].filter(d => d.value).map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
                <span className="text-xs text-white/40 uppercase tracking-wide">{label}</span>
                <span className="text-sm font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed action bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-safe-bottom" style={{ background: "linear-gradient(to top, #0f172a 70%, transparent)" }}>
        {currentStep?.action ? (
          <Button
            onClick={() => handleAction(currentStep.action!)}
            loading={markBooking.isPending}
            className="w-full rounded-2xl py-4 text-base font-bold shadow-xl"
          >
            {currentStep.actionLabel}
          </Button>
        ) : (
          <Button
            onClick={() => navigate(`/pro/bookings/${booking.id}`)}
            variant="outline"
            className="w-full rounded-2xl py-4 text-base font-bold"
          >
            View Full Details
          </Button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ImmersiveProviderBookingView;
