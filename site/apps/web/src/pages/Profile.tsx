import { useState } from "react";
import { updateProfile } from "../api/auth";
import { useAuthStore } from "../stores/auth";

export function Profile() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await updateProfile({
        username,
        email,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      if (res.success) {
        // Keep the updated user in the store (role is preserved by the API).
        setAuth({ accessToken: accessToken!, refreshToken: refreshToken!, user: res.data });
        setCurrentPassword("");
        setNewPassword("");
        setMessage({ ok: true, text: "✓ Profile updated" });
      } else {
        setMessage({ ok: false, text: res.error.message });
      }
    } catch {
      setMessage({ ok: false, text: "Connection error. Is the API running?" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-8 text-center text-3xl font-bold">👤 My Profile</h1>

      {message && (
        <p
          className={`mb-4 rounded px-4 py-2 text-sm ${
            message.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-brand/20 bg-night-800 p-8"
      >
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
          Account details
        </h2>
        <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
        <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-6 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
        />

        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
          Change password
        </h2>
        <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
          Current password
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Required only when setting a new password"
          className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
        <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
          New password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Leave blank to keep current"
          minLength={6}
          className="mb-6 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Saving…" : "💾 Save Changes"}
        </button>
      </form>
    </div>
  );
}
