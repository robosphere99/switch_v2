import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../api/auth";
import { useAuthStore } from "../stores/auth";

export function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const res = await signup({ username, email, password, homeName });
      if (res.success) {
        setAuth(res.data);
        navigate("/dashboard");
      } else {
        setError(res.error.message);
      }
    } catch (err) {
      setError("Connection error. Is the API running?");
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
        <h1 className="mb-8 text-center text-2xl font-bold">🏠 Create Your Home</h1>

        {error && (
          <p className="mb-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
        )}

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Username
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-night-950 outline-none focus:border-brand"
        />

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          minLength={6}
          className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-night-950 outline-none focus:border-brand"
        />

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Home Name (optional)
        </label>
        <input
          value={homeName}
          onChange={(e) => setHomeName(e.target.value)}
          placeholder="e.g. Sharma Family Home"
          className="mb-6 w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-night-950 outline-none focus:border-brand"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Creating…" : "Sign Up"}
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="text-brand hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
