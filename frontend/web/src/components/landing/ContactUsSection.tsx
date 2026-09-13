import { useState } from "react";
import { sendContact } from "../../api/public";
import { useSiteStore } from "../../stores/site";
import { ArrowRight } from "lucide-react";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

export function ContactUsSection() {
  const s = useSiteStore((st) => st.settings);
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "Feedback", message: "" });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const contactInfo = [
    { label: "Email", value: s.supportEmail },
    { label: "Phone / WhatsApp", value: s.supportPhone },
    { label: "Address", value: s.supportAddress },
    { label: "Hours", value: s.supportHours },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await sendContact(form);
      setStatus({ ok: true, text: "Your message has been dispatched successfully. We will get back to you shortly." });
      setForm({ name: "", email: "", phone: "", subject: "Feedback", message: "" });
    } catch {
      setStatus({ ok: false, text: "Failed to send message. Please reach out directly on WhatsApp." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-t border-zinc-200/70 bg-zinc-50/50 py-24 dark:border-white/[0.08] dark:bg-zinc-950/60">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-2 sm:px-6 lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2.5 mb-3">
            <span className="h-[1.5px] w-6 bg-[#991b1b]" />
            <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#991b1b]">
              TECHNICAL SUPPORT // INQUIRIES
            </p>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-black dark:text-white sm:text-4xl mb-4">
            Contact Engineering
          </h2>
          <p className="mb-8 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Have questions regarding PCB schematics, DIN-rail mounting, electrical loads, or custom integrations? Drop a message directly.
          </p>

          {status && (
            <div className="mb-6">
              <Alert variant={status.ok ? "success" : "danger"} onClose={() => setStatus(null)}>
                {status.text}
              </Alert>
            </div>
          )}

          <div className="space-y-3.5">
            {contactInfo.map((c) => (
              <div key={c.label} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider w-28 font-semibold">{c.label}:</span>
                <span className="font-semibold text-black dark:text-white">{c.value || "—"}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-zinc-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-white/[0.08] dark:bg-zinc-950">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="Full Name *"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
            />
            <Input
              label="Email Address *"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="name@domain.com"
            />
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="Phone / Mobile"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+91 98765 43210"
            />
            <Select
              label="Inquiry Type"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            >
              <option value="Feedback">General Technical Feedback</option>
              <option value="Order / Delivery Help">Order & Shipment Tracking</option>
              <option value="Product Question">Hardware Compatibility</option>
              <option value="Warranty / Serial">Serial Verification Issue</option>
              <option value="Custom Project">Bulk / Architectural Projects</option>
            </Select>
          </div>
          <div className="mb-6">
            <Textarea
              label="Message *"
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Describe your installation or technical query..."
            />
          </div>
          <Button type="submit" loading={busy} className="w-full">
            <span>Send Message</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </form>
      </div>
    </section>
  );
}
