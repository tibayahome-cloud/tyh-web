
import { Check, Building2, Users, HeartPulse, PieChart } from "lucide-react";

export const Corporate = () => {
    return (
        <div className="bg-white">
            <div className="bg-slate-900 py-20 text-center text-white">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 font-display">Corporate Partnerships</h1>
                    <p className="text-xl text-blue-300">Affordable home care and emergency support for your team.</p>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-6 py-20">
                <div className="max-w-4xl mx-auto mb-16">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                        {[
                            { title: "Reduced Absenteeism", icon: Building2 },
                            { title: "Better Health Outcomes", icon: HeartPulse },
                            { title: "Transparent Reporting", icon: PieChart }
                        ].map((item, i) => (
                            <div key={i} className="p-6 bg-slate-50 rounded-2xl">
                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <item.icon className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-slate-900">{item.title}</h3>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-6">Partnership Models</h2>
                        <div className="space-y-6">
                            {[
                                { title: "Pay-per-Service", desc: "Company pays only when employees use the service." },
                                { title: "Monthly Retainer", desc: "Fixed monthly fee for unlimited consultation access." },
                                { title: "Staff Homecare Bundles", desc: "Subsidized home visits and nursing care." },
                                { title: "Chronic Care Programs", desc: "Targeted support for employees with long-term conditions." }
                            ].map((model, i) => (
                                <div key={i} className="flex gap-4 p-6 bg-white border border-slate-100 shadow-sm rounded-xl">
                                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                        <Check className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">{model.title}</h3>
                                        <p className="text-slate-600 text-sm">{model.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-900 text-white p-10 rounded-3xl text-center">
                        <h2 className="text-2xl font-bold mb-4">Ready to support your team?</h2>
                        <p className="text-slate-400 mb-8">
                            Join leading companies trusting Tiba Ya Home for their employee wellness and emergency response needs.
                        </p>
                        <form className="space-y-4">
                            <input type="text" placeholder="Company Name" className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 outline-none" />
                            <input type="email" placeholder="Work Email" className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 outline-none" />
                            <input type="tel" placeholder="Phone Number" className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 outline-none" />
                            <button type="button" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors">
                                Request Proposal
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
