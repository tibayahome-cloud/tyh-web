import { Building2, User } from "lucide-react";
import { Link } from "react-router-dom";
import classNames from "classnames";

export type AuthPortal = "personal" | "facility";

const OPTIONS: Array<{ portal: AuthPortal; to: string; label: string; Icon: typeof User }> = [
  { portal: "personal", to: "/login", label: "Personal account", Icon: User },
  { portal: "facility", to: "/facility/login", label: "Facility admin", Icon: Building2 }
];

// The two public ways in. It is a pair of links (each is its own page and URL), not a form
// control, so the browser's back button and deep links behave and each page can be bookmarked.
// System administration is deliberately absent: it has its own unlisted entry point.
export const AuthPortalSwitch = ({ active }: { active: AuthPortal }) => (
  <nav aria-label="Choose how you sign in" className="mb-6">
    <ul className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
      {OPTIONS.map(({ portal, to, label, Icon }) => {
        const isActive = portal === active;
        return (
          <li key={portal}>
            <Link
              to={to}
              aria-current={isActive ? "page" : undefined}
              className={classNames(
                "flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue",
                isActive
                  ? "bg-white text-tiba-blue shadow-sm"
                  : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
              )}
            >
              <Icon className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  </nav>
);
