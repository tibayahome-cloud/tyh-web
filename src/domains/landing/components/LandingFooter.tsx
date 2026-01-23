import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, Heart } from "lucide-react";

export const LandingFooter = () => {
    const currentYear = new Date().getFullYear();

    const footerLinks = [
        {
            title: "Product",
            links: [
                { name: "Services", href: "#services" },
                { name: "How it Works", href: "#how-it-works" },
                { name: "Reviews", href: "#reviews" },
                { name: "Pricing", href: "#" },
            ],
        },
        {
            title: "Company",
            links: [
                { name: "About Us", href: "#" },
                { name: "Careers", href: "#" },
                { name: "Blog", href: "#" },
                { name: "Contact", href: "#" },
            ],
        },
        {
            title: "Legal",
            links: [
                { name: "Privacy Policy", href: "#" },
                { name: "Terms of Service", href: "#" },
                { name: "Cookie Policy", href: "#" },
            ],
        },
    ];

    return (
        <footer className="bg-slate-900 pt-20 pb-10 text-slate-400">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
                    <div className="col-span-2">
                        <Link to="/" className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 bg-brand-linear rounded-lg flex items-center justify-center text-white font-bold italic">
                                T
                            </div>
                            <span className="text-xl font-display font-bold text-white">
                                Tiba Ya <span className="text-brand-400">Home</span>
                            </span>
                        </Link>
                        <p className="max-w-xs mb-8 text-slate-400 leading-relaxed text-sm">
                            Connecting professional healthcare and home service providers with community members who need quality care at home.
                        </p>
                        <div className="flex items-center gap-4">
                            {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-brand-600 hover:text-white transition-all"
                                >
                                    <Icon className="w-5 h-5" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {footerLinks.map((section) => (
                        <div key={section.title}>
                            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">
                                {section.title}
                            </h4>
                            <ul className="space-y-4">
                                {section.links.map((link) => (
                                    <li key={link.name}>
                                        <a
                                            href={link.href}
                                            className="text-sm hover:text-brand-400 transition-colors"
                                        >
                                            {link.name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
                    <p>© {currentYear} Tiba Ya Home. All rights reserved.</p>
                    <p className="flex items-center gap-1.5">
                        Made with <Heart className="w-4 h-4 text-rose-500 fill-rose-500" /> by Tiba Team
                    </p>
                </div>
            </div>
        </footer>
    );
};
