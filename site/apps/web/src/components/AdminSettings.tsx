import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { getAdminSettings, updateAdminSettings } from "../api/admin";
import { updateProfile } from "../api/auth";
import { useAuthStore } from "../stores/auth";
import { applyBrandColor, useSiteStore } from "../stores/site";

const BRAND_PRESETS = [
  { hex: "#2563eb", name: "Blue" },
  { hex: "#0d9488", name: "Teal" },
  { hex: "#7c3aed", name: "Purple" },
  { hex: "#ea580c", name: "Orange" },
  { hex: "#dc2626", name: "Red" },
  { hex: "#059669", name: "Green" },
  { hex: "#db2777", name: "Pink" },
  { hex: "#0f766e", name: "Dark Teal" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function AdminSettings() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const siteApply = useSiteStore((s) => s.apply);
  const [saved, setSaved] = useState<string | null>(null);

  // Site settings form state
  const settings = useQuery({ queryKey: ["admin-settings"], queryFn: getAdminSettings });
  const s = settings.data?.success ? settings.data.data : null;
  const [form, setForm] = useState<{
    siteName: string;
    supportEmail: string;
    supportPhone: string;
    supportAddress: string;
    supportHours: string;
    brandColor: string;
  } | null>(null);
  const current = form ?? {
    siteName: s?.siteName ?? "",
    supportEmail: s?.supportEmail ?? "",
    supportPhone: s?.supportPhone ?? "",
    supportAddress: s?.supportAddress ?? "",
    supportHours: s?.supportHours ?? "",
    brandColor: s?.brandColor ?? "#2563eb",
  };

  // Live preview — color choose karte hi poora site re-color ho jaye (Save se pehle)
  useEffect(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(current.brandColor)) applyBrandColor(current.brandColor);
  }, [current.brandColor]);

  const saveSettings = useMutation({
    mutationFn: () =>
      updateAdminSettings({
        siteName: current.siteName,
        supportEmail: current.supportEmail,
        supportPhone: current.supportPhone,
        supportAddress: current.supportAddress,
        supportHours: current.supportHours,
        brandColor: current.brandColor,
      }),
    onSuccess: (res) => {
      if (res.success) {
        siteApply(res.data as unknown as Parameters<typeof siteApply>[0]);
        setForm(null);
        setSaved("Site settings save ho gayi — poore site pe live apply. ✅");
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      }
    },
    onError: () => setSaved("Save fail — dobara try karo."),
  });

  // Admin account — password change
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const changePw = useMutation({
    mutationFn: () => updateProfile({ currentPassword: pw.current, newPassword: pw.next }),
    onSuccess: (res) => {
      if (res.success) {
        setPw({ current: "", next: "", confirm: "" });
        setPwMsg({ ok: true, text: "Password change ho gaya. ✅" });
      } else {
        setPwMsg({ ok: false, text: res.error.message });
      }
    },
    onError: (e) => setPwMsg({ ok: false, text: String((e as Error).message ?? e) }),
  });

  const saveBusy = saveSettings.isPending;

  return (
    <div className="space-y-6">
      {saved && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          {saved}
        </div>
      )}

      {/* Appearance — brand color */}
      <Section title="🎨 Site theme (brand color)">
        <p className="mb-4 text-sm text-gray-500">
          Poora site (buttons, links, highlights) isi color pe chalta hai — choose karo aur{" "}
          <b>Save</b> dabao. Save se pehle hi live preview dikhega.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {BRAND_PRESETS.map((p) => (
            <button
              key={p.hex}
              onClick={() => setForm({ ...current, brandColor: p.hex })}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition hover:scale-110"
              style={{ backgroundColor: p.hex, borderColor: current.brandColor === p.hex ? "#fff" : "transparent" }}
              title={p.name}
            >
              {current.brandColor === p.hex && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-night-900 px-3 py-2 text-sm">
            <Palette className="h-4 w-4 text-gray-500" />
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(current.brandColor) ? current.brandColor : "#2563eb"}
              onChange={(e) => setForm({ ...current, brandColor: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-transparent"
            />
            <input
              value={current.brandColor}
              onChange={(e) => setForm({ ...current, brandColor: e.target.value })}
              placeholder="#RRGGBB"
              className="w-24 rounded border border-gray-300 bg-night-900 px-2 py-1 font-mono text-xs outline-none focus:border-brand"
            />
          </label>
        </div>
      </Section>

      {/* Site info */}
      <Section title="🏪 Site info (support details)">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Site name</span>
            <input
              value={current.siteName}
              onChange={(e) => setForm({ ...current, siteName: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Support email</span>
            <input
              value={current.supportEmail}
              onChange={(e) => setForm({ ...current, supportEmail: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Support phone / WhatsApp</span>
            <input
              value={current.supportPhone}
              onChange={(e) => setForm({ ...current, supportPhone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Support hours</span>
            <input
              value={current.supportHours}
              onChange={(e) => setForm({ ...current, supportHours: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Support address</span>
            <input
              value={current.supportAddress}
              onChange={(e) => setForm({ ...current, supportAddress: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => saveSettings.mutate()}
            disabled={saveBusy}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
          >
            {saveBusy ? "Saving…" : "💾 Save settings"}
          </button>
          {form && (
            <button
              onClick={() => setForm(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Reset
            </button>
          )}
        </div>
      </Section>

      {/* Admin account */}
      <Section title="🔐 Admin account">
        <div className="mb-4 rounded-lg border border-gray-200 bg-night-900 px-4 py-3 text-sm">
          <p>
            <span className="text-gray-500">Username:</span>{" "}
            <span className="font-semibold">{user?.username}</span>
          </p>
          <p className="mt-0.5">
            <span className="text-gray-500">Email:</span>{" "}
            <span className="font-semibold">{user?.email}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            User management ke liye <b>Users</b> tab dekho.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <input
            type="password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
            placeholder="Current password"
            className="rounded-lg border border-gray-300 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <input
            type="password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            placeholder="New password (min 6)"
            className="rounded-lg border border-gray-300 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <input
            type="password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            placeholder="Confirm new password"
            className="rounded-lg border border-gray-300 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        {pwMsg && (
          <p className={`mt-3 text-sm ${pwMsg.ok ? "text-emerald-600" : "text-red-500"}`}>{pwMsg.text}</p>
        )}
        <button
          onClick={() => {
            if (pw.next.length < 6) {
              setPwMsg({ ok: false, text: "Naya password kam se kam 6 characters ka ho." });
              return;
            }
            if (pw.next !== pw.confirm) {
              setPwMsg({ ok: false, text: "Confirm password match nahi kar raha." });
              return;
            }
            setPwMsg(null);
            changePw.mutate();
          }}
          disabled={changePw.isPending || !pw.current || !pw.next}
          className="mt-4 rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 transition hover:border-brand hover:text-brand disabled:opacity-40"
        >
          {changePw.isPending ? "Changing…" : "Change password"}
        </button>
      </Section>
    </div>
  );
}
