import { NavLink } from "react-router-dom";
import { Bell, Clock, LayoutDashboard, Settings, User, Users, ShoppingCart } from "lucide-react";
import { useAuthStore } from "../../stores/auth";

const TABS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/shop", label: "Shop", icon: ShoppingCart },
  { to: "/automations", label: "Routines", icon: Clock },
  { to: "/members", label: "Family", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
];

const ADMIN_TABS = [
  { to: "/admin", label: "Admin", icon: Settings },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export function BottomTabBar() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  const tabs = user.role === "system_admin" ? ADMIN_TABS : TABS;

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-night-600/60 bg-white/95 backdrop-blur-md md:hidden dark:border-night-600 dark:bg-night-900/95 shadow-[0_-1px_0_rgba(0,0,0,0.04)]"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom,0px)]">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold transition-colors duration-150
              ${isActive ? "text-brand" : "text-night-500 hover:text-brand dark:text-gray-400 dark:hover:text-brand"}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`rounded-xl p-1 transition-all duration-150 ${isActive ? "bg-brand/10" : ""}`}>
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
