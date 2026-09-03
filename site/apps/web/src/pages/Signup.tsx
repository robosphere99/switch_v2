import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Home } from "lucide-react";
import { signup } from "../api/auth";
import { extractApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { applyAccountTheme } from "../lib/themeAccount";
import { Logo } from "../components/Logo";

export function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [homeName, setHomeName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signup({
        username,
        email,
        password,
        ...(homeName.trim() ? { homeName: homeName.trim() } : {}),
      });
      if (res.success) {
        setAuth(res.data);
        applyAccountTheme(res.data.user);
        navigate("/dashboard");
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
    <div className="page-enter flex min-h-[85vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card-static p-8 sm:p-10">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <Logo size="lg" />
            <div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Create Your Home
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Start your smart home journey in seconds.
              </p>
            </div>
          </div>

          {error && <div className="alert-error mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="input-field"
                placeholder="yourname"
              />
            </div>

            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                  minLength={6}
                  className="input-field pr-12"
                  placeholder="Min. 6 characters"
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

            <div>
              <label className="field-label">Home Name (optional)</label>
              <div className="relative">
                <input
                  value={homeName}
                  onChange={(e) => setHomeName(e.target.value)}
                  placeholder="e.g. Sharma Family Home"
                  className="input-field pl-10"
                />
                <Home className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">You can change this later from settings.</p>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? "Creating account…" : (
                <>
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
