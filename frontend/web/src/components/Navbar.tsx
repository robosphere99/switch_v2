import { Link, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  Bot,
  ChevronDown,
  Clock,
  Home,
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
  Activity,
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
      { to: "/settings", label: "Audit Logs", icon: Activity },
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
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-white";

  const activeGroups = isSystemAdmin(user?.role) ? [] : NAV_GROUPS;

  /* Icon-button used in the right-rail */
  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-all hover:border-brand/40 hover:bg-brand/5 hover:text-brand dark:border-night-600 dark:text-gray-400 dark:hover:border-brand/30 dark:hover:text-brand";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/80 backdrop-blur-md dark:border-night-600 dark:bg-night-800/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Logo — Admin login pe admin overview; warna home */}
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
              <nav className="flex min-w-0 flex-1 items-center gap-x-1 pl-3">
                {activeGroups.map((group) => {
                  if (group.items.length === 1) {
                    const item = group.items[0];
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-white"
                        title={item.title ?? item.label}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  }

                  return (
                    <div key={group.title} className="group relative inline-block py-2">
                      <button className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-white">
                        {group.title}
                        <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:rotate-180" />
                      </button>
                      {/* Dropdown */}
                      <div className="invisible absolute left-0 top-[90%] z-50 mt-1 flex w-52 flex-col rounded-2xl border border-gray-100 bg-white p-1.5 opacity-0 shadow-xl shadow-gray-200/60 transition-all group-hover:visible group-hover:top-full group-hover:opacity-100 dark:border-night-600 dark:bg-night-800 dark:shadow-black/40">
                        {group.items.map(({ to, label, icon: Icon, title }) => (
                          <Link
                            key={to}
                            to={to}
                            className="inline-flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-brand dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-brand"
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

              {/* Right: always-visible actions */}
              <div className="flex shrink-0 items-center gap-1.5 pl-1">
                <span className="h-4 w-px bg-gray-200 dark:bg-night-600" />
                <span className="shrink-0"><NotificationBell /></span>

                <Link
                  to="/profile"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-white"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} className="h-6 w-6 rounded-full object-cover border border-gray-200" alt="Avatar" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10">
                      <User className="h-3.5 w-3.5 text-brand" />
                    </div>
                  )}
                  <span className="whitespace-nowrap">
                    Hi, <span className="font-semibold text-gray-900 dark:text-white">{user.username}</span>
                  </span>
                </Link>

                {user.role === "system_admin" && (
                  <span className="relative">
                    <Link
                      to="/admin"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand/10 px-2.5 py-1.5 text-sm font-semibold text-brand transition-all hover:bg-brand/20"
                    >
                      <SettingsIcon className="h-4 w-4" />
                      Admin
                    </Link>
                    <SupportUnreadBadge />
                  </span>
                )}

                <button onClick={() => setShowDownloadApp(true)} className={iconBtn} title="Download App">
                  <Smartphone className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleTheme(setDark)}
                  className={iconBtn}
                  title={dark ? "Light mode" : "Dark mode"}
                >
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleLogout}
                  className="btn-danger px-3 py-1.5 text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <nav className="hidden items-center gap-2 text-sm md:flex">
              <Link
                to="/shop"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-white"
              >
                <ShoppingCart className="h-4 w-4" />
                Shop
              </Link>
              <a
                href="/api/docs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-white"
                title="API docs — Swagger UI"
              >
                <BookOpen className="h-4 w-4" />
                API Docs
              </a>
              <button onClick={() => setShowDownloadApp(true)} className={iconBtn} title="Download App">
                <Smartphone className="h-4 w-4" />
              </button>
              <button onClick={() => toggleTheme(setDark)} className={iconBtn} title={dark ? "Light mode" : "Dark mode"}>
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link
                to="/login"
                className="btn-outline px-4 py-1.5 text-sm"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="btn-primary px-4 py-1.5 text-sm"
              >
                <Zap className="h-3.5 w-3.5" />
                Sign Up
              </Link>
            </nav>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-xl border border-gray-200 p-2.5 text-gray-600 transition-all hover:border-brand/30 hover:bg-brand/5 hover:text-brand dark:border-night-600 dark:text-gray-400 md:hidden"
            title={mobileOpen ? "Close menu" : "Menu"}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* ── Mobile drawer ───────────────────────────────── */}
        {mobileOpen && (
          <div className="fixed inset-x-0 top-[57px] z-50 flex max-h-[calc(100vh-57px-56px)] flex-col border-t border-gray-100 bg-white dark:border-night-600 dark:bg-night-800 md:hidden">
            {user ? (
              <>
                {/* Scrollable menu area */}
                <div className="min-h-0 flex-1 overflow-y-auto thin-scrollbar">
                  <div className="mx-auto max-w-7xl px-4 py-4 pb-2">
                    {/* User info card */}
                    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-night-700">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} className="h-10 w-10 shrink-0 rounded-full object-cover border-2 border-gray-200" alt="Avatar" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
                          <User className="h-5 w-5 text-brand" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
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
                        className="shrink-0 rounded-xl border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-all hover:border-brand hover:text-brand dark:border-night-500 dark:text-gray-400"
                        onClick={() => setMobileOpen(false)}
                      >
                        Profile
                      </Link>
                    </div>

                    {/* Grouped menu */}
                    {activeGroups.map((group) => (
                      <div key={group.title} className="mb-2">
                        <p className="mb-1 px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
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

                    {/* Admin link (system_admin only) */}
                    {user.role === "system_admin" && (
                      <div className="mb-2">
                        <p className="mb-1 px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          System
                        </p>
                        <span className="relative block">
                          <Link
                            to="/admin"
                            className="flex w-full items-center gap-2.5 rounded-xl bg-brand/10 px-3 py-2.5 text-sm font-semibold text-brand transition-all hover:bg-brand/20"
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

                {/* Sticky bottom bar */}
                <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 dark:border-night-600 dark:bg-night-800">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0"><NotificationBell /></span>
                    <button
                      onClick={() => { setMobileOpen(false); setShowDownloadApp(true); }}
                      className={`shrink-0 ${iconBtn}`}
                      title="Download App"
                    >
                      <Smartphone className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => toggleTheme(setDark)}
                      className={`shrink-0 ${iconBtn}`}
                      title={dark ? "Light mode" : "Dark mode"}
                    >
                      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="btn-danger flex flex-1 items-center justify-center gap-1.5 py-2.5"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mx-auto max-w-7xl px-4 py-4 pb-6">
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
                  onClick={() => { setMobileOpen(false); setShowDownloadApp(true); }}
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
                  className="btn-primary mt-2 w-full justify-center py-2.5"
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

      {/* Mobile bottom tab bar */}
      <BottomTabBar />
    </>
  );
}
