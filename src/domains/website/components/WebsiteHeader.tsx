
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Phone, ChevronDown } from "lucide-react";
import classNames from "classnames";
import logo from "../../../assets/images/logo.jpeg";
import { COMPANY_PHONE, COMPANY_PHONE_DISPLAY } from "../../../shared/constants/contact";
import { PUBLIC_TELEMEDICINE_BOOKING_PATH } from "../../../shared/utils/returnPath";

export const WebsiteHeader = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();
    // On the booking page the page is the booking: no "Book Now" (it goes to sign-in, away from a booking in progress), no
    // menu with nothing else in it, and a slimmer bar so the first choice is not pushed down the screen.
    const onBookingPage = location.pathname === PUBLIC_TELEMEDICINE_BOOKING_PATH;

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const isActive = (path: string) => {
        if (path === "/" && location.pathname !== "/") return false;
        return location.pathname.startsWith(path);
    };

    return (
        <header
            className={classNames(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                onBookingPage
                    ? "bg-white shadow-sm py-2"
                    : isScrolled
                      ? "bg-white shadow-md py-3"
                      : "bg-transparent py-5"
            )}
        >
            <div className="container mx-auto px-4 md:px-6">
                <div className={classNames("flex items-center justify-between", onBookingPage ? "h-14" : "h-20")}>
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <img
                            src={logo}
                            alt="Tiba Ya Home"
                            className={classNames("w-auto object-contain", onBookingPage ? "h-10 md:h-12" : "h-16")}
                        />
                    </Link>

                    {/* CTA Buttons */}
                    <div className="hidden lg:flex items-center gap-4">
                        <a
                            href={`tel:${COMPANY_PHONE}`}
                            className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-medium text-sm"
                        >
                            <Phone className="w-4 h-4" />
                            <span>{COMPANY_PHONE_DISPLAY}</span>
                        </a>
                        {!onBookingPage && (
                            <Link
                                to="/login"
                                className="px-5 py-2.5 rounded-full bg-tiba-blue text-white font-medium text-sm hover:opacity-90 transition-colors shadow-lg shadow-tiba-blue/20"
                            >
                                Book Now
                            </Link>
                        )}
                    </div>

                    {onBookingPage ? (
                        // Someone worried about a symptom can ring instead; the number is already on the desktop bar.
                        <a
                            href={`tel:${COMPANY_PHONE}`}
                            aria-label={`Call ${COMPANY_PHONE_DISPLAY}`}
                            className="lg:hidden flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
                        >
                            <Phone className="w-5 h-5" aria-hidden="true" />
                        </a>
                    ) : (
                        /* Mobile Menu Button */
                        <button
                            className="lg:hidden p-2 text-slate-900"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && !onBookingPage && (
                <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-t border-slate-100 shadow-xl p-4 flex flex-col gap-4">
                    <Link
                        to="/login"
                        className="px-4 py-3 rounded-xl bg-tiba-blue text-white font-medium text-center"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        Book Now
                    </Link>
                </div>
            )}
        </header>
    );
};
