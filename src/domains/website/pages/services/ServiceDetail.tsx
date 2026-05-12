
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Check, ArrowRight, HelpCircle, Phone, Calendar, Stethoscope, UserCheck } from "lucide-react";

import { COMPANY_PHONE } from "../../../../shared/constants/contact";
import { GuestBookingDialog } from "../../components/GuestBookingDialog";
import doctorImage from "../../../assets/images/service-doctor.png";
import nurseImage from "../../../assets/images/service-nurse.png";
import therapyImage from "../../../assets/images/service-therapy.png";
import elderlyImage from "../../../assets/images/service-elderly.png";
import ambulanceImage from "../../../assets/images/service-ambulance.png";

const serviceData: Record<string, any> = {
    "doctor-visit": {
        title: "Doctor Visit at Home",
        subtitle: "Get professional assessment, diagnosis and treatment without leaving home.",
        heroImage: doctorImage,
        serviceKey: "doctor-visit",
        whoFor: [
            "Fever, infections, pain, chronic illness reviews",
            "Elderly patients and patients with limited mobility",
            "Post-discharge review and follow-ups"
        ],
        includes: [
            "Full consultation & physical examination",
            "Prescription and care plan",
            "Referral if required (lab, scan, facility care)"
        ],
        pricing: "KES 3,500",
        faqs: [
            { q: "How long does a visit take?", a: "Typically 30-45 minutes depending on complexity." },
            { q: "Can the doctor prescribe medication?", a: "Yes, prescriptions are issued digitally or physically." }
        ]
    },
    "nurse-visit": {
        title: "Nurse Visit at Home",
        subtitle: "Safe nursing care delivered with dignity and professionalism.",
        heroImage: nurseImage,
        whoFor: [
            "Patients requiring injections or wound care",
            "Post-surgical recovery monitoring",
            "Chronic disease management support"
        ],
        includes: [
            "Injections & medication administration",
            "Wound dressing & wound monitoring",
            "IV therapy (excluding drugs unless supplied)",
            "Catheter and tube care support"
        ],
        pricing: "KES 1,500",
        faqs: [
            { q: "Do I need to provide supplies?", a: "Basic supplies are included, but specialized medication must be purchased." }
        ]
    },
    "iv-therapy": {
        title: "IV Therapy at Home",
        subtitle: "Professional IV administration in a safe home setting.",
        heroImage: nurseImage,
        whoFor: [
            "Dehydration requiring fluids",
            "Antibiotic therapy regimen",
            "Vitamin drips and wellness infusions"
        ],
        includes: [
            "Cannulation and IV setup",
            "Monitoring during therapy",
            "After-care advice and next steps"
        ],
        pricing: "KES 2,500",
        faqs: []
    },
    "wound-care": {
        title: "Wound Care & Dressing at Home",
        subtitle: "Expert wound dressing, infection control, and healing support.",
        heroImage: nurseImage,
        whoFor: ["Post-surgical wounds", "Bedsores and pressure ulcers", "Diabetic foot ulcers"],
        includes: [
            "Assessment & cleaning",
            "Dressing changes",
            "Infection prevention guidance",
            "Referral for advanced wound care if needed"
        ],
        pricing: "KES 2,000",
        faqs: []
    },
    "catheter-care": {
        title: "Catheter & Tube Care at Home",
        subtitle: "Safe, hygienic, professional catheter and tube management.",
        heroImage: nurseImage,
        whoFor: ["Patients with urinary catheters", "PEG feeding maintenance"],
        includes: [
            "Catheter change / cleaning",
            "Patient & caregiver education",
            "Monitoring for infection and complications"
        ],
        pricing: "KES 2,500"
    },
    "nursing-care": {
        title: "Nursing Care at Home (Day / Night / 24-Hour)",
        subtitle: "Dedicated nursing support for recovery, chronic illness, and dependency.",
        heroImage: elderlyImage,
        whoFor: ["Post-stroke recovery", "Palliative care needs", "Elderly requiring supervision"],
        includes: [
            "Day shift nursing (8 hours)",
            "Night nursing (12 hours)",
            "24-hour nursing",
            "Medication management & vital signs",
            "Hygiene support and basic procedures"
        ],
        pricing: "From KES 3,500 / shift"
    },
    "therapy": {
        title: "Home Physiotherapy & Rehabilitation",
        subtitle: "Regain strength, mobility, and independence with guided therapy at home.",
        heroImage: therapyImage,
        whoFor: ["Stroke recovery", "Post-injury rehabilitation", "Mobility improvement"],
        includes: [
            "Physiotherapy assessment",
            "Occupational therapy",
            "Speech therapy",
            "Home exercises program",
            "Progress tracking"
        ],
        pricing: "KES 3,000"
    },
    "elderly-care": {
        title: "Elderly & Assisted Living Care",
        subtitle: "Support your loved ones with safe daily care and companionship.",
        heroImage: elderlyImage,
        whoFor: ["Seniors living alone", "Dementia / Alzheimer's support", "Fall risk prevention"],
        includes: [
            "Bathing, grooming, feeding support",
            "Mobility and fall risk support",
            "Medication reminders",
            "Companionship visits",
            "Monitoring and family updates"
        ],
        pricing: "From KES 1,500 / visit"
    },
    "diagnostics": {
        title: "Diagnostics & Monitoring at Home",
        subtitle: "Convenient testing and monitoring with reliable reporting.",
        heroImage: doctorImage,
        whoFor: ["Routine checkups", "Chronic disease monitoring", "Immobile patients"],
        includes: [
            "Lab tests (sample collection)",
            "ECG at home",
            "Vital signs monitoring",
            "Results delivery (digital)",
            "Referral to clinician if abnormal"
        ],
        pricing: "Varies by test"
    },
    "equipment": {
        title: "Medical Equipment & Supplies",
        subtitle: "Rent or purchase equipment for safe home care.",
        heroImage: doctorImage,
        whoFor: ["Home recovery", "Mobility assistance", "Oxygen therapy"],
        includes: [
            "Oxygen concentrators",
            "Hospital beds",
            "Wheelchairs and walkers",
            "Delivery and setup",
            "User guidance"
        ],
        pricing: "Contact for Quote"
    }

};

