import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { login } from "../api/auth";
import { extractApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { applyAccountTheme } from "../lib/themeAccount";
import { Logo } from "../components/Logo";

export function Login() {
  const [usernameEmail, setUsernameEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login({ usernameEmail, password });
      if (res.success) {
        setAuth(res.data);
        applyAccountTheme(res.data.user);
        navigate(res.data.user.role === "system_admin" ? "/admin" : "/dashboard");
      } else {
        setError(res.error.message);
      }
    } catch (err) {
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
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-6 w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-night-950 outline-none focus:border-brand"
        />

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
    </div>
  );
}
