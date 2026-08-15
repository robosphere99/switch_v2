import { Link, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  Bot,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  RadioTower,
  ShieldCheck,
  ShoppingCart,
  User,
  Users,
  Wrench,
  Settings,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useAuthStore } from "../stores/auth";
import { toggleTheme } from "../lib/theme";
import { NotificationBell } from "./NotificationBell";
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

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        {user ? (
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
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
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-2.5 py-1 font-semibold text-brand transition hover:bg-brand/20"
              >
                <Settings className="h-4 w-4" />
                Admin
              </Link>
            )}
            <button
              onClick={() => setDark(toggleTheme())}
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
          <nav className="flex items-center gap-3 text-sm">
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 text-gray-600 transition hover:text-brand"
            >
              <ShoppingCart className="h-4 w-4" />
              Shop
            </Link>
            <button
              onClick={() => setDark(toggleTheme())}
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
      </div>
    </header>
  );
}
