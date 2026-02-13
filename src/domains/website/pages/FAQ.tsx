
import { useState } from "react";
import { Plus, Minus } from "lucide-react";

export const FAQ = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const faqs = [
        { q: "How quickly can a doctor arrive?", a: "For standard visits, we aim for arrival within 2 hours. For emergency ambulance response, typical arrival is within 30-45 minutes depending on traffic." },
        { q: "Do you accept insurance?", a: "Yes, we partner with major insurance providers including AAR, Jubilee, Old Mutual, and others. Please contact us to verify your specific cover." },
        { q: "Are your staff qualified?", a: "Absolutely. every clinician (doctor, nurse, physiotherapist) is vetted, licensed by their respective board, and background checked." },
        { q: "Can I book for someone else?", a: "Yes, you can manage profiles for your parents, children, or spouse under your account and book services on their behalf." },
        { q: "What areas do you cover?", a: "Currently servicing Nairobi, Kiambu, Kajiado, and Machakos. We are expanding to other counties soon." }
    ];

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="bg-slate-900 py-20 text-center text-white">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 font-display">Frequently Asked Questions</h1>
                    <p className="text-xl text-blue-300">Answers to common questions about our care.</p>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-6 py-20 max-w-3xl">
                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all">
                            <button
                                className="w-full text-left p-6 flex justify-between items-center text-slate-900 font-bold text-lg hover:bg-slate-50 transition-colors"
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                            >
                                {faq.q}
                                {openIndex === i ? <Minus className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-slate-400" />}
                            </button>
                            {openIndex === i && (
                                <div className="p-6 pt-0 text-slate-600 leading-relaxed border-t border-slate-100">
                                    {faq.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
