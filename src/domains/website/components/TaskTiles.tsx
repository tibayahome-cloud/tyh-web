import { Link } from "react-router-dom";
import {
    ChevronRight,
    FlaskConical,
    House,
    MessageCircleHeart,
    Pill,
    ScanLine,
    Siren,
    Stethoscope,
    Video,
    type LucideIcon
} from "lucide-react";
import {
    CLIENT_AMBULANCE_REQUEST_PATH,
    CLIENT_HOME_CARE_PATH,
    PUBLIC_AMBULANCE_REQUEST_PATH,
    PUBLIC_HOME_CARE_BOOKING_PATH,
    telemedicineBookingPath,
    type TelemedicineChoice
} from "../../../shared/utils/returnPath";

export type TaskTile = {
    key: string;
    label: string;
    icon: LucideIcon;
    /** An address inside the app or site. */
    to: string;
    tint: "blue" | "gold";
};

/**
 * The eight things a visitor comes to do. Each tile takes the person to the place where that thing is done, with their
 * choice already made: a care area filtered (video doctor, specialist, mental health) or the one service that matches
 * (lab results, scans, prescriptions: a doctor reviews the report the patient brings). `inApp` is true only on the signed-in
 * client home, where the booking is inside the app; the public landing page always uses the public booking pages.
 * Ambulance opens the request page, which is the home care request with the ambulance services shown and the numbers to
 * call at the top.
 */
export const taskTiles = (inApp: boolean): TaskTile[] => {
    const homeCare = inApp ? CLIENT_HOME_CARE_PATH : PUBLIC_HOME_CARE_BOOKING_PATH;
    const book = (choice: TelemedicineChoice) => telemedicineBookingPath(inApp, choice);
    return [
        { key: "video", label: "Video doctor", icon: Video, to: book({ category: "firstcare" }), tint: "blue" },
        { key: "specialist", label: "Find a specialist", icon: Stethoscope, to: book({ category: "specialistcare" }), tint: "blue" },
        { key: "mental-health", label: "Mental health", icon: MessageCircleHeart, to: book({ category: "mental-health" }), tint: "gold" },
        { key: "lab-results", label: "Lab results review", icon: FlaskConical, to: book({ service: "follow-up-medical-consultation" }), tint: "blue" },
        { key: "scan-results", label: "Scan results review", icon: ScanLine, to: book({ service: "diagnostic-report-review" }), tint: "blue" },
        { key: "prescriptions", label: "Prescription review", icon: Pill, to: book({ service: "medical-advice-referral" }), tint: "blue" },
        { key: "home-care", label: "Home care", icon: House, to: homeCare, tint: "blue" },
        { key: "ambulance", label: "Ambulance", icon: Siren, to: inApp ? CLIENT_AMBULANCE_REQUEST_PATH : PUBLIC_AMBULANCE_REQUEST_PATH, tint: "blue" }
    ];
};

const TILE_CLASS =
    "group relative flex h-full min-h-[96px] flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-tiba-blue/40 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue";

export const TaskTiles = ({ isAuthenticated }: { isAuthenticated: boolean }) => (
    <section aria-labelledby="task-tiles-heading">
        <h2 id="task-tiles-heading" className="mb-3 text-xl font-bold text-tiba-blue sm:text-2xl">
            What can we help you with today?
        </h2>
        <ul className="grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4 lg:max-w-none">
            {taskTiles(isAuthenticated).map(({ key, label, icon: Icon, to, tint }) => (
                <li key={key}>
                    <Link to={to} className={TILE_CLASS}>
                        <span
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                tint === "gold" ? "bg-tiba-gold/20" : "bg-tiba-blue/10"
                            } text-tiba-blue`}
                        >
                            <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="pr-4 text-left text-sm font-semibold leading-snug text-slate-900">{label}</span>
                        <ChevronRight className="absolute right-2.5 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
                    </Link>
                </li>
            ))}
        </ul>
    </section>
);
