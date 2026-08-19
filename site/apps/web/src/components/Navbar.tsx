import { Link, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  Bot,
  Cpu,
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
import { BottomTabBar } from "./BottomTabBar";

const NAV_LINKS: Array<{ to: string; label: string; icon: typeof Home; title?: string }> = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: Package, title: "My Orders" },
  { to: "/activate", label: "Activate", icon: KeyRound },
  { to: "/warranty", label: "Warranty", icon: ShieldCheck },
  { to: "/support", label: "Support", icon: Wrench },
  { to: "/members", label: "Family", icon: Users },
  { to: "/keys", label: "Keys", icon: BadgeCheck, title: "Device Keys" },
  { to: "/assistant", label: "AI", icon: Bot },
  { to: "/homes", label: "Homes", icon: Home },
  { to: "/boards", label: "Boards", icon: RadioTower },
  { to: "/notifications", label: "Alerts", icon: Bell },
];

/**
 * Admin (system_admin) ke liye top-navbar me customer links nahi dikhte —
 * admin ka kaam Admin panel (Overview/Support inbox/Users/...) me hota hai,
 * aur vahi "Support" tab asli support inbox hai. /support customer page
 * admin ke liye bekaar hai — isliye links khaali.
 */
const ADMIN_LINKS: Array<{ to: string; label: string; icon: typeof Home; title?: string }> = [];

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
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-3 text-sm text-gray-700 transition hover:bg-gray-100 hover:text-brand dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-brand";

  // BottomTabBar header ke BAHAR hona chahiye: header pe backdrop-blur (backdrop-filter)
  // hai, jo fixed-positioning ke liye containing-block banata hai — andar rakha to
  // bottom-tab header ke relative render hota, viewport ke bottom pe nahi.
  return (
    <>
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
          <nav className="hidden min-w-0 items-center gap-x-3 gap-y-2 overflow-x-auto text-[13px] scrollbar-none md:flex [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {(isSystemAdmin(user.role) ? ADMIN_LINKS : NAV_LINKS).map(({ to, label, icon: Icon, title }) => (
              <Link
                key={to}
                to={to}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-gray-600 transition hover:text-brand"
                title={title ?? label}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}              <a
                href="/api/docs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-gray-600 transition hover:text-brand"
                title="API docs — Swagger UI"
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                Docs
              </a>
              <a
                href="/api/docs/esp32"
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-gray-600 transition hover:text-brand"
                title="ESP32 integration guide — curl/python/node + Arduino sketch"
              >
                <Cpu className="h-4 w-4 shrink-0" />
                ESP32
              </a>              <span className="shrink-0"><NotificationBell /></span>
              <Link
                to="/profile"
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-gray-600 transition hover:text-brand"
              >
                <User className="h-4 w-4 shrink-0" />
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
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
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
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-gray-600 transition hover:text-brand"
              title="API docs — Swagger UI"
            >
              <BookOpen className="h-4 w-4" />
              API Docs
            </a>
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
          className="rounded-lg border border-gray-300 p-2.5 text-gray-600 transition hover:border-brand hover:text-brand dark:border-night-600 dark:text-gray-400 md:hidden"
          title={mobileOpen ? "Close menu" : "Menu"}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown — z-50 so BottomTabBar (z-40) kabhi overlap nahi kare;
          max-h + overflow-y-auto taaki chhote screen pe links scroll ho, buttons gayab na ho */}
      {mobileOpen && (
        <div className="fixed inset-x-0 top-[57px] z-50 max-h-[calc(100vh-57px-56px)] overflow-y-auto border-t border-gray-200 bg-white dark:border-night-600 dark:bg-night-800 md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-3 pb-4">
            {user ? (
              <>
                {(isSystemAdmin(user.role) ? ADMIN_LINKS : NAV_LINKS).map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} className={mobileLinkCls} onClick={() => setMobileOpen(false)}>
                    <Icon className="h-4 w-4 text-brand" />
                    {label}
                  </Link>
                ))}
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noreferrer"
                  className={mobileLinkCls}
                  onClick={() => setMobileOpen(false)}
                >
                  <BookOpen className="h-4 w-4 text-brand" />
                  API Docs
                </a>
                <a
                  href="/api/docs/esp32"
                  target="_blank"
                  rel="noreferrer"
                  className={mobileLinkCls}
                  onClick={() => setMobileOpen(false)}
                >
                  <Cpu className="h-4 w-4 text-brand" />
                  ESP32 Guide
                </a>
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
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <NotificationBell />
                  <button
                    onClick={() => toggleTheme(setDark)}
                    className="rounded-lg border border-gray-300 p-2.5 text-gray-600 transition hover:border-brand hover:text-brand dark:border-night-600 dark:text-gray-400"
                    title={dark ? "Light mode" : "Dark mode"}
                  >
                    {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-night-600 dark:text-gray-400 dark:hover:border-red-400/40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
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
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noreferrer"
                  className={mobileLinkCls}
                  onClick={() => setMobileOpen(false)}
                >
                  <BookOpen className="h-4 w-4 text-brand" />
                  API Docs
                </a>
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

    {/* Mobile bottom tab bar — header se bahar (fixed positioning sahi rahe) */}
    <BottomTabBar />
    </>
  );
}
