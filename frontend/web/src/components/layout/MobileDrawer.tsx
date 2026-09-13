import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { X, LogOut, Smartphone, User, Shield } from "lucide-react";
import { useAuthStore } from "../../stores/auth";
import { Logo } from "../Logo";
import { ThemeToggle } from "./ThemeToggle";
import { SupportUnreadBadge } from "../SupportUnreadBadge";
import type { NavGroup } from "./NavGroups";

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  navGroups: NavGroup[];
  onDownloadAppClick: () => void;
}

export function MobileDrawer({ isOpen, onClose, navGroups, onDownloadAppClick }: MobileDrawerProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogout = () => {
    logout();
    navigate("/");
    onClose();
  };

  const isAdmin = user?.role === "system_admin";

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative ml-auto flex h-full w-4/5 max-w-sm flex-col bg-white p-6 shadow-2xl dark:bg-night-800 animate-in slide-in-from-right duration-250 border-l border-night-600">
        <div className="flex items-center justify-between pb-4 border-b border-night-600/60">
          <Link to="/" onClick={onClose}>
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-night-500 hover:bg-night-700 hover:text-night-950 dark:hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* User preview */}
        {user && (
          <div className="flex items-center gap-3 py-4 border-b border-night-600/60">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} className="h-10 w-10 rounded-full object-cover border border-night-600" alt="Avatar" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                <User className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-night-950 dark:text-white">{user.username}</p>
              <p className="truncate text-xs text-night-500 dark:text-gray-400">{user.email}</p>
            </div>
          </div>
        )}

        {/* Links list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5">
          {isAdmin && (
            <Link
              to="/admin"
              onClick={onClose}
              className="flex items-center justify-between rounded-xl bg-brand/10 p-3 text-sm font-semibold text-brand dark:bg-brand/15 dark:text-brand-light"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4" />
                Admin Dashboard
              </div>
              <SupportUnreadBadge />
            </Link>
          )}

          {user &&
            navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-night-500 dark:text-gray-400">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-night-950 hover:bg-night-700 dark:text-gray-200 dark:hover:bg-night-700 transition-colors"
                    >
                      <Icon className="h-4 w-4 text-night-500" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}

          {!user && (
            <div className="space-y-2 pt-2">
              <Link
                to="/shop"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-night-950 hover:bg-night-700 dark:text-gray-200"
              >
                Shop
              </Link>
              <Link
                to="/login"
                onClick={onClose}
                className="flex w-full items-center justify-center rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-xs"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                onClick={onClose}
                className="flex w-full items-center justify-center rounded-xl border border-night-600 py-2.5 text-sm font-medium text-night-950 hover:bg-night-700 dark:text-gray-200"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-night-600/60 space-y-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onDownloadAppClick();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-night-600 px-3 py-2 text-xs font-medium text-night-500 hover:text-night-950 dark:hover:text-white"
          >
            <Smartphone className="h-4 w-4" />
            Download App
          </button>

          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
