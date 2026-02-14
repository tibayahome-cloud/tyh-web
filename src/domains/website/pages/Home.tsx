
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowRight,
    ShieldCheck,
    Clock,
    Star,
    CheckCircle2,
    HeartPulse,
    Phone,
    ChevronRight,
    Siren,
    Smartphone,
    Check,
    Zap,
    Shield
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useServices } from "../../../shared/hooks/useServices";
import { useAuth } from "../../../shared/hooks/useAuth";

// Assets
import heroImage from "../../../assets/images/hero-home.png";
import appMockup from "../../../assets/images/app-showcase.png";
import ambulanceImage from "../../../assets/images/service-ambulance.png";
import doctorImage from "../../../assets/images/service-doctor.png";
import nursingImage from "../../../assets/images/nursing.png";
import therapyImage from "../../../assets/images/service-therapy.png";
import elderlyImage from "../../../assets/images/service-elderly.png";
import diagnosticsImage from "../../../assets/images/service-nurse.png";

const SectionHeader = ({ title, subtitle, centered = true }: { title: string; subtitle?: string; centered?: boolean }) => (
    <div className={`mb-12 ${centered ? "text-center" : "text-left"}`}>
        <h2 className="mb-4">{title}</h2>
        {subtitle && <p className="text-slate-600 max-w-2xl mx-auto">{subtitle}</p>}
    </div>
);

