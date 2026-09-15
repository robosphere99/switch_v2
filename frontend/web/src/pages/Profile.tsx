import { useCallback, useEffect, useState } from "react";
import { Clock, Globe, Laptop, LogOut, Monitor, Moon, RefreshCw, Save, ShieldCheck, Smartphone, Sun, Trash2, User } from "lucide-react";
import { getSessions, revokeAllSessions, revokeOtherSessions, revokeSession, updateProfile, type ActiveSession } from "../api/auth";
import { extractApiError } from "../api/client";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "../stores/auth";
import { getThemeMode } from "../lib/theme";
import { changeTheme } from "../lib/themeAccount";
import type { ThemeMode } from "../lib/theme";

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

function parseDeviceTitle(raw: string | null): { name: string; type: "desktop" | "mobile" } {
  if (!raw) return { name: "Web Browser", type: "desktop" };
  const lower = raw.toLowerCase();

  // Mobile App detection (React Native / Expo / OkHttp / CFNetwork / SwitchNest App)
  if (
    lower.includes("okhttp") ||
    lower.includes("switchnest") ||
    lower.includes("expo") ||
    lower.includes("cfnetwork") ||
    lower.includes("react-native") ||
    lower.includes("dart")
  ) {
    const isAndroid = lower.includes("android") || lower.includes("okhttp");
    return {
      name: isAndroid ? "SwitchNest Mobile App (Android)" : "SwitchNest Mobile App (iOS)",
      type: "mobile",
    };
  }

  const isMobile =
    lower.includes("mobile") ||
    lower.includes("android") ||
    lower.includes("iphone") ||
    lower.includes("ipad");

  let browser = "Browser";
  if (lower.includes("edg")) browser = "Edge";
  else if (lower.includes("brave")) browser = "Brave";
  else if (lower.includes("chrome")) browser = "Chrome";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("safari") && !lower.includes("chrome")) browser = "Safari";

  let os = isMobile ? "Mobile Device" : "Computer";
  if (lower.includes("windows")) os = "Windows PC";
  else if (lower.includes("mac os") || lower.includes("macintosh")) os = "Mac";
  else if (lower.includes("linux") && !lower.includes("android")) os = "Linux";
  else if (lower.includes("android")) os = "Android Phone";
  else if (lower.includes("iphone")) os = "iPhone";
  else if (lower.includes("ipad")) os = "iPad";

  return { name: `${os} (${browser})`, type: isMobile ? "mobile" : "desktop" };
}

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

  // Active Sessions state
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionActionBusy, setSessionActionBusy] = useState<number | 'all' | 'other' | null>(null);

  const currentSessionId = (() => {
    if (!accessToken) return null;
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      return typeof payload.sid === "number" ? payload.sid : null;
    } catch {
      return null;
    }
  })();

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await getSessions();
      if (res.success && Array.isArray(res.data)) {
        setSessions(res.data);
      }
    } catch {
      // ignore
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const socket = getSocket();
    const onSessionsChanged = () => fetchSessions();
    socket.on("auth:sessions_changed", onSessionsChanged);
    return () => {
      socket.off("auth:sessions_changed", onSessionsChanged);
    };
  }, [fetchSessions]);

  async function handleRevokeSession(sessionId: number) {
    setSessionActionBusy(sessionId);
    try {
      const res = await revokeSession(sessionId);
      if (res.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch (err) {
      alert(extractApiError(err).message);
    } finally {
      setSessionActionBusy(null);
    }
  }

  async function handleRevokeOther() {
    if (!confirm("Are you sure you want to log out of all other devices?")) return;
    setSessionActionBusy('other');
    try {
      const res = await revokeOtherSessions();
      if (res.success) {
        await fetchSessions();
      }
    } catch (err) {
      alert(extractApiError(err).message);
    } finally {
      setSessionActionBusy(null);
    }
  }

  async function handleRevokeAll() {
    if (!confirm("Are you sure you want to log out of all devices including this one?")) return;
    setSessionActionBusy('all');
    try {
      await revokeAllSessions();
      useAuthStore.getState().logout();
    } catch (err) {
      alert(extractApiError(err).message);
      setSessionActionBusy(null);
    }
  }

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
    <div className="page-enter mx-auto max-w-lg px-4 py-8">
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
            src={avatarUrl ? avatarUrl : `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}`}
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

      {/* Active Sessions & Logged in Devices */}
      <div className="mt-6 rounded-2xl border border-brand/20 bg-night-800 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Active Sessions &amp; Devices</h2>
              <p className="text-xs text-gray-500">Devices currently logged into your SwitchNest account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchSessions}
            disabled={sessionsLoading}
            className="rounded-lg p-2 text-gray-400 hover:bg-night-700 hover:text-brand transition-colors"
            title="Refresh sessions"
          >
            <RefreshCw className={`h-4 w-4 ${sessionsLoading ? "animate-spin text-brand" : ""}`} />
          </button>
        </div>

        {/* Sessions list */}
        <div className="space-y-3">
          {(() => {
            const displaySessions: ActiveSession[] = sessions.length > 0 ? sessions : [
              {
                id: currentSessionId ?? -1,
                deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent : "Web Browser",
                ipAddress: "Current Session",
                lastActive: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              }
            ];

            return displaySessions.map((s, idx) => {
              const dev = parseDeviceTitle(s.deviceInfo);
              const DevIcon = dev.type === "mobile" ? Smartphone : Laptop;
              const isCurrent = currentSessionId ? s.id === currentSessionId : (s.id === -1 || idx === 0);

              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                    isCurrent
                      ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-gray-100 dark:border-night-700 bg-night-900/60 hover:border-brand/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isCurrent ? "bg-emerald-500/20 text-emerald-400" : "bg-brand/10 text-brand"}`}>
                      <DevIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {dev.name}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            This Device
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-0.5">
                        {s.ipAddress && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Globe className="h-3 w-3 text-gray-500" />
                            {s.ipAddress}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-500" />
                          {new Date(s.lastActive || s.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isCurrent && s.id > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(s.id)}
                      disabled={sessionActionBusy === s.id}
                      className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                    >
                      {sessionActionBusy === s.id ? "Logging out…" : "Log Out"}
                    </button>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {/* Bulk Action Buttons */}
        {sessions.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2.5 pt-4 border-t border-gray-100 dark:border-night-700">
            <button
              type="button"
              onClick={handleRevokeOther}
              disabled={sessionActionBusy !== null}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500 hover:text-white transition disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              {sessionActionBusy === 'other' ? "Logging out others…" : "Log Out Other Devices"}
            </button>
            <button
              type="button"
              onClick={handleRevokeAll}
              disabled={sessionActionBusy !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500 hover:text-white transition disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {sessionActionBusy === 'all' ? "Logging out all…" : "Log Out All"}
            </button>
          </div>
        )}
      </div>

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
