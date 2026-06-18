
import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, MapPin, Phone, Mail, ArrowRight } from "lucide-react";
import logo from "../../../assets/images/logo.jpeg";
import { COMPANY_PHONE, COMPANY_PHONE_DISPLAY } from "../../../shared/constants/contact";

export const WebsiteFooter = () => {
    return (
        <footer className="bg-slate-900 text-slate-300 py-16">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Column 1: Brand */}
                    <div>
                        <Link to="/" className="flex items-center gap-2 mb-6">
                            <img src={logo} alt="Tiba Ya Home" className="h-16 w-auto object-contain bg-white rounded-lg p-1" />
                        </Link>
                        <p className="text-slate-400 leading-relaxed mb-6">
                            Professional medical and home care services delivered with compassion, dignity, and accountability.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-tiba-gold transition-colors text-white">
                                <Facebook className="w-5 h-5" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-tiba-gold transition-colors text-white">
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-tiba-gold transition-colors text-white">
                                <Instagram className="w-5 h-5" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-tiba-gold transition-colors text-white">
                                <Linkedin className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    {/* Column 2: Quick Links */}
                    <div>
                        <h4 className="text-white font-bold text-lg mb-6">Quick Links</h4>
                        <ul className="space-y-4">
                            <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-tiba-gold transition-colors">Home</button></li>
                            <li><Link to="/privacy" className="hover:text-tiba-gold transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="hover:text-tiba-gold transition-colors">Terms of Service</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-lg mb-6">Contact Us</h4>
                        <ul className="space-y-6">
                            <li className="flex items-start gap-4">
                                <MapPin className="w-6 h-6 text-tiba-gold flex-shrink-0 mt-1" />
                                <span>Nairobi, Kenya<br /><span className="text-slate-500 text-sm">Marcus Garvey Road, Kilimani</span></span>
                            </li>
                            <li className="flex items-center gap-4">
                                <Phone className="w-6 h-6 text-tiba-gold flex-shrink-0" />
                                <a href={`tel:${COMPANY_PHONE}`} className="hover:text-tiba-gold">{COMPANY_PHONE_DISPLAY}</a>
                            </li>
                            <li className="flex items-center gap-4">
                                <Mail className="w-6 h-6 text-tiba-gold flex-shrink-0" />
                                <a href="mailto:care@tibahome.com" className="hover:text-tiba-gold">care@tibahome.com</a>
                            </li>
                        </ul>

                        <div className="mt-8 p-4 bg-slate-800 rounded-xl relative overflow-hidden group">
                            <div className="relative z-10">
                                <h5 className="text-white font-bold mb-1">Download App</h5>
                                <p className="text-sm text-slate-400">Book faster on the go.</p>
                                <a
                                    href="https://median.co/share/eekzzbo#apk"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-tiba-gold text-sm font-bold mt-3 group-hover:gap-3 transition-all"
                                >
                                    Get App <ArrowRight className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-800 mt-16 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-slate-500 text-sm">&copy; {new Date().getFullYear()} Tiba Ya Home. All rights reserved.</p>
                    <div className="flex gap-8 text-sm text-slate-500">
                        <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};
