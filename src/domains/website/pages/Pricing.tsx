
import { useState } from "react";
import { Check, Info } from "lucide-react";

export const Pricing = () => {
    const [activeTab, setActiveTab] = useState("Home Visits");

    const tabs = ["Home Visits", "Nursing", "Therapy", "Diagnostics", "Ambulance"];

    const pricingData: Record<string, any[]> = {
        "Home Visits": [
            { service: "Doctor Home Visit", price: "KES 3,500", included: ["Consultation", "Physical Exam", "Prescription"] },
            { service: "Nurse Home Visit", price: "KES 1,500", included: ["Vitals Check", "Injection / Dressing", "Care Plan"] },
            { service: "Clinical Officer Visit", price: "KES 2,500", included: ["Assessment", "Treatment", "Referral"] }
        ],
        "Nursing": [
            { service: "Day Nurse (12 hrs)", price: "KES 3,500", included: ["Medication Admin", "Feeding", "Hygiene"] },
            { service: "Night Nurse (12 hrs)", price: "KES 4,000", included: ["Overnight Monitoring", "Turning", "Fluids"] },
            { service: "24-Hour Nursing", price: "KES 7,000", included: ["Full Day Care", "2 Shift Handover", "Vitals Log"] }
        ],
        "Therapy": [
            { service: "Physiotherapy Session", price: "KES 3,000", included: ["Assessment", "Manual Therapy", "Exercises"] },
            { service: "Occupational Therapy", price: "KES 3,500", included: ["ADL Training", "Home Modification Advice"] },
            { service: "Speech Therapy", price: "KES 3,500", included: ["Swallowing Assessment", "Communication Drill"] }
        ],
        "Diagnostics": [
            { service: "Malaria Test", price: "KES 1,200", included: ["Sample Collection", "Rapid Result"] },
            { service: "Full Haemogram", price: "KES 1,500", included: ["Lab Analysis", "Digital Report"] },
            { service: "ECG at Home", price: "KES 4,500", included: ["12-Lead ECG", "Cardiologist Report"] }
        ],
        "Ambulance": [
            { service: "Basic Life Support", price: "KES 5,000 + Mileage", included: ["Paramedic", "Oxygen", "First Aid"] },
            { service: "Advanced Life Support", price: "KES 8,500 + Mileage", included: ["Critical Care Nurse", "Defibrillator", "Advanced Meds"] }
        ]
    };

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="bg-slate-900 py-20 text-center text-white">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 font-display">Transparent Pricing</h1>
                    <p className="text-xl text-blue-300">Clear prices with no confusion.</p>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-6 py-16">
                <div className="flex flex-wrap justify-center gap-4 mb-12">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 rounded-full font-bold transition-all ${activeTab === tab
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                                    : "bg-white text-slate-600 hover:bg-slate-100"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden max-w-4xl mx-auto">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="p-6 text-slate-900 font-bold">Service</th>
                                    <th className="p-6 text-slate-900 font-bold hidden sm:table-cell">What's Included</th>
                                    <th className="p-6 text-slate-900 font-bold">Price From</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pricingData[activeTab].map((item, i) => (
                                    <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                                        <td className="p-6 font-medium text-slate-900">{item.service}</td>
                                        <td className="p-6 text-slate-600 hidden sm:table-cell">
                                            <ul className="space-y-1">
                                                {item.included.map((inc: string, j: number) => (
                                                    <li key={j} className="flex items-center gap-2 text-sm">
                                                        <Check className="w-3 h-3 text-emerald-500" /> {inc}
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                        <td className="p-6 font-bold text-blue-600 whitespace-nowrap">{item.price}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto mt-8 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">
                        <strong>Note:</strong> Prices vary by distance, time (day/night), and clinical complexity. Final cost is confirmed before service dispatch. Mileage charges apply for ambulance services outside base radius.
                    </p>
                </div>
            </div>
        </div>
    );
};
