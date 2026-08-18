import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, Check, Eye, Mail, Palette, Send } from "lucide-react";
import { getAdminSettings, updateAdminSettings, testAdminEmail, testAdminAi, resetSite } from "../api/admin";
import { updateProfile } from "../api/auth";
import { useAuthStore } from "../stores/auth";
import { useSiteStore } from "../stores/site";
import { Modal } from "./Modal";

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
    siteUrl: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    smtpFrom: string;
    smtpSecure: boolean;
    aiProvider: string;
    aiApiKey: string;
    aiBaseUrl: string;
    aiModel: string;
  } | null>(null);
  const current = form ?? {
    siteName: s?.siteName ?? "",
    supportEmail: s?.supportEmail ?? "",
    supportPhone: s?.supportPhone ?? "",
    supportAddress: s?.supportAddress ?? "",
    supportHours: s?.supportHours ?? "",
    brandColor: s?.brandColor ?? "#2563eb",
    siteUrl: s?.siteUrl ?? "",
    smtpHost: s?.smtpHost ?? "",
    smtpPort: s?.smtpPort || 587,
    smtpUser: s?.smtpUser ?? "",
    smtpPass: "",
    smtpFrom: s?.smtpFrom ?? "",
    smtpSecure: s?.smtpSecure ?? false,
    aiProvider: s?.aiProvider ?? "",
    aiApiKey: "",
    aiBaseUrl: s?.aiBaseUrl ?? "",
    aiModel: s?.aiModel ?? "",
  };
  const smtpPassSet = s?.smtpPassSet ?? false;
  const aiApiKeySet = s?.aiApiKeySet ?? false;

  // Theme preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);

  const saveSettings = useMutation({
    mutationFn: () =>
      updateAdminSettings({
        siteName: current.siteName,
        supportEmail: current.supportEmail,
        supportPhone: current.supportPhone,
        supportAddress: current.supportAddress,
        supportHours: current.supportHours,
        brandColor: current.brandColor,
        siteUrl: current.siteUrl,
        smtpHost: current.smtpHost,
        smtpPort: current.smtpPort,
        smtpUser: current.smtpUser,
        // Naya pass type kiya ho tabhi bhejo — blank = purana rakho
        ...(current.smtpPass ? { smtpPass: current.smtpPass } : {}),
        smtpFrom: current.smtpFrom,
        smtpSecure: current.smtpSecure,
        // AI config — env ke bajaye UI se
        aiProvider: (current.aiProvider || "") as "openai" | "gemini" | "ollama" | "",
        ...(current.aiApiKey ? { aiApiKey: current.aiApiKey } : {}),
        aiBaseUrl: current.aiBaseUrl,
        aiModel: current.aiModel,
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

  // Email test — SMTP settings verify
  const [mailMsg, setMailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const testMail = useMutation({
    mutationFn: () => testAdminEmail(),
    onSuccess: (res) => {
      if (res.success) {
        setMailMsg({ ok: true, text: "Test email bhej diya — inbox check karo. ✅" });
      } else {
        setMailMsg({ ok: false, text: res.error.message });
      }
    },
    onError: (e) => {
      const anyE = e as { response?: { data?: { error?: { message?: string } } } };
      const msg = anyE.response?.data?.error?.message ?? String((e as Error).message ?? e);
      setMailMsg({ ok: false, text: msg });
    },
  });

  // AI test — config verify (chhota completion call)
  const [aiMsg, setAiMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const testAi = useMutation({
    mutationFn: () => testAdminAi(),
    onSuccess: (res) => {
      if (res.success) {
        setAiMsg({ ok: true, text: `AI sahi chal raha hai ✅ (${res.data.provider} · ${res.data.model}) — reply: "${res.data.reply}"` });
      } else {
        setAiMsg({ ok: false, text: res.error.message });
      }
    },
    onError: (e) => {
      const anyE = e as { response?: { data?: { error?: { message?: string } } } };
      const msg = anyE.response?.data?.error?.message ?? String((e as Error).message ?? e);
      setAiMsg({ ok: false, text: msg });
    },
  });

  // Admin account — password change
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Admin account — email change
  const setUser = useAuthStore((s) => s.setUser);
  const [emailEdit, setEmailEdit] = useState(false);
  const [emailVal, setEmailVal] = useState(user?.email ?? "");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const changeEmail = useMutation({
    mutationFn: () => updateProfile({ email: emailVal }),
    onSuccess: (res) => {
      if (res.success) {
        setUser(res.data);
        setEmailEdit(false);
        setEmailMsg({ ok: true, text: "Email update ho gaya. ✅" });
      } else {
        setEmailMsg({ ok: false, text: res.error.message });
      }
    },
    onError: (e) => setEmailMsg({ ok: false, text: String((e as Error).message ?? e) }),
  });
  const [resetMode, setResetMode] = useState<"data" | "factory">("data");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const reset = useMutation({
    mutationFn: () => resetSite(resetMode),
    onSuccess: (res) => {
      if (res.success) {
        if (res.data.mode === "factory") {
          // Sab clear (admin bhi) — logout + setup screen
          useAuthStore.getState().logout();
          window.location.href = "/";
        } else {
          setResetConfirm("");
          setResetMsg({ ok: true, text: res.data.message });
          queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
        }
      } else {
        setResetMsg({ ok: false, text: res.error.message });
      }
    },
    onError: (e) => setResetMsg({ ok: false, text: String((e as Error).message ?? e) }),
  });
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
          Poora site isi color pe chalta hai. Color choose karo,{" "}
          <b>Preview</b> se pehle dekho, phir <b>Save</b> dabao — confirm ke baad poore
          site pe apply hoga.
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
          <button
            onClick={() => setPreviewOpen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-500 transition hover:border-brand hover:text-brand"
            title="Is color ka poora theme preview dekho"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>
      </Section>

      {/* Theme preview modal — selected color ka poora site mock (Save se pehle) */}
      {previewOpen && (
        <Modal title={`🎨 Theme preview — ${current.brandColor}`} onClose={() => setPreviewOpen(false)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-night-900 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white"
                    style={{ backgroundColor: current.brandColor }}
                  >
                    S
                  </span>
                  <div>
                    <p className="text-sm font-bold">SwitchNest</p>
                    <p className="text-[10px] text-gray-500">Smart Home Platform</p>
                  </div>
                </div>
                <button
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: current.brandColor }}
                >
                  Login
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-night-900 p-4 text-center">
              <p className="text-base font-bold">Welcome to SwitchNest</p>
              <p className="mt-1 text-xs text-gray-500">Control all your IoT devices from one powerful dashboard.</p>
              <button
                className="mt-3 rounded-lg px-5 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: current.brandColor }}
              >
                Create Your Home
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 bg-night-900 p-3">
                <p className="text-xs font-semibold text-gray-500">Living Room Light</p>
                <span className="mt-2 flex h-7 w-12 items-center rounded-full p-1" style={{ backgroundColor: current.brandColor }}>
                  <span className="ml-auto h-5 w-5 rounded-full bg-white shadow" />
                </span>
              </div>
              <div className="rounded-xl border border-gray-200 bg-night-900 p-3">
                <p className="text-xs font-semibold text-gray-500">Order status</p>
                <span
                  className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ backgroundColor: `${current.brandColor}22`, color: current.brandColor }}
                >
                  Delivered
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

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
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Site URL (emails me link ke liye)</span>
            <input
              value={current.siteUrl}
              onChange={(e) => setForm({ ...current, siteUrl: e.target.value })}
              placeholder="https://onlineswitch.bhartitechnical.com"
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
            onClick={() => {
              // Theme color change ho to confirm — poora site apply hoga
              const savedColor = settings.data?.success ? settings.data.data.brandColor : null;
              if (current.brandColor !== savedColor) {
                if (!confirm("Naya theme color poore site pe apply hoga — confirm karein?")) return;
              }
              saveSettings.mutate();
            }}
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

      {/* Email (SMTP) — support replies ke liye */}
      <Section title="📧 Email notifications (SMTP)">
        <p className="mb-4 text-sm text-gray-500">
          Jab admin support chat me reply karta hai, user ko email jata hai (agar SMTP set ho).
          Koi bhi SMTP provider use karo (Gmail app password, Zoho, Hostinger…) — host/user/pass daalo,
          Save karo, phir <b>Test email</b> se verify karo.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">SMTP host</span>
            <input
              value={current.smtpHost}
              onChange={(e) => setForm({ ...current, smtpHost: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Port</span>
            <input
              type="number"
              value={current.smtpPort}
              onChange={(e) => setForm({ ...current, smtpPort: Number(e.target.value) || 587 })}
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Username</span>
            <input
              value={current.smtpUser}
              onChange={(e) => setForm({ ...current, smtpUser: e.target.value })}
              placeholder="you@gmail.com"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Password</span>
            <input
              type="password"
              value={current.smtpPass}
              onChange={(e) => setForm({ ...current, smtpPass: e.target.value })}
              placeholder={smtpPassSet ? "•••••••• (set hai — blank chhodo to wahi rahega)" : "SMTP password / app password"}
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">From email</span>
            <input
              value={current.smtpFrom}
              onChange={(e) => setForm({ ...current, smtpFrom: e.target.value })}
              placeholder="support@switchnest.in (blank = support email)"
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={current.smtpSecure}
              onChange={(e) => setForm({ ...current, smtpSecure: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span>
              SSL/TLS (port 465) — <span className="text-gray-500">off rahega to STARTTLS (587) try hoga</span>
            </span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => testMail.mutate()}
            disabled={testMail.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/20 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            {testMail.isPending ? "Bhej raha hai…" : "Test email bhejo"}
          </button>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Mail className="h-3.5 w-3.5" /> Aapke email pe jayega
          </span>
        </div>
        {mailMsg && (
          <p className={`mt-3 text-sm ${mailMsg.ok ? "text-emerald-600" : "text-red-500"}`}>{mailMsg.text}</p>
        )}
      </Section>

      {/* AI assistant — Phase 7 provider config (UI se, env ke bajaye) */}
      <Section title="🤖 AI Assistant (OpenAI / Gemini / Ollama)">
        <p className="mb-4 text-sm text-gray-500">
          Assistant page ka conversational reply isi config se chalta hai (rule-based parser ka
          LLM upgrade). Provider + model + API key daalo, Save karo, phir <b>Test AI</b> se verify
          karo. Key <b>encrypted</b> store hoti hai — kabhi wapas nahi dikhti. Ollama me API key
          optional hai (local). Blank chhodo to purani values rahengi.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Provider</span>
            <select
              value={current.aiProvider}
              onChange={(e) => setForm({ ...current, aiProvider: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            >
              <option value="">Off (rule-based assistant)</option>
              <option value="openai">OpenAI (GPT)</option>
              <option value="gemini">Gemini (Google)</option>
              <option value="ollama">Ollama (local)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Model</span>
            <input
              value={current.aiModel}
              onChange={(e) => setForm({ ...current, aiModel: e.target.value })}
              placeholder="gpt-4o-mini · gemini-2.0-flash · llama3.2"
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">API key</span>
            <input
              type="password"
              value={current.aiApiKey}
              onChange={(e) => setForm({ ...current, aiApiKey: e.target.value })}
              placeholder={aiApiKeySet ? "•••••••• (set hai — blank chhodo to wahi rahega)" : "sk-... (Ollama me optional)"}
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Base URL (optional)</span>
            <input
              value={current.aiBaseUrl}
              onChange={(e) => setForm({ ...current, aiBaseUrl: e.target.value })}
              placeholder="blank = provider default (OpenAI/Gemini/Ollama)"
              className="w-full rounded-lg border border-gray-300 bg-night-900 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setAiMsg(null);
              saveSettings.mutate();
            }}
            disabled={saveBusy}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
          >
            {saveBusy ? "Saving…" : "💾 Save AI config"}
          </button>
          <button
            onClick={() => testAi.mutate()}
            disabled={testAi.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/20 disabled:opacity-40"
          >
            <Bot className="h-3.5 w-3.5" />
            {testAi.isPending ? "Test ho raha hai…" : "Test AI"}
          </button>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            {current.aiProvider && current.aiModel ? (
              <span className="text-emerald-600">● Configured ({current.aiProvider})</span>
            ) : (
              <span className="text-gray-500">○ Rule-based mode (LLM off)</span>
            )}
          </span>
        </div>
        {aiMsg && <p className={`mt-3 text-sm ${aiMsg.ok ? "text-emerald-600" : "text-red-500"}`}>{aiMsg.text}</p>}
      </Section>

      {/* Admin account */}
      <Section title="🔐 Admin account">
        <div className="mb-4 rounded-lg border border-gray-200 bg-night-900 px-4 py-3 text-sm">
          <p>
            <span className="text-gray-500">Username:</span>{" "}
            <span className="font-semibold">{user?.username}</span>
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-gray-500">Email:</span>
            {emailEdit ? (
              <input
                type="email"
                value={emailVal}
                onChange={(e) => setEmailVal(e.target.value)}
                autoFocus
                className="w-full max-w-xs rounded-lg border border-gray-300 bg-night-900 px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
            ) : (
              <span className="font-semibold">{user?.email}</span>
            )}
            <button
              onClick={() => {
                setEmailEdit((v) => !v);
                setEmailVal(user?.email ?? "");
                setEmailMsg(null);
              }}
              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-500 transition hover:border-brand hover:text-brand"
              title={emailEdit ? "Cancel" : "Email edit karo"}
            >
              {emailEdit ? "Cancel" : "✏️ Edit"}
            </button>
            {emailEdit && (
              <button
                onClick={() => {
                  if (!emailVal.includes("@") || !emailVal.includes(".")) {
                    setEmailMsg({ ok: false, text: "Sahi email daalo (jaise naam@example.com)." });
                    return;
                  }
                  setEmailMsg(null);
                  changeEmail.mutate();
                }}
                disabled={changeEmail.isPending || !emailVal.trim()}
                className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
              >
                {changeEmail.isPending ? "Saving…" : "Save email"}
              </button>
            )}
          </div>
          {emailMsg && (
            <p className={`mt-2 text-xs ${emailMsg.ok ? "text-emerald-600" : "text-red-500"}`}>{emailMsg.text}</p>
          )}
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

      <Section title="☢️ Danger Zone — Reset site">
        <p className="mb-3 text-sm text-gray-500">
          Test data / testing ke baad site ko fresh karna ho to yahan se kar sakte ho.
          Confirm ke liye neeche <b>RESET</b> type karo.
        </p>
        <div className="mb-3 flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={resetMode === "data"} onChange={() => setResetMode("data")} className="accent-brand" />
            <span><b>Data reset</b> — saare users/devices/orders/notifications/support clear; admin + product catalog rahenge (recommended)</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={resetMode === "factory"} onChange={() => setResetMode("factory")} className="accent-brand" />
            <span><b>Factory reset</b> — SAB kuch clear (admin bhi) → fresh install wizard se setup</span>
          </label>
        </div>
        <input
          value={resetConfirm}
          onChange={(e) => setResetConfirm(e.target.value)}
          placeholder={'Confirm ke liye "RESET" type karo'}
          className="mb-3 w-full max-w-xs rounded-lg border border-gray-300 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        {resetMsg && (
          <p className={`mb-3 text-sm ${resetMsg.ok ? "text-emerald-600" : "text-red-500"}`}>{resetMsg.text}</p>
        )}
        <button
          onClick={() => {
            if (resetConfirm !== "RESET") {
              setResetMsg({ ok: false, text: 'Confirm field me exactly "RESET" likho.' });
              return;
            }
            setResetMsg(null);
            reset.mutate();
          }}
          disabled={reset.isPending || resetConfirm !== "RESET"}
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-5 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-500/20 disabled:opacity-40"
        >
          {reset.isPending ? "Resetting…" : resetMode === "factory" ? "☢️ Factory reset (sab kuch)" : "🧹 Reset data (test data)"}
        </button>
      </Section>
    </div>
  );
}
