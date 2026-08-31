import { Link, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  Bot,
  ChevronDown,
  Clock,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RadioTower,
  ShieldCheck,
  ShoppingCart,
  Mic,
  User,
  Users,
  Wrench,
  Settings as SettingsIcon,
  X,
  Zap
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
import { DownloadAppModal } from "./DownloadAppModal";
import { Smartphone } from "lucide-react";

/* ── Grouped navigation ────────────────────────────────────── */

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  title?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

/**
 * Menu items are grouped logically so the sidebar is scannable
 * and the user doesn't have to read through a flat wall of links.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/shop", label: "Shop", icon: ShoppingCart },
    ],
  },
  {
    title: "Orders & Devices",
    items: [
      { to: "/orders", label: "Orders", icon: Package, title: "My Orders" },
      { to: "/activate", label: "Activate", icon: KeyRound },
      { to: "/warranty", label: "Warranty", icon: ShieldCheck },
      { to: "/keys", label: "Device Keys", icon: BadgeCheck },
    ],
  },
  {
    title: "Smart Home",
    items: [
      { to: "/homes", label: "Homes", icon: Home },
      { to: "/boards", label: "Boards", icon: RadioTower },
      { to: "/members", label: "Family", icon: Users },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { to: "/assistant", label: "AI", icon: Bot },
      { to: "/voice-assistants", label: "Voice Apps", icon: Mic },
      { to: "/automations", label: "Automations", icon: Clock }
    ],
  },
  {
    title: "Support & Help",
    items: [
      { to: "/support", label: "Support", icon: Wrench },
      { to: "/notifications", label: "Alerts", icon: Bell },
    ],
  },
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
  const [showDownloadApp, setShowDownloadApp] = useState(false);

  // Profile me theme change ho to yahan bhi sync rahe
  useEffect(() => onThemeChange(() => setDark(resolvedDark())), []);

  function handleLogout() {
    logout();
    navigate("/");
    setMobileOpen(false);
  }

  const mobileLinkCls =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-100 hover:text-brand dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-brand";

  const activeGroups = isSystemAdmin(user?.role) ? [] : NAV_GROUPS;

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

          {/* ── Desktop nav ─────────────────────────────────── */}
          {user ? (
            <div className="hidden items-center gap-2 text-[13px] md:flex">
              {/* Left: scrollable nav links */}
              <nav className="flex min-w-0 flex-1 items-center gap-x-5 pl-4">
                {activeGroups.map((group) => {
                  if (group.items.length === 1) {
                    const item = group.items[0];
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-gray-600 transition hover:text-brand dark:text-gray-300 dark:hover:text-brand"
                        title={item.title ?? item.label}
                      >
                        <item.icon className="h-4.5 w-4.5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  }

                  return (
                    <div key={group.title} className="group relative inline-block py-2">
                      <button className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 transition hover:text-brand dark:text-gray-300 dark:hover:text-brand">
                        {group.title}
                        <ChevronDown className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:rotate-180" />
                      </button>
                      <div className="invisible absolute left-0 top-[90%] z-50 mt-1 flex w-48 flex-col rounded-xl border border-gray-100 bg-white p-1.5 opacity-0 shadow-xl transition-all group-hover:visible group-hover:top-full group-hover:opacity-100 dark:border-night-600 dark:bg-night-800">
                        {group.items.map(({ to, label, icon: Icon, title }) => (
                          <Link
                            key={to}
                            to={to}
                            className="inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-brand/10 hover:text-brand dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-brand"
                            title={title ?? label}
                          >
                            <Icon className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-brand" />
                            {label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </nav>

              {/* Right: always-visible actions (never scrolls away) */}
              <div className="flex shrink-0 items-center gap-2 pl-1">
                <span className="h-4 w-px bg-gray-300 dark:bg-night-600" />
                <span className="shrink-0"><NotificationBell /></span>
                <Link
                  to="/profile"
                  className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-gray-600 transition hover:text-brand"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl.startsWith('http') ? user.avatarUrl : user.avatarUrl} className="h-6 w-6 rounded-full object-cover border border-gray-200" alt="Avatar" />
                  ) : (
                    <User className="h-4 w-4 shrink-0" />
                  )}
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
                      <SettingsIcon className="h-4 w-4" />
                      Admin
                    </Link>
                    <SupportUnreadBadge />
                  </span>
                )}
                <button
                  onClick={() => setShowDownloadApp(true)}
                  className="rounded-lg border border-gray-300 p-1.5 text-gray-600 transition hover:border-brand hover:text-brand"
                  title="Download App"
                >
                  <Smartphone className="h-4 w-4" />
                </button>
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
              </div>
            </div>
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
                onClick={() => setShowDownloadApp(true)}
                className="rounded-lg border border-gray-300 p-1.5 text-gray-600 transition hover:border-brand hover:text-brand"
                title="Download App"
              >
                <Smartphone className="h-4 w-4" />
              </button>
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

        {/* ── Mobile sidebar ───────────────────────────────── */}
        {/* z-50 so BottomTabBar (z-40) kabhi overlap nahi kare;
          max-h + overflow-y-auto taaki chhote screen pe links scroll ho, buttons gayab na ho */}
        {mobileOpen && (
          <div className="fixed inset-x-0 top-[57px] z-50 flex max-h-[calc(100vh-57px-56px)] flex-col border-t border-gray-200 bg-white dark:border-night-600 dark:bg-night-800 md:hidden">
            {user ? (
              <>
                {/* ── Scrollable menu area ── */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="mx-auto max-w-7xl px-4 py-3 pb-2">
                    {/* ── User info card ── */}
                    <div className="mb-3 flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3 dark:bg-night-700">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl.startsWith('http') ? user.avatarUrl : user.avatarUrl} className="h-10 w-10 shrink-0 rounded-full object-cover border border-gray-200" alt="Avatar" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                          <User className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-night-950 dark:text-white">
                          {user.username}
                        </p>
                        {user.role && (
                          <span className="inline-block rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                            {user.role === "system_admin" ? "Admin" : user.role}
                          </span>
                        )}
                      </div>
                      <Link
                        to="/profile"
                        className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-brand hover:text-brand dark:border-night-500 dark:text-gray-400"
                        onClick={() => setMobileOpen(false)}
                      >
                        Profile
                      </Link>
                    </div>

                    {/* ── Grouped menu items ── */}
                    {activeGroups.map((group) => (
                      <div key={group.title} className="mb-1">
                        <p className="mb-0.5 px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          {group.title}
                        </p>
                        {group.items.map(({ to, label, icon: Icon }) => (
                          <Link
                            key={to}
                            to={to}
                            className={mobileLinkCls}
                            onClick={() => setMobileOpen(false)}
                          >
                            <Icon className="h-4 w-4 text-brand" />
                            {label}
                          </Link>
                        ))}
                      </div>
                    ))}

                    {/* ── Admin link (system_admin only) ── */}
                    {user.role === "system_admin" && (
                      <div className="mb-1">
                        <p className="mb-0.5 px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          System
                        </p>
                        <span className="relative block">
                          <Link
                            to="/admin"
                            className="flex w-full items-center gap-2.5 rounded-lg bg-brand/10 px-3 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/20"
                            onClick={() => setMobileOpen(false)}
                          >
                            <SettingsIcon className="h-4 w-4" />
                            Admin Panel
                          </Link>
                          <SupportUnreadBadge />
                        </span>
                      </div>
                    )}

                  </div>
                </div>

                {/* ── Sticky bottom bar: ALWAYS visible ── */}
                <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 dark:border-night-600 dark:bg-night-800">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0">
                      <NotificationBell />
                    </span>
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        setShowDownloadApp(true);
                      }}
                      className="shrink-0 rounded-lg border border-gray-300 p-2.5 text-gray-600 transition hover:border-brand hover:text-brand dark:border-night-600 dark:text-gray-400"
                      title="Download App"
                    >
                      <Smartphone className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => toggleTheme(setDark)}
                      className="shrink-0 rounded-lg border border-gray-300 p-2.5 text-gray-600 transition hover:border-brand hover:text-brand dark:border-night-600 dark:text-gray-400"
                      title={dark ? "Light mode" : "Dark mode"}
                    >
                      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mx-auto max-w-7xl px-4 py-3 pb-4">
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
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    setShowDownloadApp(true);
                  }}
                  className={mobileLinkCls}
                >
                  <Smartphone className="h-4 w-4 text-brand" />
                  Download App
                </button>
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
              </div>
            )}
          </div>
        )}
      </header>

      {showDownloadApp && (
        <DownloadAppModal onClose={() => setShowDownloadApp(false)} />
      )}

      {/* Mobile bottom tab bar — header se bahar (fixed positioning sahi rahe) */}
      <BottomTabBar />
    </>
  );
}
