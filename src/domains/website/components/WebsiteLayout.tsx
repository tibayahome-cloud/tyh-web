
import { Outlet, ScrollRestoration } from "react-router-dom";
import { WebsiteHeader } from "./WebsiteHeader";
import { WebsiteFooter } from "./WebsiteFooter";

export const WebsiteLayout = () => {
    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            <ScrollRestoration />
            <WebsiteHeader />

            <main className="pt-20 min-h-screen">
                <Outlet />
            </main>

            <WebsiteFooter />
        </div>
    );
};
