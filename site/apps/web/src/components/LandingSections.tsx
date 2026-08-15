import { useState } from "react";
import { sendContact } from "../api/public";

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

const CONTACT_INFO = [
  { icon: "📧", label: "Email", value: "support@switchnest.in" },
  { icon: "📱", label: "Phone / WhatsApp", value: "+91 98765 43210" },
  { icon: "📍", label: "Address", value: "SwitchNest Labs, Sector 62, Noida, Uttar Pradesh 201309" },
  { icon: "🕐", label: "Hours", value: "Mon–Sat · 9:00 AM – 7:00 PM" },
];

export function HowItWorksSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <h2 className="mb-3 text-center text-4xl font-bold">
        <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
          How It Works
        </span>
      </h2>
      <p className="mb-12 text-center text-gray-500">
        Shop se leke control tak — bas 4 steps.
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title} className="relative rounded-xl border border-brand/20 bg-night-800 p-6">
            <div className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-brand to-brand-light px-2.5 py-0.5 text-xs font-bold text-white">
              Step {i + 1}
            </div>
            <div className="mb-3 mt-2 text-4xl">{s.icon}</div>
            <h3 className="mb-2 font-semibold text-night-950">{s.title}</h3>
            <p className="text-sm text-gray-500">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AboutUsSection() {
  return (
    <section className="border-y border-brand/15 bg-night-900/40 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-6 text-4xl font-bold">
            <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
              About SwitchNest
            </span>
          </h2>
          <div className="space-y-4 text-gray-600">
            <p>
              SwitchNest ek Indian smart-home company hai — hum aam ghar ke liye
              <span className="text-brand"> practical, affordable WiFi boards</span> banate hain.
              Na complex wiring, na costly subscription — bas board kharido, serial se activate karo, control karo.
            </p>
            <p>
              Har board <span className="text-brand">manufacturing me hi flash + relay self-test</span> se
              guzarta hai, aur WiFi se OTA updates milte rehte hain. Dimmer se leke 8-channel boards tak —
              naye boards customers ki demand pe design hote hain.
            </p>
            <p className="text-sm text-gray-500">
              Mission: "Har Indian ghar ko smart banao — bina electrician ke, bina wiring change kiye."
            </p>
          </div>
          <div className="mt-8 flex gap-8">
            <div>
              <div className="text-3xl font-bold text-brand">100%</div>
              <div className="text-xs text-gray-500">Factory tested boards</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-brand">1 yr</div>
              <div className="text-xs text-gray-500">Serial warranty</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-brand">OTA</div>
              <div className="text-xs text-gray-500">WiFi updates</div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: "🔧", t: "Made in India", d: "Hardware + firmware hum khud design karte hain." },
            { icon: "🧩", t: "4-6-8 CH + Dimmers", d: "Har layout ke liye board — custom bhi banwate hain." },
            { icon: "🛡️", t: "Serial-Locked", d: "Device ownership serial code se protected." },
            { icon: "💬", t: "Real Support", d: "WhatsApp/email se seedha engineer se baat." },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-brand/20 bg-night-800 p-5">
              <div className="mb-2 text-3xl">{c.icon}</div>
              <div className="font-semibold text-night-950">{c.t}</div>
              <div className="mt-1 text-sm text-gray-500">{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LocateUsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <h2 className="mb-12 text-center text-4xl font-bold">
        <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
          Locate Us
        </span>
      </h2>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          {CONTACT_INFO.map((c) => (
            <div key={c.label} className="flex items-start gap-3 rounded-xl border border-brand/20 bg-night-800 p-4">
              <span className="text-2xl">{c.icon}</span>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">{c.label}</div>
                <div className="text-sm text-gray-700">{c.value}</div>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-brand/20 bg-night-800 p-4 text-sm text-gray-500">
            🚗 <span className="text-gray-700">Visit:</span> Lab visits by appointment — WhatsApp pe pehle message karo,
            board demos dikhate hain.
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-brand/20">
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
    <section className="border-t border-brand/15 bg-night-900/40 py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-4xl font-bold">
            <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
              Contact / Feedback
            </span>
          </h2>
          <p className="mb-6 max-w-md text-gray-500">
            Sawaal, order help, ya product feedback — form bharke bhejo, humara team seedha reply karta hai.
            (Chat widget bhi hai — bottom right 🤖)
          </p>
          {status && (
            <div className={`mb-4 rounded-lg border p-4 text-sm ${status.ok ? "border-green-500/40 bg-green-900/30 text-green-700" : "border-red-500/40 bg-red-900/30 text-red-600"}`}>
              {status.text}
            </div>
          )}
          <div className="space-y-3 text-sm">
            {CONTACT_INFO.map((c) => (
              <div key={c.label} className="flex items-center gap-3 text-gray-600">
                <span className="text-xl">{c.icon}</span>
                <span className="text-gray-500">{c.label}:</span>
                <span>{c.value}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-brand/20 bg-night-800 p-6">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950"
                placeholder="Aapka naam"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950"
                placeholder="+91 …"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Subject</label>
              <select
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950"
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
          <div className="mb-4">
            <label className="mb-1 block text-xs text-gray-500">Message *</label>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950"
              placeholder="Kya help chahiye? / Aapka feedback…"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-brand to-brand-light px-6 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "📨 Send Message"}
          </button>
        </form>
      </div>
    </section>
  );
}
