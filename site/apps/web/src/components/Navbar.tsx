import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { NotificationBell } from "./NotificationBell";

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-20 border-b-2 border-brand bg-night-800/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="text-xl font-bold">
          <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
            🚀 RoboSphere
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link to="/shop" className="text-gray-300 hover:text-brand-light">
            🛒 Shop
          </Link>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link to="/dashboard" className="text-gray-300 hover:text-brand-light">
              Dashboard
            </Link>
            <Link to="/orders" className="text-gray-300 hover:text-brand-light">
              My Orders
            </Link>
            <Link to="/activate" className="text-gray-300 hover:text-brand-light">
              🔑 Activate
            </Link>
            <Link to="/warranty" className="text-gray-300 hover:text-brand-light">
              🛡️ Warranty
            </Link>
            <Link to="/support" className="text-gray-300 hover:text-brand-light">
              🛠️ Support
            </Link>
            <Link to="/members" className="text-gray-300 hover:text-brand-light">
              Family
            </Link>
            <Link to="/keys" className="text-gray-300 hover:text-brand-light">
              Device Keys
            </Link>
            <Link to="/assistant" className="text-gray-300 hover:text-brand-light">
              🤖 AI
            </Link>
            <Link to="/homes" className="text-gray-300 hover:text-brand-light">
              Homes
            </Link>
            <Link to="/boards" className="text-gray-300 hover:text-brand-light">
              🛰️ Boards
            </Link>
            <Link to="/notifications" className="text-gray-300 hover:text-brand-light">
              🔔 Center
            </Link>
            <NotificationBell />
            <Link to="/profile" className="text-gray-300 hover:text-brand-light">
              Profile
            </Link>
            {user.role === "system_admin" && (
              <Link to="/admin" className="font-semibold text-amber-400 hover:text-amber-300">
                Admin
              </Link>
            )}
            <span className="text-gray-500">Hi, {user.username}</span>
            <button
              onClick={handleLogout}
              className="rounded bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        ) : (
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/login" className="text-gray-300 hover:text-brand-light">
              Login
            </Link>
            <Link
              to="/signup"
              className="rounded bg-gradient-to-r from-brand to-brand-light px-4 py-1.5 font-semibold text-white"
            >
              Sign Up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
