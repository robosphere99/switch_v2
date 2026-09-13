import { ShoppingCart, Package, KeyRound, SlidersHorizontal } from "lucide-react";

const STEPS = [
  {
    step: "01",
    phase: "ACQUISITION",
    icon: <ShoppingCart className="h-5 w-5 text-black dark:text-white" />,
    title: "Order Pre-Configured Node",
    desc: "Choose 2CH–8CH relay or dimmer modules. Optionally provide your WiFi SSID during checkout for zero-friction factory flashing.",
  },
  {
    step: "02",
    phase: "DISPATCH",
    icon: <Package className="h-5 w-5 text-black dark:text-white" />,
    title: "Bench-Tested Delivery",
    desc: "Every board undergoes automated continuous relay cycling and burn-in tests before secure dispatch with cryptographic serial card.",
  },
  {
    step: "03",
    phase: "PAIRING",
    icon: <KeyRound className="h-5 w-5 text-black dark:text-white" />,
    title: "Cryptographic Activation",
    desc: "Scan the physical hardware serial card. Your unique private keys bind the microcontroller exclusively to your home tenant.",
  },
  {
    step: "04",
    phase: "CONTROL",
    icon: <SlidersHorizontal className="h-5 w-5 text-black dark:text-white" />,
    title: "Sub-Second Orchestration",
    desc: "Control via web console, mobile app, local switches, or voice assistants with automatic silent OTA security upgrades.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mb-16 text-center">
        <div className="inline-flex items-center gap-2.5 mb-3">
          <span className="h-[1.5px] w-6 bg-[#991b1b]" />
          <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#991b1b]">
            DEPLOYMENT PROTOCOL
          </p>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-black dark:text-white sm:text-4xl">
          Four steps to full home automation.
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Engineered for frictionless hardware deployment without complex networking setup.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div
            key={s.step}
            className="group relative rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-white/[0.08] dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 transition-colors group-hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04]">
                {s.icon}
              </div>
              <span className="font-mono text-base font-black text-black dark:text-white">
                {s.step}
              </span>
            </div>

            <div className="mt-6">
              <span className="text-[10px] font-mono font-semibold text-zinc-400 tracking-wider">
                {s.phase}
              </span>
              <h3 className="mt-1 text-base font-bold text-black dark:text-white tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {s.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
