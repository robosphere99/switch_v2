import { Cpu, Wifi, KeyRound, Shield, RefreshCw, Terminal } from "lucide-react";

const ARCH_FEATURES = [
  {
    tag: "01 // CONCURRENCY",
    title: "Sub-second Relay Response",
    desc: "Persistent two-way WebSocket sockets maintain continuous connection. Device toggles execute in under 20ms with immediate state verification.",
    icon: <Cpu className="h-5 w-5 text-black dark:text-white" />,
  },
  {
    tag: "02 // HARDWARE",
    title: "Dual-Core ESP32 Controller",
    desc: "Engineered specifically for custom relay architectures. Isolated cores handle networking and relay GPIO operations independently for zero lockups.",
    icon: <Terminal className="h-5 w-5 text-black dark:text-white" />,
  },
  {
    tag: "03 // CRYPTO",
    title: "Hardware Serial Provisioning",
    desc: "Every board leaves manufacturing with a unique, cryptographically signed hardware serial number. Ownership is verified cryptographically upon activation.",
    icon: <KeyRound className="h-5 w-5 text-black dark:text-white" />,
  },
  {
    tag: "04 // FIRMWARE",
    title: "Continuous OTA Updates",
    desc: "Deliver modular firmware binaries over the air. Boards automatically verify SHA256 checksums before switching boot partitions with rollback protection.",
    icon: <RefreshCw className="h-5 w-5 text-black dark:text-white" />,
  },
  {
    tag: "05 // PRIVACY",
    title: "Local-First Architecture",
    desc: "Your data stays on your local network. External cloud commands are authenticated with short-lived tokens and strict per-device ACL policies.",
    icon: <Shield className="h-5 w-5 text-black dark:text-white" />,
  },
  {
    tag: "06 // TELEMETRY",
    title: "Live WiFi RSSI & Diagnostics",
    desc: "Real-time visibility into antenna signal strength, reconnect latency, boot cycle counters, and memory leak prevention metrics.",
    icon: <Wifi className="h-5 w-5 text-black dark:text-white" />,
  },
];

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mb-16 text-center">
        <div className="inline-flex items-center gap-2.5 mb-3">
          <span className="h-[1.5px] w-6 bg-[#991b1b]" />
          <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#991b1b]">
            SYSTEM SPECIFICATIONS
          </p>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-black dark:text-white sm:text-4xl">
          Hardware built for absolute reliability.
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          No generic cloud dependencies. No toy components. Built with industrial-grade microcontrollers and transparent local architecture.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ARCH_FEATURES.map((f) => (
          <div
            key={f.title}
            className="group relative rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-white/[0.08] dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 transition-colors group-hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04]">
                {f.icon}
              </div>
              <span className="text-[10px] font-mono font-semibold text-zinc-400 tracking-wider">
                {f.tag}
              </span>
            </div>

            <div className="mt-6">
              <h3 className="text-base font-bold text-black dark:text-white tracking-tight">
                {f.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {f.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
