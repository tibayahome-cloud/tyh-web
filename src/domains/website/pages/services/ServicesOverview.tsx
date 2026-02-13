
import { Link } from "react-router-dom";
import { ArrowRight, Stethoscope, Activity, HeartPulse, UserPlus, FileHeart, TestTube2, Archive, Siren, UserCheck } from "lucide-react";

export const ServicesOverview = () => {
    const services = [
        { name: "Doctor Home Visit", icon: Stethoscope, link: "/services/doctor-visit", color: "text-blue-600", bg: "bg-blue-50" },
        { name: "Nurse Home Visit", icon: Activity, link: "/services/nurse-visit", color: "text-emerald-600", bg: "bg-emerald-50" },
        { name: "Nursing & Long-Term Care", icon: UserPlus, link: "/services/nursing-care", color: "text-purple-600", bg: "bg-purple-50" },
        { name: "Therapy & Rehabilitation", icon: HeartPulse, link: "/services/therapy", color: "text-rose-600", bg: "bg-rose-50" },
        { name: "Elderly & Assisted Living", icon: UserCheck, link: "/services/elderly-care", color: "text-amber-600", bg: "bg-amber-50" },
        { name: "Diagnostics at Home", icon: TestTube2, link: "/services/diagnostics", color: "text-cyan-600", bg: "bg-cyan-50" },
        { name: "Medical Equipment", icon: Archive, link: "/services/equipment", color: "text-indigo-600", bg: "bg-indigo-50" },
        { name: "Ambulance & Emergency", icon: Siren, link: "/ambulance", color: "text-red-600", bg: "bg-red-50" },
        { name: "Palliative & Chronic Support", icon: FileHeart, link: "/services/palliative-care", color: "text-teal-600", bg: "bg-teal-50" },
    ];

    return (
        <div className="bg-slate-50 pb-24">
            <div className="bg-slate-900 py-20 text-center text-white mb-16">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 font-display">Our Services</h1>
                    <p className="text-xl text-blue-300 max-w-2xl mx-auto">
                        From medical visits to nursing care, therapy, diagnostics, and emergency support — we deliver care where you need it most.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service, i) => (
                        <Link
                            key={i}
                            to={service.link}
                            className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all group"
                        >
                            <div className={`w-16 h-16 ${service.bg} ${service.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                <service.icon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{service.name}</h3>
                            <div className="flex items-center text-slate-500 text-sm font-medium mt-4 group-hover:text-blue-600">
                                Learn More <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="mt-20 text-center">
                    <div className="inline-block p-8 bg-blue-100 rounded-3xl">
                        <h3 className="text-2xl font-bold text-blue-900 mb-2">Not sure what to choose?</h3>
                        <p className="text-blue-700 mb-6">Talk to a Care Advisor for guidance.</p>
                        <Link to="/contact" className="px-8 py-4 bg-blue-900 text-white rounded-xl font-bold hover:bg-blue-800 transition-colors">
                            Contact Support
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
