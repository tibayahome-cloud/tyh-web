import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import classNames from "classnames";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type NavItem = {
    label: string;
    to: string;
    icon: ReactNode;
    badge?: number;
};

interface AppSidebarProps {
    items: NavItem[];
    collapsed: boolean;
    onToggle: () => void;
}

export const AppSidebar = ({ items, collapsed, onToggle }: AppSidebarProps) => {
    return (
        <aside
            className={classNames(
                "hidden lg:flex flex-col h-screen sticky top-0 border-r border-slate-100 bg-white shadow-[1px_0_10px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out z-40",
                collapsed ? "w-20" : "w-64"
            )}
        >
            <div className="flex flex-col h-full py-6">
                {/* Brand / Logo Area */}
                <div className={classNames(
                    "px-6 mb-10 transition-all duration-300",
                    collapsed ? "flex justify-center" : "flex items-center justify-between"
                )}>
                    {!collapsed && (
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-tiba-blue to-primary-600 flex items-center justify-center shadow-lg shadow-tiba-blue/20">
                                <span className="text-white font-bold text-lg">T</span>
                            </div>
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                                Tiba
                            </span>
                        </div>
                    )}
                    <button
                        onClick={onToggle}
                        className={classNames(
                            "p-2 rounded-xl hover:bg-slate-50 text-slate-400 transition-all border border-transparent hover:border-slate-100 hover:shadow-sm",
                            collapsed ? "mx-auto" : ""
                        )}
                    >
                        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {items.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                classNames(
                                    "flex items-center gap-3 px-4 h-12 rounded-2xl transition-all duration-300 group relative",
                                    isActive
                                        ? "bg-gradient-to-r from-tiba-blue to-primary-600 text-white shadow-xl shadow-tiba-blue/20"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                )
                            }
                        >
                            <div className={classNames(
                                "shrink-0 transition-transform duration-300 group-hover:scale-110",
                                collapsed ? "mx-auto" : ""
                            )}>
                                {item.icon}
                            </div>
                            {!collapsed && (
                                <span className="text-sm font-semibold truncate tracking-tight">{item.label}</span>
                            )}

                            {/* Badge */}
                            {item.badge !== undefined && item.badge > 0 && (
                                <span className={classNames(
                                    "absolute flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white ring-2 ring-white shadow-sm",
                                    collapsed ? "top-2 right-4" : "right-4",
                                    "bg-rose-500"
                                )}>
                                    {item.badge > 99 ? "99+" : item.badge}
                                </span>
                            )}

                            {/* Tooltip for collapsed state */}
                            {collapsed && (
                                <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 shadow-xl whitespace-nowrap z-[100]">
                                    {item.label}
                                </div>
                            )}

                            {/* Active Indicator bar */}
                            {!collapsed && (
                                <div className={classNames(
                                    "absolute left-0 w-1 h-6 rounded-r-full bg-white/40 transition-opacity",
                                    "opacity-0 group-[.active]:opacity-100"
                                )} />
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer Section */}
                {!collapsed && (
                    <div className="px-6 pt-6 border-t border-slate-50">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Support</p>
                            <p className="text-xs text-slate-600 leading-relaxed">Need help? WhatsApp us for instant care.</p>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};
