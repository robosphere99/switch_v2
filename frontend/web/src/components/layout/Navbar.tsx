import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Menu, Smartphone } from "lucide-react";
import { useAuthStore } from "../../stores/auth";
import { Logo } from "../Logo";
import { NotificationBell } from "../NotificationBell";
import { DownloadAppModal } from "../DownloadAppModal";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { MobileDrawer } from "./MobileDrawer";
import { NAV_GROUPS } from "./NavGroups";

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showDownloadApp, setShowDownloadApp] = useState(false);

  const isSystemAdmin = user?.role === "system_admin";
  const activeGroups = isSystemAdmin ? [] : NAV_GROUPS;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/90 backdrop-blur-md dark:border-white/[0.08] dark:bg-black/90 transition-colors">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          {/* Brand Logo */}
          <Link
            to={isSystemAdmin ? "/admin" : user ? "/dashboard" : "/"}
            className="shrink-0 focus:outline-none"
            aria-label="Home"
          >
            <Logo />
          </Link>

          {/* Desktop Nav for Logged-In User */}
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <nav className="flex items-center gap-1">
                {activeGroups.map((group) => {
                  if (group.items.length === 1) {
                    const item = group.items[0];
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-all"
                        title={item.title ?? item.label}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  }

                  return (
                    <div key={group.title} className="group relative inline-block py-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-all"
                      >
                        <span>{group.title}</span>
                        <ChevronDown className="h-3 w-3 text-zinc-400 transition-transform group-hover:rotate-180" />
                      </button>

                      {/* Dropdown Menu */}
                      <div className="invisible absolute left-0 top-[90%] z-50 mt-1 flex w-52 flex-col rounded-xl border border-zinc-200 bg-white p-1.5 opacity-0 shadow-xl transition-all group-hover:visible group-hover:top-full group-hover:opacity-100 dark:border-white/10 dark:bg-zinc-950">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              className="inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10 transition-all"
                              title={item.title ?? item.label}
                            >
                              <Icon className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>

              <div className="h-4 w-px bg-zinc-200 dark:bg-white/10 mx-1" />

              {/* Right Action Rail */}
              <div className="flex items-center gap-2">
                <NotificationBell />

                <button
                  type="button"
                  onClick={() => setShowDownloadApp(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-all"
                  title="Download Mobile App"
                >
                  <Smartphone className="h-4 w-4" />
                </button>

                <ThemeToggle />
                <UserMenu />
              </div>
            </div>
          ) : (
            /* Desktop Nav for Guests / Public — Matching Reference Screenshot */
            <div className="hidden items-center gap-6 text-sm md:flex">
              <nav className="flex items-center gap-6 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <Link to="/" className="hover:text-black dark:hover:text-white transition-colors">
                  Home
                </Link>
                <Link to="/shop" className="hover:text-black dark:hover:text-white transition-colors">
                  Hardware
                </Link>
                <Link to="/activate" className="hover:text-black dark:hover:text-white transition-colors">
                  Activation
                </Link>
                <Link to="/warranty" className="hover:text-black dark:hover:text-white transition-colors">
                  Warranty
                </Link>
                <Link to="/support" className="hover:text-black dark:hover:text-white transition-colors">
                  Support
                </Link>
              </nav>

              <div className="h-4 w-px bg-zinc-200 dark:bg-white/10" />

              <div className="flex items-center gap-3">
                <ThemeToggle />

                <Link
                  to="/login"
                  className="px-2 text-xs font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
                >
                  Sign In
                </Link>

                <Link
                  to="/signup"
                  className="inline-flex items-center rounded-full bg-black px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.98] transition-all"
                >
                  Create a Home
                </Link>
              </div>
            </div>
          )}

          {/* Mobile Right Bar (Notification + Hamburger) */}
          <div className="flex items-center gap-2 md:hidden">
            {user && <NotificationBell />}
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-night-600 bg-white/70 text-night-500 dark:border-night-600 dark:bg-night-800 dark:text-gray-300"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-over Mobile Navigation */}
      <MobileDrawer
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        navGroups={activeGroups}
        onDownloadAppClick={() => setShowDownloadApp(true)}
      />

      {/* Download App Modal */}
      {showDownloadApp && <DownloadAppModal onClose={() => setShowDownloadApp(false)} />}
    </>
  );
}
