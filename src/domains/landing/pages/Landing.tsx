import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Users,
    ShieldCheck,
    Clock,
    Star,
    ArrowRight,
    Activity,
    Stethoscope,
    HeartPulse,
    Baby,
    Brain
} from "lucide-react";
import { LandingNavbar } from "../components/LandingNavbar";
import { LandingFooter } from "../components/LandingFooter";
import heroImg from "../../../assets/images/hero.png";
import nursingImg from "../../../assets/images/nursing.png";

const Landing = () => {
    const navigate = useNavigate();

    const fadeInUp = {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.6 }
    };

    const stagger = {
        initial: { opacity: 0 },
        whileInView: { opacity: 1 },
        viewport: { once: true },
        transition: { staggerChildren: 0.2 }
    };

    const services = [
        { name: "Primary Care", icon: Stethoscope, color: "bg-blue-50 text-blue-600" },
        { name: "Nursing Care", icon: Activity, color: "bg-emerald-50 text-emerald-600" },
        { name: "Physical Therapy", icon: HeartPulse, color: "bg-rose-50 text-rose-600" },
        { name: "Pediatric Care", icon: Baby, color: "bg-amber-50 text-amber-600" },
        { name: "Mental Health", icon: Brain, color: "bg-purple-50 text-purple-600" },
        { name: "Geriatric Support", icon: Users, color: "bg-indigo-50 text-indigo-600" },
    ];

    const steps = [
        {
            title: "Tell us what you need",
            desc: "Select a service and provide details about your requirements.",
            icon: Users
        },
        {
            title: "Get Matched",
            desc: "We connect you with certified professionals near you instantly.",
            icon: ShieldCheck
        },
        {
            title: "Receive Care at Home",
            desc: "Our provider comes to you, ensuring comfort and privacy.",
            icon: Clock
        }
    ];

    return (
        <div className="bg-white selection:bg-brand-100 selection:text-brand-900">
            <LandingNavbar />

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
                {/* Background elements */}
                <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[600px] h-[600px] bg-brand-50 rounded-full blur-3xl opacity-50 z-0" />
                <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[400px] h-[400px] bg-accent-50 rounded-full blur-3xl opacity-50 z-0" />

                <div className="container mx-auto px-4 md:px-6 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                        <motion.div
                            className="flex-1 text-center lg:text-left"
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-sm font-bold mb-6">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-600"></span>
                                </span>
                                Trusted by 10,000+ Families
                            </div>
                            <h1 className="text-5xl md:text-7xl font-display font-bold text-slate-900 leading-[1.1] mb-6">
                                Healthcare that <br />
                                <span className="text-brand-600">comes to you.</span>
                            </h1>
                            <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                                Experience professional medical and home care services in the comfort of your own home. Reliable, certified, and compassionate care whenever you need it.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                                <button
                                    onClick={() => navigate("/signup")}
                                    className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
                                >
                                    Book a Provider
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => {
                                        const el = document.getElementById("services");
                                        el?.scrollIntoView({ behavior: "smooth" });
                                    }}
                                    className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border-2 border-slate-100 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all"
                                >
                                    Explore Services
                                </button>
                            </div>

                            <div className="mt-12 flex items-center justify-center lg:justify-start gap-8">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center overflow-hidden">
                                            <img src={`https://i.pravatar.cc/100?u=${i}`} alt="User" />
                                        </div>
                                    ))}
                                    <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">
                                        +2k
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-amber-500 mb-0.5">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <Star key={i} className="w-4 h-4 fill-current" />
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">4.9/5 Average Rating</p>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="flex-1 relative"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                        >
                            <div className="relative z-10 w-full aspect-square md:aspect-[4/3] rounded-[40px] overflow-hidden shadow-2xl">
                                <img
                                    src={heroImg}
                                    alt="Healthcare at home"
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            {/* Floating Cards */}
                            <motion.div
                                className="absolute -bottom-6 -left-6 md:-left-12 bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/50 z-20 hidden sm:block"
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                                        <ShieldCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 leading-tight">Certified Care</h4>
                                        <p className="text-sm text-slate-500">100% Verified Providers</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                className="absolute -top-6 -right-6 bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/50 z-20 hidden sm:block"
                                animate={{ y: [0, 10, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-brand-100 rounded-2xl flex items-center justify-center text-brand-600">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 leading-tight">Fast Response</h4>
                                        <p className="text-sm text-slate-500">Care within 30 mins</p>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Services Section */}
            <section id="services" className="py-24 bg-slate-50">
                <div className="container mx-auto px-4 md:px-6">
                    <motion.div
                        className="text-center max-w-3xl mx-auto mb-16"
                        {...fadeInUp}
                    >
                        <h2 className="text-sm font-bold text-brand-600 uppercase tracking-widest mb-4">Our Services</h2>
                        <h3 className="text-3xl md:text-5xl font-display font-bold text-slate-900 mb-6">Comprehensive care for every stage of life.</h3>
                        <p className="text-slate-600 text-lg">From routine checkups to specialized nursing, our professional network covers all your home healthcare needs.</p>
                    </motion.div>

                    <motion.div
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6"
                        variants={stagger}
                        initial="initial"
                        whileInView="whileInView"
                        viewport={{ once: true }}
                    >
                        {services.map((service) => (
                            <motion.div
                                key={service.name}
                                className="group p-6 rounded-3xl bg-white border border-slate-100 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-500/5 transition-all cursor-pointer flex flex-col items-center text-center"
                                variants={{
                                    initial: { opacity: 0, y: 20 },
                                    whileInView: { opacity: 1, y: 0 }
                                }}
                            >
                                <div className={`w-14 h-14 ${service.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <service.icon className="w-7 h-7" />
                                </div>
                                <h4 className="font-bold text-slate-900 text-sm md:text-base leading-tight">
                                    {service.name}
                                </h4>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="py-24 overflow-hidden">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
                        <motion.div
                            className="flex-1 order-2 lg:order-1"
                            {...fadeInUp}
                        >
                            <h2 className="text-3xl md:text-5xl font-display font-bold text-slate-900 mb-8">How it works?</h2>
                            <div className="space-y-10">
                                {steps.map((step, idx) => (
                                    <div key={idx} className="flex gap-6">
                                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h4>
                                            <p className="text-slate-600 leading-relaxed font-medium">{step.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => navigate("/signup")}
                                className="mt-12 px-8 py-4 bg-brand-linear text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl shadow-brand-500/20"
                            >
                                Get Started Now
                            </button>
                        </motion.div>

                        <motion.div
                            className="flex-1 order-1 lg:order-2"
                            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <div className="relative p-4 md:p-8 bg-brand-50 rounded-[60px] transform hover:rotate-2 transition-transform duration-500">
                                <img
                                    src={nursingImg}
                                    alt="Nursing service"
                                    className="rounded-[40px] shadow-2xl grayscale-[0.2] hover:grayscale-0 transition-all duration-500"
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-4">
                <div className="container mx-auto max-w-6xl">
                    <motion.div
                        className="rounded-[48px] bg-slate-900 px-8 py-16 md:py-24 text-center relative overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                    >
                        {/* Animated background blobs */}
                        <div className="absolute top-0 left-0 w-64 h-64 bg-brand-600/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
                        <div className="absolute bottom-0 right-0 w-80 h-80 bg-accent-600/10 rounded-full blur-[120px] translate-x-1/3 translate-y-1/3" />

                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-6xl font-display font-bold text-white mb-8">
                                Ready to experience <br />
                                <span className="text-brand-400 italic">better care?</span>
                            </h2>
                            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-12">
                                Join thousands of families who trust Tiba Ya Home for their healthcare needs. Sign up today and find your perfect care provider.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button
                                    onClick={() => navigate("/signup")}
                                    className="w-full sm:w-auto px-10 py-5 bg-white text-slate-900 rounded-2xl font-bold text-xl hover:bg-slate-100 transition-all shadow-2xl"
                                >
                                    Sign Up Free
                                </button>
                                <button
                                    onClick={() => navigate("/login")}
                                    className="w-full sm:w-auto px-10 py-5 bg-slate-800 text-white rounded-2xl font-bold text-xl hover:bg-slate-700 transition-all"
                                >
                                    Sign In
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default Landing;
