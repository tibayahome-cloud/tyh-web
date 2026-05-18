import { NavLink } from "react-router-dom";
import classNames from "classnames";
import type { NavItem } from "./AppSidebar";

interface AppBottomNavProps {
    items: NavItem[];
}

export const AppBottomNav = ({ items }: AppBottomNavProps) => {
    return (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-t border-slate-100 pb-safe">
            <div className="grid grid-cols-5 h-[72px]">
                {items.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }: { isActive: boolean }) =>
                            classNames(
                                "flex flex-col items-center justify-center gap-1 transition-all duration-200",
                                isActive ? "text-tiba-blue" : "text-slate-400"
                            )
                        }
                    >
                        <div className="relative">
                            {item.icon}
                            {item.badge !== undefined && item.badge > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black leading-none text-white ring-2 ring-white">
                                    {item.badge > 99 ? "99+" : item.badge}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                            {item.label}
                        </span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};
