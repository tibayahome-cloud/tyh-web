
import { Check, Heart, Shield, Clock, Users, Star } from "lucide-react";
import aboutImage from "../../../assets/images/about-story.png";

export const About = () => {
    return (
        <div className="bg-white">
            <div className="bg-slate-900 py-20 text-center text-white">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 font-display">About Tiba Ya Home</h1>
                    <p className="text-xl text-blue-300 font-medium">Divine Care @ Home</p>
                </div>
            </div>

            {/* Mission */}
            <section className="py-20 container mx-auto px-4 md:px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-slate-900 mb-8">Our Mission</h2>
                    <p className="text-2xl font-light leading-relaxed text-slate-700">
                        To deliver safe, professional, compassionate care to patients at home — supported by technology and accountable service delivery.
                    </p>
                </div>
            </section>

            {/* Differentiators */}
            <section className="py-20 bg-slate-50">
                <div className="container mx-auto px-4 md:px-6">
                    <h2 className="text-3xl font-bold text-center text-slate-900 mb-16">What Makes Us Different</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { title: "Licensed & Vetted", desc: "Rigorous verification of every clinician.", icon: Shield },
                            { title: "App-Enabled", desc: "Easy booking and real-time tracking.", icon: Users },
                            { title: "Quality Assurance", desc: "Transparent ratings and reviews.", icon: Star },
                            { title: "Integrated Care", desc: "Ambulance + Home Care ecosystem.", icon: Heart }
                        ].map((item, i) => (
                            <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-shadow">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                                    <item.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                                <p className="text-slate-600">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="py-20 bg-blue-900 text-white">
                <div className="container mx-auto px-4 md:px-6 text-center">
                    <h2 className="text-3xl font-bold mb-12">Our Values</h2>
                    <div className="flex flex-wrap justify-center gap-4 md:gap-8">
                        {["Compassion", "Dignity", "Accountability", "Excellence", "Timely Response"].map((value, i) => (
                            <span key={i} className="px-6 py-3 rounded-full bg-blue-800/50 border border-blue-700 text-lg font-medium backdrop-blur-sm">
                                {value}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Story */}
            <section className="py-20 container mx-auto px-4 md:px-6">
                <div className="flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1">
                        <img
                            src={aboutImage}
                            alt="Caring for patient"
                            className="rounded-3xl shadow-2xl"
                        />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Story</h2>
                        <p className="text-lg text-slate-600 leading-relaxed mb-8">
                            Tiba Ya Home was built to solve the real Kenyan challenge: families needing reliable care at home with clear coordination, speed, and trust. We believe that healing happens best where you are most comfortable — at home.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button className="px-6 py-3 bg-blue-900 text-white rounded-xl font-bold hover:bg-blue-800 transition-colors">
                                Book Home Care
                            </button>
                            <button className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-900 rounded-xl font-bold hover:bg-slate-50 transition-colors">
                                Request Ambulance
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
