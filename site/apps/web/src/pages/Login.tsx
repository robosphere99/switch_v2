import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff } from "lucide-react";
import { login, revokeUnauth } from "../api/auth";
import { extractApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { applyAccountTheme } from "../lib/themeAccount";
import { Logo } from "../components/Logo";

export function Login() {
  const [usernameEmail, setUsernameEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSessionsData, setActiveSessionsData] = useState<any[]>([]);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeSessionsData.length >= 3) return; // Block login if over limit locally
    setError("");
    setLoading(true);
    try {
      const res = await login({ usernameEmail, password, revokeOtherSessions });
      if (res.success) {
        setAuth(res.data);
        applyAccountTheme(res.data.user);
        navigate(res.data.user.role === "system_admin" ? "/admin" : "/dashboard");
      } else {
        setError(res.error.message);
      }
    } catch (err: any) {
      const parsed = extractApiError(err);
      if (parsed.code === "SESSION_LIMIT_REACHED") {
        setActiveSessionsData(parsed.details || []);
      } else {
        setError(parsed.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRevokeSession(sessionId: number) {
    setLoading(true);
    try {
      const res = await revokeUnauth({ usernameEmail, password, sessionId });
      if (res.success && res.data) {
        setActiveSessionsData(res.data);
      } else {
        setError((res as any).error?.message || "Failed to revoke session");
      }
    } catch (err: any) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-brand/20 bg-night-800 p-10 shadow-2xl"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="lg" />
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Lock className="h-5 w-5 text-brand" />
            Sign in to your home
          </h1>
        </div>

        {error && (
          <p className="mb-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
        )}

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Username or Email
        </label>
        <input
          value={usernameEmail}
          onChange={(e) => setUsernameEmail(e.target.value)}
          required
          className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-night-950 outline-none focus:border-brand"
        />

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Password
        </label>
        <div className="relative mb-2">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-night-950 outline-none focus:border-brand pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
            <input
              type="checkbox"
              checked={revokeOtherSessions}
              onChange={(e) => setRevokeOtherSessions(e.target.checked)}
              className="rounded border-gray-600 bg-night-900 text-brand focus:ring-brand focus:ring-offset-night-800"
            />
            Log out from all other devices
          </label>
          <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-brand">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Login"}
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          No account?{" "}
          <Link to="/signup" className="text-brand hover:underline">
            Create your home
          </Link>
        </p>
      </form>

      {activeSessionsData.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-brand/20 bg-night-800 p-6 shadow-2xl">
            <h3 className="mb-2 text-xl font-bold">Device Limit Reached</h3>
            <p className="mb-4 text-sm text-gray-400">
              You are logged in on the maximum number of devices. Please log out of one below to continue.
            </p>
            <div className="mb-4 max-h-[300px] overflow-y-auto space-y-3">
              {activeSessionsData.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-brand/10 bg-night-900 p-3">
                  <div>
                    <p className="text-sm font-semibold">{s.deviceInfo || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">IP: {s.ipAddress}</p>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    disabled={loading}
                    className="rounded bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setActiveSessionsData([]);
                  setError('');
                }}
                className="flex-1 rounded-lg bg-gray-700 py-3 text-sm font-semibold text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={(e) => handleSubmit(e)}
                disabled={activeSessionsData.length >= 3 || loading}
                className="flex-1 rounded-lg bg-brand py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "Working…" : "Login"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
