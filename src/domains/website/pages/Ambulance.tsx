
import { Siren, Map, Clock, Bell, Phone } from "lucide-react";
import ambulanceImage from "../../../assets/images/service-ambulance.png";

export const Ambulance = () => {
    return (
        <div className="bg-white">
            <div className="bg-red-600 py-20 text-center text-white">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 font-display">Ambulance & Emergency</h1>
                    <p className="text-xl text-red-100">Fast. Reliable. Tracked.</p>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-6 py-20">
                <div className="flex flex-col lg:flex-row gap-16 items-center">
                    <div className="flex-1">
                        <img
                            src={ambulanceImage}
                            alt="Ambulance"
                            className="rounded-3xl shadow-2xl"
                        />
                    </div>
                    <div className="flex-1 space-y-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-6">Integrated Dispatch</h2>
                            <p className="text-lg text-slate-600 leading-relaxed">
                                Our ambulance service is fully integrated with the Tiba Ya Home app. Request help instantly, track your ambulance in real-time, and get estimated arrival times.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[
                                { title: "Emergency Response", icon: Siren },
                                { title: "Hospital Transfers", icon: Map },
                                { title: "Hospital Discharge", icon: Clock },
                                { title: "Inter-Facility Transfer", icon: Phone }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                                        <item.icon className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-slate-900">{item.title}</span>
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-900 text-white p-8 rounded-3xl">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Bell className="w-5 h-5 text-yellow-400" />
                                App Features
                            </h3>
                            <ul className="space-y-3 mb-8">
                                <li className="flex items-center gap-3 text-slate-300">
                                    <div className="w-2 h-2 rounded-full bg-green-400" /> Request instantly
                                </li>
                                <li className="flex items-center gap-3 text-slate-300">
                                    <div className="w-2 h-2 rounded-full bg-green-400" /> Live tracking on map
                                </li>
                                <li className="flex items-center gap-3 text-slate-300">
                                    <div className="w-2 h-2 rounded-full bg-green-400" /> Family notifications
                                </li>
                            </ul>
                            <button className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-600/30 animate-pulse">
                                Request Ambulance Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