// Fallback for unknown services
const defaultService = {
    title: "Service Not Found",
    subtitle: "The service you are looking for does not exist.",
    heroImage: "",
    whoFor: [],
    includes: [],
    pricing: "-",
    faqs: []
};

export const ServiceDetail = () => {
    const { slug } = useParams();
    const service = serviceData[slug || ""] || defaultService;
    const [showGuestBooking, setShowGuestBooking] = useState(false);

    if (!service.title) return <div>Service not found</div>;

    const serviceKey = slug || "";

    const steps = [
        { title: "Book", desc: "Select service & time." },
        { title: "Confirm", desc: "We match a pro." },
        { title: "Care", desc: "Pro arrives at home." },
        { title: "Recover", desc: "Follow-up & health." }
    ];

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Hero */}
            <section className="relative py-20 bg-slate-900 overflow-hidden">
                <div className="absolute inset-0">
                    <img src={service.heroImage} className="w-full h-full object-cover opacity-20" alt={service.title} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                </div>
                <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 font-display">{service.title}</h1>
                    <p className="text-xl text-blue-200 mb-10 font-medium">{service.subtitle}</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => setShowGuestBooking(true)}
                            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30"
                        >
                            Book Now
                        </button>
                        <Link to="/login" className="px-8 py-4 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all border border-white/20">
                            Sign In to Book
                        </Link>
                    </div>
                </div>
            </section>

            <div className="container mx-auto px-4 md:px-6 py-16">
                <div className="flex flex-col lg:flex-row gap-12">
                    {/* Main Content */}
                    <div className="flex-1 space-y-12">
                        {/* Who it's for */}
                        <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                                <UserCheck className="w-6 h-6 text-blue-600" />
                                Who it's for
                            </h2>
                            <ul className="space-y-4">
                                {service.whoFor?.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3 text-slate-700">
                                        <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-xs font-bold">{i + 1}</span>
                                        </div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* What's included */}
                        <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                                <Check className="w-6 h-6 text-emerald-600" />
                                What's included
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {service.includes?.map((item: string, i: number) => (
                                    <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                        <span className="text-slate-700 font-medium">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* How it works */}
                        <section>
                            <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">How it works</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {steps.map((step, i) => (
                                    <div key={i} className="text-center p-4">
                                        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600 mx-auto mb-3">
                                            {i + 1}
                                        </div>
                                        <h4 className="font-bold text-slate-900">{step.title}</h4>
                                        <p className="text-sm text-slate-500">{step.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* FAQs */}
                        {service.faqs && service.faqs.length > 0 && (
                            <section className="bg-blue-50 p-8 rounded-3xl border border-blue-100">
                                <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                                    <HelpCircle className="w-6 h-6 text-blue-600" />
                                    Common Questions
                                </h2>
                                <div className="space-y-4">
                                    {service.faqs.map((faq: any, i: number) => (
                                        <div key={i} className="bg-white p-6 rounded-2xl shadow-sm">
                                            <h4 className="font-bold text-slate-900 mb-2">{faq.q}</h4>
                                            <p className="text-slate-600">{faq.a}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="lg:w-96 space-y-6">
                        <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 sticky top-24">
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Simple Pricing</h3>
                            <div className="text-3xl font-bold text-blue-600 mb-6">{service.pricing}</div>

                            <div className="space-y-4 mb-8">
                                <div className="flex items-center gap-3 text-slate-600">
                                    <Calendar className="w-5 h-5" />
                                    <span className="text-sm">Available 7 days a week</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-600">
                                    <Stethoscope className="w-5 h-5" />
                                    <span className="text-sm">Licensed professionals</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowGuestBooking(true)}
                                className="block w-full py-4 bg-blue-900 text-white text-center rounded-xl font-bold hover:bg-blue-800 transition-colors mb-2"
                            >
                                Book Now (No Account)
                            </button>
                            <Link to="/login" className="block w-full py-3 bg-slate-100 text-slate-700 text-center rounded-xl font-medium hover:bg-slate-200 transition-colors mb-4">
                                Sign In to Book
                            </Link>

                            <div className="text-center">
                                <p className="text-sm text-slate-500 mb-2">Need help booking?</p>
                                <a href={`tel:${COMPANY_PHONE}`} className="inline-flex items-center gap-2 text-blue-600 font-bold">
                                    <Phone className="w-4 h-4" /> Call Advisor
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <GuestBookingDialog
                open={showGuestBooking}
                onClose={() => setShowGuestBooking(false)}
                serviceKey={serviceKey}
                serviceName={service.title}
            />
        </div>
    );
};
