import { Wrench, LayoutGrid, ShieldCheck, MessageCircle } from "lucide-react";

export function AboutUsSection() {
  return (
    <section className="border-y border-zinc-200/70 bg-zinc-50/60 py-24 dark:border-white/[0.08] dark:bg-zinc-950/60">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-2 sm:px-6 lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2.5 mb-3">
            <span className="h-[1.5px] w-6 bg-[#991b1b]" />
            <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#991b1b]">
              ENGINEERING PHILOSOPHY
            </p>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-black dark:text-white sm:text-4xl mb-6">
            About SwitchNest
          </h2>
          <div className="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm sm:text-base">
            <p>
              SwitchNest is an independent IoT hardware engineering team building
              <span className="font-semibold text-black dark:text-white"> transparent, ultra-reliable smart controllers</span>.
              No complex rewiring, no proprietary cloud locks, and zero forced subscriptions — just modular hardware that works out of the box.
            </p>
            <p>
              Every relay board undergoes automated firmware stress tests, power cycle tests, and thermal dissipation verification before shipping.
              Silent over-the-air firmware updates ensure your system continuously gains performance and security enhancements.
            </p>
            <blockquote className="border-l-2 border-zinc-300 dark:border-white/30 pl-4 text-sm italic text-zinc-500 dark:text-zinc-400">
              "Smart hardware should just work — predictably, reliably, and respectfully of your private home network."
            </blockquote>
          </div>

          {/* Stats */}
          <div className="mt-8 flex gap-8 border-t border-zinc-200/80 dark:border-white/[0.08] pt-6">
            {[
              { val: "100%", label: "Bench Tested" },
              { val: "1 Year", label: "Hardware Warranty" },
              { val: "0 Sub", label: "Zero Subscriptions" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-black font-mono text-black dark:text-white">{s.val}</div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          {[
            {
              icon: <Wrench className="h-5 w-5 text-black dark:text-white" />,
              title: "Engineered In-House",
              desc: "Schematics, PCB routing, and firmware optimized for domestic power variance.",
            },
            {
              icon: <LayoutGrid className="h-5 w-5 text-black dark:text-white" />,
              title: "Modular Form Factor",
              desc: "Engineered to fit into standard conceal boxes and modular plates with zero demolition.",
            },
            {
              icon: <ShieldCheck className="h-5 w-5 text-black dark:text-white" />,
              title: "Hardware Cryptography",
              desc: "Per-node cryptographic serial keys bind device control exclusively to your authorized users.",
            },
            {
              icon: <MessageCircle className="h-5 w-5 text-black dark:text-white" />,
              title: "Direct Engineering Support",
              desc: "Direct support tickets, live WebRTC video assistance, and detailed flashing documentation.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-sm dark:border-white/[0.08] dark:bg-zinc-950"
            >
              <div className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04]">
                {item.icon}
              </div>
              <h3 className="text-sm font-bold text-black dark:text-white tracking-tight">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
