
import { MapPin } from "lucide-react";

export const Coverage = () => {
    return (
        <div className="bg-white">
            <div className="bg-slate-900 py-20 text-center text-white">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 font-display">Where We Operate</h1>
                    <p className="text-xl text-blue-300">Serving Nairobi and surrounding counties.</p>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-6 py-20">
                <div className="flex flex-col lg:flex-row gap-16 items-center">
                    <div className="flex-1">
                        <div className="bg-slate-100 rounded-3xl h-[500px] w-full flex items-center justify-center text-slate-400 font-bold text-xl border-2 border-dashed border-slate-300">
                            Map Visualization Placeholder
                        </div>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-3xl font-bold text-slate-900 mb-8">Service Areas</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                "Nairobi County",
                                "Kiambu County",
                                "Kajiado County",
                                "Machakos County",
                                "Nakuru Town",
                                "Mombasa Island"
                            ].map((area, i) => (
                                <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <MapPin className="w-5 h-5 text-blue-600" />
                                    <span className="font-medium text-slate-900">{area}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 p-6 bg-blue-50 rounded-2xl border border-blue-100">
                            <h3 className="font-bold text-blue-900 mb-2">Expanding Soon?</h3>
                            <p className="text-blue-700 mb-4">We are rapidly growing. If your area is not listed, please check back soon or contact us to inquire.</p>
                            <button className="px-6 py-3 bg-blue-900 text-white rounded-xl font-bold hover:bg-blue-800 transition-colors">
                                Check Availability
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
