import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
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
  const { user, setAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(user.role === "system_admin" ? "/admin" : "/dashboard", { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeSessionsData.length >= 3) return;
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
    <div className="page-enter flex min-h-[85vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="card-static p-8 sm:p-10">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <Logo size="lg" />
            <div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Sign in to your home
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome back! Enter your credentials below.
              </p>
            </div>
          </div>

          {error && <div className="alert-error mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Username or Email</label>
              <input
                value={usernameEmail}
                onChange={(e) => setUsernameEmail(e.target.value)}
                required
                autoFocus
                className="input-field"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="field-label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={revokeOtherSessions}
                  onChange={(e) => setRevokeOtherSessions(e.target.checked)}
                  className="rounded border-gray-300 text-brand focus:ring-brand/30"
                />
                Log out from all other devices
              </label>
              <Link to="/forgot-password" className="text-xs text-gray-400 hover:text-brand transition-colors">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Signing in…" : (
                <>
                  <Lock className="h-4 w-4" />
                  Login
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            No account?{" "}
            <Link to="/signup" className="font-semibold text-brand hover:underline">
              Create your home
            </Link>
          </p>
        </div>
      </div>

      {/* Device limit modal */}
      {activeSessionsData.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="card-static w-full max-w-md p-6">
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Device Limit Reached</h3>
            <p className="mb-4 text-sm text-gray-500">
              You are logged in on the maximum number of devices. Please log out of one below to continue.
            </p>
            <div className="mb-4 max-h-[300px] overflow-y-auto thin-scrollbar space-y-2">
              {activeSessionsData.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-3 dark:border-night-600">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.deviceInfo || "Unknown"}</p>
                    <p className="text-xs text-gray-400">IP: {s.ipAddress}</p>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    disabled={loading}
                    className="btn-danger px-3 py-1 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setActiveSessionsData([]); setError(""); }}
                className="btn-outline flex-1 py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={(e) => handleSubmit(e)}
                disabled={activeSessionsData.length >= 3 || loading}
                className="btn-primary flex-1 py-2.5"
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
