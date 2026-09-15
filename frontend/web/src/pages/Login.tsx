import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ArrowRight, Monitor } from "lucide-react";
import { login, revokeUnauth } from "../api/auth";
import { extractApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { applyAccountTheme } from "../lib/themeAccount";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";
import { Modal } from "../components/ui/Modal";

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
    <div className="page-enter flex min-h-[90vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-night-600/70 bg-white p-8 shadow-sm dark:border-night-600 dark:bg-night-800">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Logo size="lg" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-night-950 dark:text-white">
                Welcome back
              </h1>
              <p className="mt-1 text-sm text-night-500 dark:text-gray-400">
                Sign in to control your smart home.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-5">
              <Alert variant="danger">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username or Email"
              value={usernameEmail}
              onChange={(e) => setUsernameEmail(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              placeholder="you@example.com"
            />

            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-night-500 hover:text-brand transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-night-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={revokeOtherSessions}
                  onChange={(e) => setRevokeOtherSessions(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand/30"
                />
                Sign out all other devices
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-night-500 hover:text-brand transition-colors dark:text-gray-400 dark:hover:text-brand"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              icon={<Lock className="h-4 w-4" />}
              className="w-full mt-1"
            >
              Sign In
              {!loading && <ArrowRight className="h-4 w-4 ml-auto" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-night-500 dark:text-gray-400">
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-brand hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* Device limit modal */}
      <Modal
        isOpen={activeSessionsData.length > 0}
        onClose={() => { setActiveSessionsData([]); setError(""); }}
        title="Device Limit Reached"
        maxWidth="md"
      >
        <p className="text-sm text-night-500 dark:text-gray-400 mb-4">
          You're signed in on the maximum number of devices. Remove one below to continue.
        </p>
        <div className="space-y-2 max-h-[260px] overflow-y-auto thin-scrollbar mb-6">
          {activeSessionsData.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-night-600/60 p-3 dark:border-night-600"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Monitor className="h-4 w-4 text-night-500 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-night-950 dark:text-white">
                    {s.deviceInfo || "Unknown device"}
                  </p>
                  <p className="text-[11px] text-night-500">IP: {s.ipAddress}</p>
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                loading={loading}
                onClick={() => handleRevokeSession(s.id)}
                className="shrink-0 ml-3"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { setActiveSessionsData([]); setError(""); }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            loading={loading}
            disabled={activeSessionsData.length >= 3}
            onClick={(e) => handleSubmit(e as any)}
          >
            Sign In Anyway
          </Button>
        </div>
      </Modal>
    </div>
  );
}
