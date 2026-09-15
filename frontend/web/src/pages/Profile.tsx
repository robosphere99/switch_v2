import { useCallback, useEffect, useState } from "react";
import { Clock, Globe, Laptop, LogOut, Monitor, Moon, RefreshCw, ShieldCheck, Smartphone, Sun, Trash2 } from "lucide-react";
import { getSessions, revokeAllSessions, revokeOtherSessions, revokeSession, updateProfile, type ActiveSession } from "../api/auth";
import { extractApiError } from "../api/client";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "../stores/auth";
import { getThemeMode } from "../lib/theme";
import { changeTheme } from "../lib/themeAccount";
import type { ThemeMode } from "../lib/theme";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { PHONE_PLACEHOLDER } from "../lib/constants";

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
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [dob, setDob] = useState(user?.dob ? new Date(user.dob).toISOString().split("T")[0] : "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");

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
        setAuth({ accessToken: accessToken!, refreshToken: refreshToken!, user: res.data });
        setCurrentPassword("");
        setNewPassword("");
        setMessage({ ok: true, text: "Profile updated successfully." });
      } else {
        setMessage({ ok: false, text: res.error.message });
      }
    } catch (err) {
      setMessage({ ok: false, text: extractApiError(err).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Account Profile & Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your personal details, home delivery address, active devices, and credentials.
        </p>
      </div>

      {message && (
        <div className="mb-6">
          <Alert variant={message.ok ? "success" : "danger"} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar and Identity */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Profile Identity
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              <div className="h-20 w-20 rounded-full border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-400 uppercase">
                    {(username || "U")[0]}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 w-full">
              <Input
                label="Avatar URL"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
              />
              <p className="mt-1 text-xs text-slate-500">Direct URL to your profile avatar image.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Username *"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              label="Email Address *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Personal Details */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Personal Information
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Date of Birth"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
            <Select
              label="Gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / Prefer not to say</option>
            </Select>
            <Input
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={PHONE_PLACEHOLDER}
            />
          </div>
        </div>

        {/* Delivery / Home Address */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Delivery & Home Address
          </h2>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="State"
                value={addrState}
                onChange={(e) => setAddrState(e.target.value)}
              />
              <Input
                placeholder="District / City"
                value={addrDistrict}
                onChange={(e) => setAddrDistrict(e.target.value)}
              />
              <Input
                placeholder="PIN Code"
                value={addrPin}
                onChange={(e) => setAddrPin(e.target.value)}
              />
              <Input
                placeholder="Landmark"
                value={addrLandmark}
                onChange={(e) => setAddrLandmark(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="Street address, house/flat number..."
              rows={2}
              value={addrStreet}
              onChange={(e) => setAddrStreet(e.target.value)}
            />
          </div>
        </div>

        {/* Security / Password Section */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Security & Password
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Required only to change password"
            />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep unchanged"
              minLength={6}
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={loading}
          loading={loading}
          className="w-full"
        >
          Save Profile Changes
        </Button>
      </form>

      {/* Active Sessions & Logged in Devices */}
      <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Active Sessions &amp; Devices</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Devices currently logged into your SwitchNest account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchSessions}
            disabled={sessionsLoading}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand transition-colors"
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
                      : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-brand/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isCurrent ? "bg-emerald-500/20 text-emerald-500" : "bg-brand/10 text-brand"}`}>
                      <DevIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {dev.name}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                            This Device
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                        {s.ipAddress && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Globe className="h-3 w-3 text-slate-400" />
                            {s.ipAddress}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
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
                      className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
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
          <div className="mt-5 flex flex-wrap gap-2.5 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={handleRevokeOther}
              disabled={sessionActionBusy !== null}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-500 hover:text-white transition disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              {sessionActionBusy === 'other' ? "Logging out others…" : "Log Out Other Devices"}
            </button>
            <button
              type="button"
              onClick={handleRevokeAll}
              disabled={sessionActionBusy !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-500 hover:text-white transition disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {sessionActionBusy === 'all' ? "Logging out all…" : "Log Out All"}
            </button>
          </div>
        )}
      </div>

      {/* Appearance & Theme Card */}
      <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          Interface Theme
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Choose your preferred theme mode or sync automatically with your device system preferences.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                changeTheme(mode);
                setThemeModeState(mode);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                themeMode === mode
                  ? "border-brand bg-brand text-white shadow-sm shadow-brand/25"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
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
