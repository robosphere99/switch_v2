import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useSiteStore } from "../../stores/site";
import { buildWhatsAppLink } from "../../lib/constants";

export function HeroSection() {
  const supportPhone = useSiteStore((s) => s.settings.supportPhone);

  return (
    <section className="relative min-h-[90vh] flex flex-col justify-between overflow-hidden px-4 pt-16 pb-12 sm:px-6 lg:px-8 bg-architect-grid">
      {/* Faint Background Floating Watermarks matching screenshot aesthetic */}
      <div className="pointer-events-none absolute inset-0 select-none overflow-hidden text-zinc-900/[0.04] dark:text-white/[0.03] font-serif">
        <span className="absolute top-12 left-16 text-3xl font-light italic">WiFi Connect</span>
        <span className="absolute top-20 right-1/3 text-2xl font-light">Sub-Second</span>
        <span className="absolute top-16 right-16 text-4xl font-light italic">Offline First?</span>
        <span className="absolute top-1/2 right-12 text-3xl font-light">ESP32 Core</span>
        <span className="absolute bottom-36 right-1/4 text-2xl font-light italic">Private Cloud</span>
        <span className="absolute bottom-40 left-20 text-3xl font-light">OTA Flash</span>
        <span className="absolute top-2/3 left-1/3 text-2xl font-light italic">Low Latency</span>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 mx-auto w-full max-w-7xl pt-8 sm:pt-14">
        {/* Category Eyebrow with Terracotta Hairline */}
        <div className="mb-6 flex items-center gap-3">
          <span className="h-[1.5px] w-8 bg-[#991b1b]" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#991b1b]">
            PREMIUM SMART HOME HARDWARE
          </span>
        </div>

        {/* Dual-Tone Signature Headline */}
        <h1 className="max-w-4xl text-[clamp(2.75rem,7.5vw,5.75rem)] font-extrabold tracking-tight leading-[1.04] text-black dark:text-white">
          <span className="block font-black text-black dark:text-white">Smart Home.</span>
          <span className="block font-light text-zinc-400">Power Your Future.</span>
        </h1>

        {/* Subtitle & Kicker */}
        <div className="mt-8 max-w-xl">
          <p className="text-base sm:text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
            Structured IoT hardware designed to take you from your first setup to confident, real-world smart home automation.
          </p>
          <p className="mt-3 text-xs font-semibold tracking-wide text-zinc-400 dark:text-zinc-500 uppercase">
            Connect. Control. Automate. Succeed.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2.5 rounded-full bg-black px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.98] transition-all"
          >
            <span>Explore Hardware</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-8 py-3.5 text-sm font-medium text-black hover:bg-zinc-50 dark:border-white/15 dark:bg-zinc-900/80 dark:text-white dark:hover:bg-zinc-800 transition-all"
          >
            Create a Home
          </Link>
        </div>
      </div>

      {/* Bottom 4-Column Feature Strip matching reference */}
      <div className="relative z-10 mx-auto mt-20 w-full max-w-7xl border-t border-zinc-200/80 dark:border-white/10 pt-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div>
            <p className="text-sm font-bold text-black dark:text-white tracking-tight">2CH → 8CH</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">Complete Hardware Path</p>
          </div>
          <div>
            <p className="text-sm font-bold text-black dark:text-white tracking-tight">Sub-Second Relay</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">Live WebSocket Sessions</p>
          </div>
          <div>
            <p className="text-sm font-bold text-black dark:text-white tracking-tight">Local-First</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">Private Offline Control</p>
          </div>
          <div>
            <p className="text-sm font-bold text-black dark:text-white tracking-tight">OTA Updates</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">WiFi Firmware Delivery</p>
          </div>
        </div>
      </div>

      {/* Floating WhatsApp Action Button in Bottom Right (matching screenshot) */}
      <a
        href={buildWhatsAppLink(supportPhone)}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-[#25D366]/30 hover:scale-110 active:scale-95 transition-all"
        aria-label="Chat on WhatsApp"
        title="Contact SwitchNest WhatsApp Support"
      >
        <MessageCircle className="h-7 w-7 fill-white text-[#25D366]" />
      </a>
    </section>
  );
}
