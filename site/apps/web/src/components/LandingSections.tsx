import { useState } from "react";
import { sendContact } from "../api/public";
import { useSiteStore } from "../stores/site";
import { ArrowRight, Mail, MapPin, Phone, Clock } from "lucide-react";

const STEPS = [
  {
    icon: "🛒",
    title: "Order the Board",
    desc: "Shop se apna board choose karo (2CH–8CH, dimmers, IR). WiFi name + password order pe de sakte ho — board pre-configured aayega.",
  },
  {
    icon: "📦",
    title: "Delivery + Serial",
    desc: "Box me unique serial code + QR sticker. Har board factory me flash aur relay self-test pass karke aata hai.",
  },
  {
    icon: "🔑",
    title: "Activate",
    desc: "QR scan karo ya serial code daalo — board aapke home se link ho jata hai. Sirf aap control kar sakte ho.",
  },
  {
    icon: "🎛️",
    title: "Control Everywhere",
    desc: "Dashboard, mobile, voice/AI assistant, timers — aur physical switch bhi kaam karta hai. WiFi se OTA updates, kabhi USB nahi.",
  },
];

const CONTACT_ICONS: Record<string, typeof Mail> = {
  Email: Mail,
  "Phone / WhatsApp": Phone,
  Address: MapPin,
  Hours: Clock,
};

/** Contact info — Admin → Settings se edit hota hai (public site-settings endpoint). */
function useContactInfo() {
  const s = useSiteStore((st) => st.settings);
  return [
    { icon: "📧", label: "Email", value: s.supportEmail },
    { icon: "📱", label: "Phone / WhatsApp", value: s.supportPhone },
    { icon: "📍", label: "Address", value: s.supportAddress },
    { icon: "🕐", label: "Hours", value: s.supportHours },
  ];
}

export function HowItWorksSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">Shop se leke control tak — bas 4 steps.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title} className="card-static relative p-6">
            {/* Step badge */}
            <div className="absolute -top-3 left-5 inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-brand px-2.5 text-[11px] font-bold text-white shadow-sm shadow-brand/30">
              {i + 1}
            </div>
            <div className="mb-4 mt-3 text-3xl">{s.icon}</div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{s.title}</h3>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AboutUsSection() {
  return (
    <section className="border-y border-gray-100 bg-gray-50/60 py-24 dark:border-night-600 dark:bg-night-800/40">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-2 sm:px-6 lg:px-8">
        <div>
          <h2 className="section-title mb-6">About SwitchNest</h2>
          <div className="space-y-4 text-gray-600 dark:text-gray-300">
            <p>
              SwitchNest ek Indian smart-home company hai — hum aam ghar ke liye
              <span className="font-semibold text-brand"> practical, affordable WiFi boards</span> banate hain.
              Na complex wiring, na costly subscription — bas board kharido, serial se activate karo, control karo.
            </p>
            <p>
              Har board <span className="font-semibold text-brand">manufacturing me hi flash + relay self-test</span> se
              guzarta hai, aur WiFi se OTA updates milte rehte hain. Dimmer se leke 8-channel boards tak —
              naye boards customers ki demand pe design hote hain.
            </p>
            <p className="text-sm text-gray-400 italic">
              Mission: "Har Indian ghar ko smart banao — bina electrician ke, bina wiring change kiye."
            </p>
          </div>

          {/* Stats */}
          <div className="mt-8 flex gap-6 border-t border-gray-100 pt-6 dark:border-night-600">
            {[
              { val: "100%", label: "Factory tested" },
              { val: "1 yr", label: "Serial warranty" },
              { val: "OTA", label: "WiFi updates" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-brand">{s.val}</div>
                <div className="mt-0.5 text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: "🔧", t: "Made in India", d: "Hardware + firmware hum khud design karte hain." },
            { icon: "🧩", t: "4-6-8 CH + Dimmers", d: "Har layout ke liye board — custom bhi banwate hain." },
            { icon: "🛡️", t: "Serial-Locked", d: "Device ownership serial code se protected." },
            { icon: "💬", t: "Real Support", d: "WhatsApp/email se seedha engineer se baat." },
          ].map((c) => (
            <div key={c.t} className="card p-5">
              <div className="mb-3 text-2xl">{c.icon}</div>
              <div className="font-semibold text-gray-900 dark:text-white">{c.t}</div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LocateUsSection() {
  const CONTACT_INFO = useContactInfo();
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h2 className="section-title">Locate Us</h2>
        <p className="section-subtitle">Come visit us or reach out anytime.</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          {CONTACT_INFO.map((c) => {
            const Icon = CONTACT_ICONS[c.label] ?? Mail;
            return (
              <div
                key={c.label}
                className="card-static flex items-start gap-4 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                  <Icon className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{c.label}</div>
                  <div className="mt-0.5 text-sm text-gray-700 dark:text-gray-200">{c.value}</div>
                </div>
              </div>
            );
          })}
          <div className="card-static p-4 text-sm text-gray-500 dark:text-gray-400">
            🚗 <span className="font-medium text-gray-700 dark:text-gray-200">Visit:</span> Lab visits by appointment — WhatsApp pe pehle message karo,
            board demos dikhate hain.
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm dark:border-night-600">
          <iframe
            title="SwitchNest location map"
            src="https://www.google.com/maps?q=Sector%2062%2C%20Noida%2C%20Uttar%20Pradesh&output=embed"
            className="h-full min-h-[320px] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}

export function ContactUsSection() {
  const CONTACT_INFO = useContactInfo();
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "Feedback", message: "" });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await sendContact(form);
      setStatus({ ok: true, text: "✅ Message mil gaya! Hum jaldi reply karenge." });
      setForm({ name: "", email: "", phone: "", subject: "Feedback", message: "" });
    } catch {
      setStatus({ ok: false, text: "❌ Kuch gadbad hui — thodi der baad try karo." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-t border-gray-100 bg-gray-50/60 py-24 dark:border-night-600 dark:bg-night-800/40">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-2 sm:px-6 lg:px-8">
        <div>
          <h2 className="section-title mb-4">Contact / Feedback</h2>
          <p className="mb-6 max-w-md text-gray-500 dark:text-gray-400">
            Sawaal, order help, ya product feedback — form bharke bhejo, humara team seedha reply karta hai.
            (Chat widget bhi hai — bottom right 🤖)
          </p>

          {status && (
            <div className={`mb-6 ${status.ok ? "alert-success" : "alert-error"}`}>
              {status.text}
            </div>
          )}

          <div className="space-y-3">
            {CONTACT_INFO.map((c) => (
              <div key={c.label} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <span className="text-lg">{c.icon}</span>
                <span className="text-gray-400">{c.label}:</span>
                <span>{c.value}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="card-static p-6 sm:p-8">
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input-field"
                placeholder="Aapka naam"
              />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="input-field"
                placeholder="+91 …"
              />
            </div>
            <div>
              <label className="field-label">Subject</label>
              <select
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="select-field"
              >
                <option>Feedback</option>
                <option>Order / Delivery Help</option>
                <option>Product Question</option>
                <option>Warranty Support</option>
                <option>Bulk / Dealer Enquiry</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="mb-5">
            <label className="field-label">Message *</label>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="input-field resize-none"
              placeholder="Kya help chahiye? / Aapka feedback…"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full"
          >
            {busy ? "Sending…" : (
              <>
                Send Message
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
