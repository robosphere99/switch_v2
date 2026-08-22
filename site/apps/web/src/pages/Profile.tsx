import { useState } from "react";
import { Monitor, Moon, Save, Sun, User } from "lucide-react";
import { updateProfile } from "../api/auth";
import { extractApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { getThemeMode } from "../lib/theme";
import { changeTheme } from "../lib/themeAccount";
import type { ThemeMode } from "../lib/theme";

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

export function Profile() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [dob, setDob] = useState(user?.dob ? new Date(user.dob).toISOString().split('T')[0] : "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "+91 ");

  let initialAddr = { state: "", district: "", pin: "", landmark: "", street: "" };
  if (user?.address) {
    try {
      initialAddr = JSON.parse(user.address);
    } catch {
      initialAddr.street = user.address;
    }
  }
  const [addrState, setAddrState] = useState(initialAddr.state);
  const [addrDistrict, setAddrDistrict] = useState(initialAddr.district);
  const [addrPin, setAddrPin] = useState(initialAddr.pin);
  const [addrLandmark, setAddrLandmark] = useState(initialAddr.landmark);
  const [addrStreet, setAddrStreet] = useState(initialAddr.street);

  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getThemeMode());

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
        avatarUrl: avatarUrl || null,
        dob: dob || null,
        gender: gender || null,
        phone: phone || null,
        address: JSON.stringify({ state: addrState, district: addrDistrict, pin: addrPin, landmark: addrLandmark, street: addrStreet }),
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
    } catch (err) {
      setMessage({ ok: false, text: extractApiError(err).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const { api } = await import("../api/client");
      const res = await api.post("/auth/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success) {
        setAvatarUrl(res.data.data.avatarUrl);
        setAuth({ accessToken: accessToken!, refreshToken: refreshToken!, user: res.data.data });
        setMessage({ ok: true, text: "✓ Avatar uploaded" });
      }
    } catch (err) {
      setMessage({ ok: false, text: "Failed to upload avatar" });
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-8 flex items-center justify-center gap-2 text-center text-3xl font-bold">
        <User className="h-8 w-8 text-brand" /> My Profile
      </h1>

      {message && (
        <p
          className={`mb-4 rounded px-4 py-2 text-sm ${message.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
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
        <div className="mb-4 flex items-center justify-between rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-500">User ID</div>
            <div className="text-xs text-gray-600">Support ko yeh ID batao — account turant milega</div>
          </div>
          <div className="rounded bg-brand/10 px-2.5 py-1 font-mono text-sm font-bold text-brand">#{user?.id ?? "—"}</div>
        </div>
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
          Personal details
        </h2>

        <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Profile Photo</label>
        <div className="flex items-center gap-4 mb-4">
          <img
            src={avatarUrl ? (avatarUrl.startsWith('http') ? avatarUrl : (import.meta.env.VITE_API_BASE_URL || '') + avatarUrl) : `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}`}
            className="w-16 h-16 rounded-full border border-brand/20 bg-night-900 object-cover"
            alt="Avatar"
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand text-gray-200"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-3 text-sm outline-none focus:border-brand text-gray-200 appearance-none bg-no-repeat"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto' }}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Phone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 123 456 7890"
          className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
        />

        <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Address Breakdown</label>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input
            value={addrState}
            onChange={(e) => setAddrState(e.target.value)}
            placeholder="State"
            className="w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <input
            value={addrDistrict}
            onChange={(e) => setAddrDistrict(e.target.value)}
            placeholder="District"
            className="w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <input
            value={addrPin}
            onChange={(e) => setAddrPin(e.target.value)}
            placeholder="PIN Code"
            className="w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <input
            value={addrLandmark}
            onChange={(e) => setAddrLandmark(e.target.value)}
            placeholder="Landmark"
            className="w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </div>
        <textarea
          value={addrStreet}
          onChange={(e) => setAddrStreet(e.target.value)}
          placeholder="Street Address..."
          rows={2}
          className="mb-6 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand resize-none"
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
          {loading ? (
            "Saving…"
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Changes
            </span>
          )}
        </button>
      </form>

      <div className="mt-6 rounded-2xl border border-brand/20 bg-night-800 p-8">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-500">
          Appearance
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Site ka theme choose karo — System me OS ki setting follow hoti hai.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                changeTheme(mode);
                setThemeModeState(mode);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${themeMode === mode
                ? "border-brand bg-brand text-white"
                : "border-brand/20 bg-night-900 text-gray-600 hover:border-brand hover:text-brand"
                }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
