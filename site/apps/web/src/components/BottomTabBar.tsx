import { NavLink } from "react-router-dom";
import { Bell, LayoutDashboard, Settings, User, Users } from "lucide-react";
import { useAuthStore } from "../stores/auth";

/**
 * Mobile bottom tab bar — ek haath se accessible, sirf < md screens pe.
 * Consumer ke liye 4-5 essential destinations; baaki hamburger menu me rehte hain.
 */
const TABS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/members", label: "Family", icon: Users },
  { to: "/notifications", label: "Alerts", icon: Bell },
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden dark:border-night-600 dark:bg-night-800/95"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold transition ${
                isActive ? "text-brand" : "text-gray-500 hover:text-brand"
              }`
            }
          >
            <Icon className="h-5 w-5" strokeWidth={2.2} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
