import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MailCheck, MailOpen } from "lucide-react";
import { forgotPassword } from "../api/auth";
import { extractApiError } from "../api/client";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      if (res.success) {
        setSent(true);
      } else {
        setError(res.error.message);
      }
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="page-enter flex min-h-[90vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-night-600/70 bg-white p-8 shadow-sm text-center dark:border-night-600 dark:bg-night-800">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
              <MailCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-night-950 dark:text-white">
              Check your inbox
            </h1>
            <p className="mb-6 text-sm text-night-500 dark:text-gray-400 leading-relaxed">
              If <span className="font-semibold text-night-950 dark:text-gray-200">{email}</span> is
              registered, we've sent a reset link (valid 30 min). Check your spam folder too.
            </p>
            <Link to="/login" className="text-sm font-semibold text-brand hover:underline">
              ← Back to sign in
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
              <MailOpen className="h-6 w-6 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-night-950 dark:text-white">
                Reset your password
              </h1>
              <p className="mt-1 text-sm text-night-500 dark:text-gray-400">
                Enter your email and we'll send you a reset link.
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
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              {!loading && "Send reset link"}
              {!loading && <ArrowRight className="h-4 w-4 ml-auto" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-night-500 dark:text-gray-400">
            Remembered it?{" "}
            <Link to="/login" className="font-semibold text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
