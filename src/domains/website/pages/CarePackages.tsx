
import { Check, Star } from "lucide-react";

export const CarePackages = () => {
    const packages = [
        {
            name: "Post-Surgical Recovery",
            bestFor: "After hospital discharge",
            price: "KES 5,000 / day",
            includes: ["Daily nurse visit (2 hours)", "Wound care & dressing", "Vital signs monitoring", "Doctor review (weekly)"]
        },
        {
            name: "Elderly Companion",
            bestFor: "Seniors needing support",
            price: "KES 35,000 / month",
            includes: ["Daily check-in (30 mins)", "Medication management", "Weekly health report", "Emergency response standby"]
        },
        {
            name: "Chronic Care Plus",
            bestFor: "Diabetes / Hypertension",
            price: "KES 15,000 / month",
            includes: ["Weekly nurse visit", "Monthly doctor review", "Unlimited tele-consults", "Medication delivery"]
        },
        {
            name: "Palliative Comfort",
            bestFor: "End-of-life care",
            price: "KES 6,000 / shift",
            includes: ["12-hour nursing support", "Pain management", "Family counseling", "24/7 doctor on call"]
        },
        {
            name: "Mother & Baby",
            bestFor: "New moms",
            price: "KES 20,000 / week",
            includes: ["Daily midwife visit", "Lactation support", "Baby wellness check", "Post-natal care"]
        }
    ];

    return (
        <div className="bg-slate-50 min-h-screen pb-24">
            <div className="bg-slate-900 py-20 text-center text-white mb-16">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 font-display">Care Packages</h1>
                    <p className="text-xl text-blue-300">Choose a plan that gives your family peace of mind.</p>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {packages.map((pkg, i) => (
                        <div key={i} className="bg-white rounded-3xl p-8 border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col">
                            <div className="mb-6">
                                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider">
                                    {pkg.bestFor}
                                </span>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">{pkg.name}</h3>
                            <div className="text-lg font-bold text-slate-500 mb-6">{pkg.price}</div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {pkg.includes.map((item, j) => (
                                    <li key={j} className="flex items-start gap-3 text-slate-600">
                                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>

                            <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
                                Choose Plan
                            </button>
                        </div>
                    ))}

                    {/* Add-ons Card */}
                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-3xl p-8 shadow-xl flex flex-col justify-center text-center">
                        <Star className="w-12 h-12 text-yellow-400 mx-auto mb-6" />
                        <h3 className="text-2xl font-bold mb-4">Customize Your Care</h3>
                        <p className="text-blue-100 mb-8">Add services to any package for complete coverage.</p>
                        <ul className="text-left space-y-3 mb-8 mx-auto inline-block">
                            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-400" /> Home Lab Tests</li>
                            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-400" /> Extra Caregiver Hours</li>
                            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-400" /> Ambulance Standby</li>
                        </ul>
                        <button className="w-full py-4 bg-white text-blue-900 rounded-xl font-bold hover:bg-blue-50 transition-colors">
                            Talk to Advisor
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
