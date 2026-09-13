import { useState } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { KeyRound, ArrowRight, ShieldCheck } from "lucide-react";
import { resetPassword } from "../api/auth";
import { extractApiError } from "../api/client";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match. Please try again.");
      return;
    }
    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      if (res.success) {
        setDone(true);
      } else {
        setError(res.error.message);
      }
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="page-enter flex min-h-[90vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-night-600/70 bg-white p-8 shadow-sm text-center dark:border-night-600 dark:bg-night-800">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
              <ShieldCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-night-950 dark:text-white">
              Password reset!
            </h1>
            <p className="mb-6 text-sm text-night-500 dark:text-gray-400 leading-relaxed">
              Your password has been changed. All previous sessions have been signed out.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-8 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-105"
            >
              Sign in now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter flex min-h-[90vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-night-600/70 bg-white p-8 shadow-sm dark:border-night-600 dark:bg-night-800">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Logo size="lg" />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10">
              <KeyRound className="h-6 w-6 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-night-950 dark:text-white">
                Set new password
              </h1>
              <p className="mt-1 text-sm text-night-500 dark:text-gray-400">
                Choose a secure password (min. 6 characters).
              </p>
            </div>
          </div>

          {!token && (
            <div className="mb-5">
              <Alert variant="warning">
                Invalid reset link. Please open the full link from your email.
              </Alert>
            </div>
          )}

          {error && (
            <div className="mb-5">
              <Alert variant="danger">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
              autoComplete="new-password"
              placeholder="Min. 6 characters"
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Repeat your password"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={!token}
              className="w-full mt-2"
            >
              {!loading && "Reset password"}
              {!loading && <ArrowRight className="h-4 w-4 ml-auto" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-night-500 dark:text-gray-400">
            <Link to="/login" className="font-semibold text-brand hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
