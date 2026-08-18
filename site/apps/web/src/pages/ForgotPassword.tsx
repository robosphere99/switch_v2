import { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";
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
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-brand/20 bg-night-800 p-10 text-center shadow-2xl">
          <div className="mb-4 flex justify-center">
            <KeyRound className="h-10 w-10 text-brand" />
          </div>
          <h1 className="mb-3 text-xl font-bold">📧 Check your email</h1>
          <p className="mb-6 text-sm text-gray-400">
            Agar <b className="text-gray-200">{email}</b> se koi account registered hai to
            humne password reset link bhej diya hai (30 min valid). Agar email nahi
            mila to spam folder check karo.
          </p>
          <Link to="/login" className="text-sm text-brand hover:underline">
            ← Wapas login
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
            Forgot password?
          </h1>
          <p className="text-sm text-gray-500">
            Apna registered email daalo — hum reset link bhej denge.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
        )}

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          className="mb-6 w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-night-950 outline-none focus:border-brand"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          Yaad aa gaya?{" "}
          <Link to="/login" className="text-brand hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
