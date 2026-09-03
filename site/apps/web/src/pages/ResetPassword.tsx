import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound, ArrowRight, ShieldCheck } from "lucide-react";
import { resetPassword } from "../api/auth";
import { extractApiError } from "../api/client";
import { Logo } from "../components/Logo";

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
      setError("Dono password match nahi kar rahe");
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
      <div className="page-enter flex min-h-[85vh] items-center justify-center px-4 py-12">
        <div className="card-static w-full max-w-md p-8 sm:p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 dark:bg-green-500/10">
            <ShieldCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">Password reset ho gaya!</h1>
          <p className="mb-6 text-sm text-gray-500">
            Ab naye password se login karo. Purane saare sessions logout ho gaye hain.
          </p>
          <Link to="/login" className="btn-primary inline-flex px-8 py-2.5">
            Login karo
            <ArrowRight className="h-4 w-4" />
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
                New password
              </h1>
              <p className="mt-1 text-sm text-gray-500">Naya password set karo (min 6 characters).</p>
            </div>
          </div>

          {!token && (
            <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              Reset link invalid hai — email se poora link copy karke kholo.
            </div>
          )}

          {error && <div className="alert-error mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
                className="input-field"
                placeholder="Min. 6 characters"
              />
            </div>

            <div>
              <label className="field-label">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="input-field"
                placeholder="Repeat your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="btn-primary w-full py-3 mt-2"
            >
              {loading ? "Resetting…" : (
                <>
                  Reset password
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/login" className="font-semibold text-brand hover:underline">
              ← Wapas login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
