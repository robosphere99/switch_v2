import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, LogOut, Settings as SettingsIcon, ChevronDown, Shield } from "lucide-react";
import { useAuthStore } from "../../stores/auth";
import { SupportUnreadBadge } from "../SupportUnreadBadge";

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/");
    setOpen(false);
  };

  const isAdmin = user.role === "system_admin";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-night-600 bg-white/70 px-2.5 py-1.5 text-sm transition-all duration-150 hover:border-night-500 hover:bg-white dark:border-night-600 dark:bg-night-800 dark:hover:border-slate-600"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} className="h-6 w-6 rounded-full object-cover border border-night-600" alt="Avatar" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-brand">
            <User className="h-3.5 w-3.5" />
          </div>
        )}
        <span className="max-w-[120px] truncate text-xs font-semibold text-night-950 dark:text-white">
          {user.username}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-night-600 bg-white p-1.5 shadow-xl shadow-slate-900/5 dark:border-night-600 dark:bg-night-800 dark:shadow-black/40 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-night-600/60 mb-1">
            <p className="text-xs font-semibold text-night-950 dark:text-white truncate">{user.username}</p>
            <p className="text-[11px] text-night-500 dark:text-gray-400 truncate">{user.email}</p>
          </div>

          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-night-950 hover:bg-night-700 dark:text-gray-200 dark:hover:bg-night-700"
          >
            <User className="h-4 w-4 text-night-500" />
            My Profile
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/10 dark:text-brand-light dark:hover:bg-brand/15"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-brand" />
                Admin Panel
              </div>
              <SupportUnreadBadge />
            </Link>
          )}

          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-night-950 hover:bg-night-700 dark:text-gray-200 dark:hover:bg-night-700"
          >
            <SettingsIcon className="h-4 w-4 text-night-500" />
            Settings & Audit
          </Link>

          <div className="my-1 border-t border-night-600/60" />

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="h-4 w-4 text-rose-500" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
