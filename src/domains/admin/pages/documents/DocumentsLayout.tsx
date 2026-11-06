import { NavLink, Navigate, Outlet } from "react-router-dom";

import { useRbac } from "../../../../shared/hooks/useRbac";
import { ROLE_ADMIN_SUPER } from "../../../../shared/rbac/roles";
import { useDocumentsAttention } from "../../hooks/useDocumentsAttention";

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue";

/** Where /admin/documents lands: the super admin's daily work is the facilities, a facility admin's is their providers. */
export const DocumentsIndexRedirect = () => {
  const { hasRole } = useRbac();
  return <Navigate to={hasRole(ROLE_ADMIN_SUPER) ? "facilities" : "providers"} replace />;
};

/** The two kinds of documents, side by side: who sees which depends on their role. */
export const DocumentsLayout = () => {
  const { hasRole } = useRbac();
  const superAdmin = hasRole(ROLE_ADMIN_SUPER);
  const attention = useDocumentsAttention().data;
  const tabs = superAdmin
    ? [
        { to: "/admin/documents/facilities", label: "Facilities", count: attention?.facilities_waiting ?? 0, what: "facilities waiting for review" },
        { to: "/admin/documents/providers", label: "Providers", count: attention?.providers_waiting ?? 0, what: "providers waiting for review" }
      ]
    : [
        { to: "/admin/documents/providers", label: "Provider documents", count: attention?.providers_waiting ?? 0, what: "providers waiting for review" },
        { to: "/admin/documents/facility", label: "Our documents", count: attention?.facility_sent_back ?? 0, what: "documents sent back" }
      ];
  return (
    <div>
      <nav aria-label="Documents" className="mx-auto flex w-full max-w-4xl gap-2 px-4 pt-6">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border px-4 text-center text-sm font-semibold sm:flex-none sm:px-5 ${focusRing} ${
                isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
              }`
            }
          >
            {tab.label}
            {tab.count > 0 && (
              <span aria-label={`${tab.count} ${tab.what}`} className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                {tab.count}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
};

export default DocumentsLayout;
