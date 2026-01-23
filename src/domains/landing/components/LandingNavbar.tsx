import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight } from "lucide-react";

export const LandingNavbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { name: "Services", href: "#services" },
        { name: "How it Works", href: "#how-it-works" },
        { name: "Why Us", href: "#why-us" },
        { name: "Reviews", href: "#reviews" },
    ];

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
                    ? "py-3 bg-white/80 backdrop-blur-lg shadow-sm border-b border-slate-200"
                    : "py-5 bg-transparent"
                }`}
        >
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-10 h-10 bg-brand-linear rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
                            <span className="text-xl font-bold italic tracking-tighter">T</span>
                        </div>
                        <span className="text-xl font-display font-bold text-slate-900 tracking-tight">
                            Tiba Ya <span className="text-brand-600">Home</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        <div className="flex items-center gap-6">
                            {navLinks.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.href}
                                    className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
                                >
                                    {link.name}
                                </a>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate("/login")}
                                className="px-5 py-2 text-sm font-semibold text-slate-700 hover:text-brand-600 transition-colors"
                            >
                                Log in
                            </button>
                            <button
                                onClick={() => navigate("/signup")}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 rounded-pill hover:bg-slate-800 shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
                            >
                                Get Started
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden p-2 text-slate-600 hover:text-brand-600 transition-colors"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
                    >
                        <div className="p-4 flex flex-col gap-4">
                            {navLinks.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.href}
                                    className="text-base font-medium text-slate-600 px-2 py-1"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {link.name}
                                </a>
                            ))}
                            <div className="h-px bg-slate-100 my-2" />
                            <button
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    navigate("/login");
                                }}
                                className="w-full py-3 text-center font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                            >
                                Log in
                            </button>
                            <button
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    navigate("/signup");
                                }}
                                className="w-full py-3 text-center font-bold text-white bg-slate-900 rounded-xl shadow-md transition-all active:scale-95"
                            >
                                Get Started
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};
