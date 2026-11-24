import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    ChevronRight,
    FlaskConical,
    House,
    MessageCircleHeart,
    Phone,
    Pill,
    ScanLine,
    Siren,
    Stethoscope,
    Video,
    type LucideIcon
} from "lucide-react";
import { COMPANY_PHONE, COMPANY_PHONE_DISPLAY } from "../../../shared/constants/contact";
import {
    CLIENT_HOME_CARE_PATH,
    PUBLIC_HOME_CARE_BOOKING_PATH,
    telemedicineBookingPath,
    type TelemedicineChoice
} from "../../../shared/utils/returnPath";

export type TaskTile = {
    key: string;
    label: string;
    icon: LucideIcon;
    /** An address inside the app or site. Empty for the ambulance tile, which opens the numbers to call. */
    to: string;
    /** The ambulance tile is a button that opens the numbers to call, not a link to a booking. */
    emergency?: boolean;
    tint: "blue" | "gold";
};

/**
 * The eight things a visitor comes to do. Each tile takes the person to the place where that thing is done, with their
 * choice already made: a care area filtered (video doctor, specialist, mental health) or the one service that matches
 * (lab results, scans, prescriptions: a doctor reviews the report the patient brings). `inApp` is true only on the signed-in
 * client home, where the booking is inside the app; the public landing page always uses the public booking pages.
 * The ambulance tile opens the numbers to call until the ambulance request is built.
 */
export const taskTiles = (inApp: boolean): TaskTile[] => {
    const homeCare = inApp ? CLIENT_HOME_CARE_PATH : PUBLIC_HOME_CARE_BOOKING_PATH;
    const book = (choice: TelemedicineChoice) => telemedicineBookingPath(inApp, choice);
    return [
        { key: "video", label: "Video doctor", icon: Video, to: book({ category: "firstcare" }), tint: "blue" },
        { key: "specialist", label: "Find a specialist", icon: Stethoscope, to: book({ category: "specialistcare" }), tint: "blue" },
        { key: "mental-health", label: "Mental health", icon: MessageCircleHeart, to: book({ category: "mental-health" }), tint: "gold" },
        { key: "lab-results", label: "Lab results", icon: FlaskConical, to: book({ service: "follow-up-medical-consultation" }), tint: "blue" },
        { key: "scan-results", label: "Scan results", icon: ScanLine, to: book({ service: "diagnostic-report-review" }), tint: "blue" },
        { key: "prescriptions", label: "Prescriptions", icon: Pill, to: book({ service: "medical-advice-referral" }), tint: "blue" },
        { key: "home-care", label: "Home care", icon: House, to: homeCare, tint: "blue" },
        { key: "ambulance", label: "Ambulance", icon: Siren, to: "", emergency: true, tint: "blue" }
    ];
};

const TILE_CLASS =
    "group relative flex h-full min-h-[96px] flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-tiba-blue/40 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue";

const CALLS = [
    { href: "tel:999", label: "Call 999" },
    { href: "tel:112", label: "Call 112" },
    { href: `tel:${COMPANY_PHONE}`, label: `Call ${COMPANY_PHONE_DISPLAY}` }
];

export const TaskTiles = ({ isAuthenticated }: { isAuthenticated: boolean }) => {
    const [emergencyOpen, setEmergencyOpen] = useState(false);
    const firstCall = useRef<HTMLAnchorElement | null>(null);

    // Someone who opens the numbers is in a hurry: put the first one under their thumb.
    useEffect(() => {
        if (emergencyOpen) firstCall.current?.focus();
    }, [emergencyOpen]);

    return (
        <section aria-labelledby="task-tiles-heading">
            <h2 id="task-tiles-heading" className="mb-3 text-xl font-bold text-tiba-blue sm:text-2xl">
                What can we help you with today?
            </h2>
            <ul className="grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4 lg:max-w-none">
                {taskTiles(isAuthenticated).map(({ key, label, icon: Icon, to, emergency, tint }) => {
                    const inside = (
                        <>
                            <span
                                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                    tint === "gold" ? "bg-tiba-gold/20" : "bg-tiba-blue/10"
                                } text-tiba-blue`}
                            >
                                <Icon className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="pr-4 text-left text-sm font-semibold leading-snug text-slate-900">{label}</span>
                            <ChevronRight className="absolute right-2.5 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
                        </>
                    );
                    return (
                        <li key={key}>
                            {emergency ? (
                                <button
                                    type="button"
                                    className={`${TILE_CLASS} w-full`}
                                    aria-expanded={emergencyOpen}
                                    aria-controls="emergency-numbers"
                                    onClick={() => setEmergencyOpen((open) => !open)}
                                >
                                    {inside}
                                </button>
                            ) : (
                                <Link to={to} className={TILE_CLASS}>
                                    {inside}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ul>
            {emergencyOpen && (
                <div
                    id="emergency-numbers"
                    role="region"
                    aria-label="Call for an ambulance"
                    className="mt-3 max-w-2xl rounded-2xl border-2 border-tiba-blue bg-white p-4 lg:max-w-none"
                >
                    <p className="mb-3 font-semibold text-slate-900">In an emergency, call now.</p>
                    <div className="flex flex-wrap gap-3">
                        {CALLS.map((call, index) => (
                            <a
                                key={call.href}
                                href={call.href}
                                ref={index === 0 ? firstCall : undefined}
                                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-tiba-blue px-5 font-semibold text-white transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
                            >
                                <Phone className="h-5 w-5" aria-hidden="true" />
                                {call.label}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