export const Home = () => {
    const { data: services, isLoading } = useServices({ active: true });
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [showAppTooltip, setShowAppTooltip] = useState(false);

    const handleServiceClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (isAuthenticated) {
            navigate("/client");
        } else {
            navigate("/login");
        }
    };

    const packages = [
        { name: "Tiba Basic", price: "KES 5,000", color: "blue" },
        { name: "Tiba Family", price: "KES 15,000", color: "gold" },
        { name: "Recover at Home", price: "KES 45,000", color: "gold" },
        { name: "Senior Comfort", price: "KES 60,000", color: "blue" },
        { name: "Premium Palliative", price: "KES 120,000", color: "gold" },
    ];

    return (
        <div className="bg-white overflow-hidden">
            {/* Hero Section */}
            <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 bg-slate-50">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                            className="flex-1 max-w-2xl"
                        >
                            <h1 className="leading-tight mb-6">
                                Care That Comes to You
                            </h1>
                            <p className="text-lg md:text-xl text-slate-700 mb-10 leading-relaxed">
                                Professional medical care, nursing, therapy, diagnostics, and <span className="font-bold text-tiba-blue">ambulance services</span> – delivered to your home with dignity, safety, and compassion.
                            </p>

                            <div className="flex flex-wrap gap-4 mb-10">
                                <button
                                    onClick={handleServiceClick}
                                    className="btn-primary"
                                >
                                    Book Home Care
                                </button>
                                <button
                                    onClick={handleServiceClick}
                                    className="btn-secondary"
                                >
                                    Get Ambulance
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                    { icon: ShieldCheck, text: "Licensed Professionals" },
                                    { icon: Zap, text: "Real-Time Tracking" },
                                    { icon: Clock, text: "Transparent Pricing" }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                                        <item.icon className="w-5 h-5 text-tiba-gold" />
                                        <span className="text-sm font-medium text-slate-700">{item.text}</span>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-8 text-tiba-gold font-medium italic">Divine care, wherever you are.</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8 }}
                            className="flex-1 relative"
                        >
                            <img
                                src={heroImage}
                                alt="Care at home"
                                className="w-full h-auto rounded-3xl shadow-2xl relative z-10"
                            />
                            <div className="absolute -bottom-6 -right-6 w-full h-full bg-tiba-gold/10 rounded-3xl -z-10" />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* App Section */}
            <section className="py-24 bg-white border-y border-slate-50">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            className="flex-1 flex justify-center lg:justify-end"
                        >
                            <div className="relative group">
                                <img
                                    src={appMockup}
                                    alt="Tiba App"
                                    className="max-w-[280px] md:max-w-xs h-auto relative z-10 drop-shadow-2xl"
                                />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-tiba-blue/5 rounded-full blur-3xl -z-10" />

                                {/* Tooltip implementation */}
                                <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 z-20 w-48">
                                    <button
                                        onClick={() => {
                                            setShowAppTooltip(true);
                                            setTimeout(() => setShowAppTooltip(false), 3000);
                                        }}
                                        className="w-[180px] h-12 rounded-lg"
                                        aria-label="Download App"
                                    />
                                    <AnimatePresence>
                                        {showAppTooltip && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="absolute -top-12 left-1/2 -translate-x-1/2 bg-tiba-gold text-white px-4 py-2 rounded-lg text-sm font-bold shadow-xl whitespace-nowrap"
                                            >
                                                Coming soon!
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-tiba-gold" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>

                        <div className="flex-1">
                            <div className="mb-4 inline-block px-4 py-1.5 rounded-full bg-tiba-gold/10 text-tiba-gold font-bold text-sm">
                                COMING SOON
                            </div>
                            <h2 className="mb-2">The Tiba Ya Home App</h2>
                            <h3 className="text-slate-800 mb-8">Care at Your Fingertips</h3>

                            <ul className="space-y-4 mb-10">
                                {[
                                    "Book doctor, nurse, therapy, and home care services",
                                    "Request an ambulance instantly",
                                    "Track their arrival in real time",
                                    "Monitor your bookings and visit history",
                                    "View ratings & reviews of care providers"
                                ].map((feature, i) => (
                                    <li key={i} className="flex items-start gap-4">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-tiba-blue/5 flex items-center justify-center mt-1">
                                            <Check className="w-4 h-4 text-tiba-gold" />
                                        </div>
                                        <span className="text-slate-700 font-medium">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={handleServiceClick}
                                className="btn-secondary"
                            >
                                Request an Ambulance
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Our Services */}
            <section className="py-24 bg-slate-50">
                <div className="container mx-auto px-4 md:px-6">
                    <SectionHeader title="Our Services" />

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-8">
                        {[
                            { name: "Doctor & Nurse Home Visits", img: doctorImage },
                            { name: "Nursing & Long-Term Care", img: nursingImage },
                            { name: "Therapy & Rehabilitation", img: therapyImage },
                            { name: "Elderly & Assisted Living Care", img: elderlyImage },
                            { name: "Diagnostics & Monitoring at Home", img: diagnosticsImage }
                        ].map((service, i) => (
                            <button
                                key={i}
                                onClick={handleServiceClick}
                                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-slate-100 text-left"
                            >
                                <div className="aspect-square relative overflow-hidden bg-slate-100">
                                    <img
                                        src={service.img}
                                        alt={service.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-tiba-blue/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="p-4 text-center">
                                    <h3 className="text-sm md:text-base font-bold transition-colors">
                                        {service.name}
                                    </h3>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Ambulance Section */}
            <section className="py-24 bg-tiba-blue relative text-white overflow-hidden">
                {/* Background Decorative patterns */}
                <div className="absolute top-0 right-0 w-1/3 h-full bg-white/5 skew-x-12 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-tiba-gold/10 blur-3xl rounded-full" />

                <div className="container mx-auto px-4 md:px-6 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center gap-16">
                        <div className="flex-1">
                            <h2 className="text-white mb-4">Ambulance & Emergency Services</h2>
                            <p className="text-xl text-blue-100 mb-8 font-medium">Fast, Reliable, and Tracked.</p>

                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 mb-10">
                                {[
                                    "Emergency Response",
                                    "Home Hospital Transfers",
                                    "Hospital Discharges",
                                    "Inter Facility Transfers",
                                    "Basic & Advanced Life Support"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-tiba-gold flex items-center justify-center">
                                            <ChevronRight className="w-3.5 h-3.5 text-tiba-blue" />
                                        </div>
                                        <span className="font-medium text-blue-50">{item}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={handleServiceClick}
                                className="btn-secondary"
                            >
                                Get Ambulance
                            </button>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            className="flex-1"
                        >
                            <img
                                src={ambulanceImage}
                                alt="Ambulance Service"
                                className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                            />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Care Packages */}
            <section className="py-24 bg-slate-50">
                <div className="container mx-auto px-4 md:px-6">
                    <SectionHeader title="Our Flagship Care Packages" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                        {packages.map((pkg, i) => (
                            <button
                                key={i}
                                onClick={handleServiceClick}
                                className={`flex flex-col rounded-2xl overflow-hidden shadow-sm border border-slate-100 transition-transform hover:-translate-y-1 text-left`}
                            >
                                <div className={`p-6 text-center h-24 flex items-center justify-center bg-white`}>
                                    <h3 className="leading-tight">{pkg.name}</h3>
                                </div>
                                <div className={`p-4 text-center ${pkg.color === 'blue' ? 'bg-tiba-blue text-white' : 'bg-tiba-gold text-white'}`}>
                                    <span className="text-sm font-bold uppercase tracking-wider">{pkg.price}</span>
                                    <span className="block text-[10px] opacity-75 mt-0.5">PER VISIT / MONTH</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-16 text-center">
                        <button
                            onClick={handleServiceClick}
                            className="text-tiba-blue font-bold hover:text-tiba-gold flex items-center justify-center gap-2 group mx-auto"
                        >
                            View Detailed Care Packages <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer Branding */}
            <div className="py-12 bg-white text-center border-t border-slate-50">
                <div className="container mx-auto px-4">
                    <p className="text-tiba-blue font-bold text-xl mb-2">Tiba Ya Home</p>
                    <p className="text-tiba-gold font-medium italic">Divine Care @ Home</p>
                </div>
            </div>
        </div>
    );
};
