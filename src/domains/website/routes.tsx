
import { lazy } from "react";
import { RouteObject } from "react-router-dom";
import { WebsiteLayout } from "./components/WebsiteLayout";

// Lazy load pages
const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
// Legal & Extra
const Privacy = lazy(() => import("./pages/legal/SimplePages").then((module) => ({ default: module.Privacy })));
const Terms = lazy(() => import("./pages/legal/SimplePages").then((module) => ({ default: module.Terms })));

export const websiteRoutes: RouteObject[] = [
    {
        element: <WebsiteLayout />,
        children: [
            {
                index: true,
                element: <Home />,
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
