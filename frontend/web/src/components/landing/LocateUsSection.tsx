import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { useSiteStore } from "../../stores/site";
import { buildMapsEmbedUrl } from "../../lib/constants";

export function LocateUsSection() {
  const s = useSiteStore((st) => st.settings);
  const contactInfo = [
    { icon: <Mail className="h-4 w-4 text-black dark:text-white" />, label: "Email", value: s.supportEmail },
    { icon: <Phone className="h-4 w-4 text-black dark:text-white" />, label: "Phone / WhatsApp", value: s.supportPhone },
    { icon: <MapPin className="h-4 w-4 text-black dark:text-white" />, label: "Hardware Lab", value: s.supportAddress },
    { icon: <Clock className="h-4 w-4 text-black dark:text-white" />, label: "Hours", value: s.supportHours },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mb-14 text-center">
        <div className="inline-flex items-center gap-2.5 mb-3">
          <span className="h-[1.5px] w-6 bg-[#991b1b]" />
          <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#991b1b]">
            LOCATION // CONTACT
          </p>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-black dark:text-white sm:text-4xl">
          Locate SwitchNest Labs
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Visit our engineering facility or reach out directly for technical support and custom integration consultations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3.5">
          {contactInfo.map((c) => (
            <div
              key={c.label}
              className="flex items-start gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xs transition hover:shadow-sm dark:border-white/[0.08] dark:bg-zinc-950"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04]">
                {c.icon}
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  {c.label}
                </div>
                <div className="mt-1 text-sm font-semibold text-black dark:text-white">
                  {c.value || "—"}
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 text-xs leading-relaxed text-zinc-600 dark:border-white/[0.08] dark:bg-zinc-950/40 dark:text-zinc-400">
            <span className="font-bold text-black dark:text-white font-mono">Lab visits:</span> In-person facility visits are by prior appointment. Reach out on WhatsApp or email to schedule hardware demonstrations and custom microcontroller firmware inquiries.
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-100 shadow-sm dark:border-white/[0.08] dark:bg-zinc-950">
          <iframe
            title="SwitchNest location map"
            src={buildMapsEmbedUrl(s.supportAddress || "Sector 62, Noida, Uttar Pradesh")}
            className="h-full min-h-[320px] w-full border-0 contrast-125 opacity-90"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
