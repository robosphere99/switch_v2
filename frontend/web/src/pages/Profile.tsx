import { useState } from "react";
import { Monitor, Moon, Sun, Upload } from "lucide-react";
import { updateProfile } from "../api/auth";
import { extractApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { getThemeMode } from "../lib/theme";
import { changeTheme } from "../lib/themeAccount";
import type { ThemeMode } from "../lib/theme";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

import { PHONE_PLACEHOLDER } from "../lib/constants";

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
        address: JSON.stringify({
          state: addrState,
          district: addrDistrict,
          pin: addrPin,
          landmark: addrLandmark,
          street: addrStreet,
        }),
      });
      if (res.success) {
        setAuth({ accessToken: accessToken!, refreshToken: refreshToken!, user: res.data });
        setCurrentPassword("");
        setNewPassword("");
        setMessage({ ok: true, text: "Profile changes saved successfully." });
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
        setMessage({ ok: true, text: "Profile avatar uploaded successfully." });
      }
    } catch {
      setMessage({ ok: false, text: "Failed to upload avatar image." });
    }
  }

  return (
    <div className="page-enter mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Account & Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your personal information, address preferences, security credentials, and theme.
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
        {/* Account Identity Section */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Account Details</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Primary login credentials and support reference</p>
            </div>
            <div className="rounded-xl bg-brand/10 dark:bg-brand/15 px-3 py-1 font-mono text-xs font-bold text-brand">
              ID #{user?.id ?? "—"}
            </div>
          </div>

          <div className="flex items-center gap-4 py-2">
            <img
              src={avatarUrl ? avatarUrl : `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}`}
              className="h-16 w-16 rounded-2xl border border-slate-200 bg-slate-100 object-cover dark:border-slate-700 dark:bg-slate-800"
              alt="Profile Avatar"
            />
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition">
                <Upload className="h-3.5 w-3.5" /> Upload New Photo
              </span>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
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

        {/* Personal Details Section */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Personal Details
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
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
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </Select>
          </div>

          <Input
            label="Mobile Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={PHONE_PLACEHOLDER}
          />

          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Default Shipping Address
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
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

      {/* Appearance & Theme Card */}
      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
