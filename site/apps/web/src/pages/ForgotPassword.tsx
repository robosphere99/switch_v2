import { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, ArrowRight, MailCheck } from "lucide-react";
import { forgotPassword } from "../api/auth";
import { extractApiError } from "../api/client";
import { Logo } from "../components/Logo";

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
      <div className="page-enter flex min-h-[85vh] items-center justify-center px-4 py-12">
        <div className="card-static w-full max-w-md p-8 sm:p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
            <MailCheck className="h-7 w-7 text-brand" />
          </div>
          <h1 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">Check your email</h1>
          <p className="mb-6 text-sm text-gray-500">
            Agar <span className="font-semibold text-gray-700 dark:text-gray-200">{email}</span> se koi account registered hai to
            humne password reset link bhej diya hai (30 min valid). Agar email nahi
            mila to spam folder check karo.
          </p>
          <Link to="/login" className="text-sm font-semibold text-brand hover:underline">
            ← Wapas login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter flex min-h-[85vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card-static p-8 sm:p-10">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <Logo size="lg" />
            <div>
              <h1 className="mt-2 flex items-center justify-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
                <KeyRound className="h-5 w-5 text-brand" />
                Forgot password?
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Apna registered email daalo — hum reset link bhej denge.
              </p>
            </div>
          </div>

          {error && <div className="alert-error mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="input-field"
                placeholder="you@example.com"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Sending…" : (
                <>
                  Send reset link
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Yaad aa gaya?{" "}
            <Link to="/login" className="font-semibold text-brand hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
