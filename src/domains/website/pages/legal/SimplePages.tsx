
export const Careers = () => (
    <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Careers at Tiba Ya Home</h1>
        <p className="text-xl text-slate-600">Join our team of dedicated professionals. <br />Email your CV to careers@tibahome.com</p>
    </div>
);

export const Blog = () => (
    <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Health Blog</h1>
        <p className="text-xl text-slate-600">Latest news and health tips coming soon.</p>
    </div>
);

export const Stories = () => (
    <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Patient Stories</h1>
        <p className="text-xl text-slate-600">Read how we've helped families recover at home.</p>
    </div>
);

const LegalDocumentPage = ({ type }: { type: "terms" | "privacy" }) => {
    const document = CURRENT_LEGAL_DOCUMENTS.find((item) => item.type === type);
    if (!document) {
        return null;
    }

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="space-y-6">
                <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-tiba-blue">Legal</p>
                    <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">{document.title}</h1>
                    <p className="mt-2 text-slate-600">
                        {document.version} effective {document.effectiveDate}
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <FileText className="mt-1 h-6 w-6 shrink-0 text-tiba-blue" />
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Approved PDF document</h2>
                                <p className="mt-1 text-sm text-slate-600">
                                    This PDF is the authoritative version currently used by Tiba Ya Home.
                                </p>
                            </div>
                        </div>
                        <a
                            href={document.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-tiba-blue px-5 py-3 text-sm font-bold text-white hover:bg-blue-800"
                        >
                            Open PDF
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
};

export const Privacy = () => <LegalDocumentPage type="privacy" />;

export const Terms = () => <LegalDocumentPage type="terms" />;
import { ExternalLink, FileText } from "lucide-react";

import { CURRENT_LEGAL_DOCUMENTS } from "../../../../shared/constants/legal";
