import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Home } from "lucide-react";
import { signup } from "../api/auth";
import { extractApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { applyAccountTheme } from "../lib/themeAccount";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";

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
    <div className="page-enter flex min-h-[90vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-night-600/70 bg-white p-8 shadow-sm dark:border-night-600 dark:bg-night-800">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Logo size="lg" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-night-950 dark:text-white">
                Create your home
              </h1>
              <p className="mt-1 text-sm text-night-500 dark:text-gray-400">
                Start your smart home journey in seconds.
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
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              placeholder="yourname"
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />

            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Min. 6 characters"
              helperText="Choose a strong password with at least 6 characters."
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

            <Input
              label="Home Name (optional)"
              value={homeName}
              onChange={(e) => setHomeName(e.target.value)}
              placeholder="e.g. Sharma Family Home"
              helperText="You can rename this anytime from Settings."
              leftIcon={<Home className="h-4 w-4" />}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-2"
            >
              {!loading && "Create Account"}
              {!loading && <ArrowRight className="h-4 w-4 ml-auto" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-night-500 dark:text-gray-400">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
