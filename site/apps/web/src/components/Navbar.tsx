import { Link, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  Bot,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RadioTower,
  ShieldCheck,
  ShoppingCart,
  User,
  Users,
  Wrench,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useAuthStore } from "../stores/auth";
import { onThemeChange, resolvedDark } from "../lib/theme";
import { changeTheme } from "../lib/themeAccount";
import { NotificationBell } from "./NotificationBell";
import { SupportUnreadBadge } from "./SupportUnreadBadge";
import { Logo } from "./Logo";

const NAV_LINKS: Array<{ to: string; label: string; icon: typeof Home }> = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orders", label: "My Orders", icon: Package },
  { to: "/activate", label: "Activate", icon: KeyRound },
  { to: "/warranty", label: "Warranty", icon: ShieldCheck },
  { to: "/support", label: "Support", icon: Wrench },
  { to: "/members", label: "Family", icon: Users },
  { to: "/keys", label: "Device Keys", icon: BadgeCheck },
  { to: "/assistant", label: "AI", icon: Bot },
  { to: "/homes", label: "Homes", icon: Home },
  { to: "/boards", label: "Boards", icon: RadioTower },
  { to: "/notifications", label: "Center", icon: Bell },
];

/** Admin (system_admin) sirf site administration dekhta hai — customer links nahi. */
const ADMIN_LINKS: Array<{ to: string; label: string; icon: typeof Home }> = [
  { to: "/support", label: "Support", icon: Wrench },
];

function toggleTheme(setDark: (d: boolean) => void) {
  changeTheme(resolvedDark() ? "light" : "dark");
  setDark(resolvedDark());
}

const isSystemAdmin = (role?: string) => role === "system_admin";

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => resolvedDark());
  const [mobileOpen, setMobileOpen] = useState(false);

  // Profile me theme change ho to yahan bhi sync rahe
  useEffect(() => onThemeChange(() => setDark(resolvedDark())), []);

  function handleLogout() {
    logout();
    navigate("/");
    setMobileOpen(false);
  }

  const mobileLinkCls =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-100 hover:text-brand";

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        {/* Admin login pe logo → Admin Overview (stats); warna home page */}
        <Link
          to={user?.role === "system_admin" ? "/admin" : "/"}
          className="shrink-0"
          onClick={() => setMobileOpen(false)}
        >
          <Logo />
        </Link>

        {user ? (
          <nav className="hidden items-center gap-x-5 gap-y-2 text-sm md:flex">
            {(isSystemAdmin(user.role) ? ADMIN_LINKS : NAV_LINKS).map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="inline-flex items-center gap-1.5 text-gray-600 transition hover:text-brand"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <NotificationBell />
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 text-gray-600 transition hover:text-brand"
            >
              <User className="h-4 w-4" />
              <span>
                Hi, <span className="font-semibold text-night-950">{user.username}</span>
              </span>
            </Link>
            {user.role === "system_admin" && (
              <span className="relative">
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-2.5 py-1 font-semibold text-brand transition hover:bg-brand/20"
                >
                  <Settings className="h-4 w-4" />
                  Admin
                </Link>
                <SupportUnreadBadge />
              </span>
            )}
            <button
              onClick={() => toggleTheme(setDark)}
              className="rounded-lg border border-gray-300 p-1.5 text-gray-600 transition hover:border-brand hover:text-brand"
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </nav>
        ) : (
          <nav className="hidden items-center gap-3 text-sm md:flex">
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 text-gray-600 transition hover:text-brand"
            >
              <ShoppingCart className="h-4 w-4" />
              Shop
            </Link>
            <button
              onClick={() => toggleTheme(setDark)}
              className="rounded-lg border border-gray-300 p-1.5 text-gray-600 transition hover:border-brand hover:text-brand"
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/login"
              className="rounded-lg border border-gray-300 px-4 py-1.5 font-semibold text-gray-700 transition hover:border-brand hover:text-brand"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 font-semibold text-white shadow-md shadow-brand/30 transition hover:brightness-110"
            >
              <Zap className="h-4 w-4" />
              Sign Up
            </Link>
          </nav>
        )}

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="rounded-lg border border-gray-300 p-2 text-gray-600 transition hover:border-brand hover:text-brand md:hidden"
          title={mobileOpen ? "Close menu" : "Menu"}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-gray-200 bg-white md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-3">
            {user ? (
              <>
                {(isSystemAdmin(user.role) ? ADMIN_LINKS : NAV_LINKS).map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} className={mobileLinkCls} onClick={() => setMobileOpen(false)}>
                    <Icon className="h-4 w-4 text-brand" />
                    {label}
                  </Link>
                ))}
                <Link to="/profile" className={mobileLinkCls} onClick={() => setMobileOpen(false)}>
                  <User className="h-4 w-4 text-brand" />
                  Hi, {user.username}
                </Link>
                {user.role === "system_admin" && (
                  <span className="relative block">
                    <Link
                      to="/admin"
                      className="flex w-full items-center gap-2.5 rounded-lg bg-brand/10 px-3 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/20"
                      onClick={() => setMobileOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      Admin
                    </Link>
                    <SupportUnreadBadge />
                  </span>
                )}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <NotificationBell />
                  <button
                    onClick={() => toggleTheme(setDark)}
                    className="rounded-lg border border-gray-300 p-2 text-gray-600 transition hover:border-brand hover:text-brand"
                    title={dark ? "Light mode" : "Dark mode"}
                  >
                    {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/shop" className={mobileLinkCls} onClick={() => setMobileOpen(false)}>
                  <ShoppingCart className="h-4 w-4 text-brand" />
                  Shop
                </Link>
                <Link to="/login" className={mobileLinkCls} onClick={() => setMobileOpen(false)}>
                  <User className="h-4 w-4 text-brand" />
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                  onClick={() => setMobileOpen(false)}
                >
                  <Zap className="h-4 w-4" />
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
