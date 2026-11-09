
import { Navigate, RouteObject } from "react-router-dom";
import { useAuth } from "../../shared/hooks/useAuth";
import { areaForRoles } from "../../shared/utils/portalMemory";
import { WebsiteLayout } from "./components/WebsiteLayout";
import { isNativePlatform } from "../../shared/libs/capacitor";
import { lazyWithRetry } from "../../shared/utils/lazyWithRetry";

// Lazy load pages
const Home = lazyWithRetry(() => import("./pages/Home").then((module) => ({ default: module.Home })));
// Legal & Extra
const Privacy = lazyWithRetry(() => import("./pages/legal/SimplePages").then((module) => ({ default: module.Privacy })));
const Terms = lazyWithRetry(() => import("./pages/legal/SimplePages").then((module) => ({ default: module.Terms })));

// In the Android app the website's front page is never shown: a client who is already signed in lands on Home, a provider on
// theirs, and everyone else (including administrators, who sign in elsewhere) on the sign-in page. It used to send everyone
// to the sign-in page, which bounced signed-in clients on to Home a moment later.
export const NativeRedirect = () => {
    const { isAuthenticated, roles } = useAuth();
    if (isNativePlatform()) {
        const area = isAuthenticated ? areaForRoles(roles) : null;
        const target = area === "client" ? "/app/home" : area === "provider" ? "/pro/home" : "/login";
        return <Navigate to={target} replace />;
    }
    return <Home />;
};

export const websiteRoutes: RouteObject[] = [
    {
        element: <WebsiteLayout />,
        children: [
            {
                index: true,
                element: <NativeRedirect />,
            },
            {
                path: "privacy",
                element: <Privacy />,
            },
            {
                path: "terms",
                element: <Terms />,
            },
        ],
    },
];
