import { lazy } from "react";
import { Navigate, RouteObject } from "react-router-dom";
import { WebsiteLayout } from "./components/WebsiteLayout";
import { isNativePlatform } from "../../shared/libs/capacitor";

// Lazy load pages
const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
// Legal & Extra
const Privacy = lazy(() => import("./pages/legal/SimplePages").then((module) => ({ default: module.Privacy })));
const Terms = lazy(() => import("./pages/legal/SimplePages").then((module) => ({ default: module.Terms })));

const NativeRedirect = () => {
    if (isNativePlatform()) {
        return <Navigate to="/login" replace />;
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
