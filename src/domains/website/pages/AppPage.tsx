
import { Smartphone, Shield, Star, Clock, MapPin, History } from "lucide-react";
import appImage from "../../../assets/images/app-showcase.png";

export const AppPage = () => {
    return (
        <div className="bg-white">
            <div className="bg-slate-900 py-20 text-center text-white">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 font-display">The Tiba Ya Home App</h1>
                    <p className="text-xl text-blue-300">Book, track, and manage care in one place.</p>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-6 py-20">
                <div className="flex flex-col lg:flex-row gap-16 items-center">
                    <div className="flex-1 order-2 lg:order-1">
                        <div className="space-y-12">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-900 mb-6">Healthcare in Your Pocket</h2>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    Manage your family's health with ease. Our app puts professional home care and emergency services at your fingertips.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                {[
                                    { title: "Instant Booking", desc: "Book doctors & nurses in seconds.", icon: Smartphone },
                                    { title: "Live Tracking", desc: "See your provider's location in real-time.", icon: MapPin },
                                    { title: "Service History", desc: "Access past records and invoices.", icon: History },
                                    { title: "Verified Reviews", desc: "Rate providers to ensure quality.", icon: Star }
                                ].map((feature, i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            <feature.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900">{feature.title}</h3>
                                            <p className="text-slate-600 text-sm">{feature.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-8">
                                <button className="px-8 py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-colors">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Play Store" className="h-8" />
                                    Google Play
                                </button>
                                <button className="px-8 py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-colors">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" className="h-8" />
                                    App Store
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 order-1 lg:order-2 flex justify-center">
                        <div className="relative w-72 h-[580px] bg-slate-900 rounded-[3rem] border-8 border-slate-900 shadow-2xl overflow-hidden">
                            <div className="absolute top-0 w-full h-8 bg-slate-800 rounded-b-xl z-20"></div>
                            <img
                                src={appImage}
                                alt="App Screenshot"
                                className="w-full h-full object-cover opacity-80"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-white font-bold text-2xl">App Screenshot</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 py-16 text-center">
                <div className="container mx-auto px-4">
                    <h2 className="text-2xl font-bold text-blue-900 mb-4">Questions?</h2>
                    <button className="px-8 py-4 bg-blue-900 text-white rounded-xl font-bold hover:bg-blue-800 transition-colors">
                        Talk to a Care Advisor
                    </button>
                </div>
            </div>
        </div>
    );
};
