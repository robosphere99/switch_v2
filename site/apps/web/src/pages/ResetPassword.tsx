import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
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
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-brand/20 bg-night-800 p-10 text-center shadow-2xl">
          <div className="mb-4 flex justify-center">
            <KeyRound className="h-10 w-10 text-brand" />
          </div>
          <h1 className="mb-3 text-xl font-bold">✅ Password reset ho gaya</h1>
          <p className="mb-6 text-sm text-gray-400">
            Ab naye password se login karo. Purane saare sessions logout ho gaye hain.
          </p>
          <Link
            to="/login"
            className="inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:opacity-90"
          >
            Login karo
          </Link>
        </div>
      </div>
    );
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
            <KeyRound className="h-5 w-5 text-brand" />
            New password
          </h1>
          <p className="text-sm text-gray-500">Naya password set karo (min 6 characters).</p>
        </div>

        {!token && (
          <p className="mb-4 rounded bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
            Reset link invalid hai — email se poora link copy karke kholo.
          </p>
        )}

        {error && (
          <p className="mb-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
        )}

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          New Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoFocus
          className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-night-950 outline-none focus:border-brand"
        />

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          className="mb-6 w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-night-950 outline-none focus:border-brand"
        />

        <button
          type="submit"
          disabled={loading || !token}
          className="w-full rounded-lg bg-brand py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Resetting…" : "Reset password"}
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link to="/login" className="text-brand hover:underline">
            Wapas login
          </Link>
        </p>
      </form>
    </div>
  );
}
