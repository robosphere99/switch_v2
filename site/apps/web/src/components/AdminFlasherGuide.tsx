import { ExternalLink } from "lucide-react";

/**
 * Flasher Guide — factory tool me kya bharna hai (reference page).
 * Flasher GUI me "📖 Guide" button isi page ko kholta hai (/admin/flasher-guide).
 * Localhost testing se live site pe jaate waqt values bhoolna band — dono modes
 * yahan ek jagah hain.
 */

const LIVE = "https://onlineswitch.bhartitechnical.com";

function ModeCard({
  title,
  accent,
  rows,
}: {
  title: string;
  accent: string;
  rows: Array<{ label: string; value: string; hint?: string }>;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-night-800 p-5 dark:border-night-600">
      <h3 className={`mb-4 font-semibold ${accent}`}>{title}</h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-night-900 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-semibold text-gray-600">{r.label}</span>
            <span className="font-mono text-sm text-brand">{r.value}</span>
            {r.hint && <span className="text-[11px] text-gray-500 sm:ml-3">{r.hint}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-night-950">{title}</p>
        <div className="text-sm text-gray-500">{body}</div>
      </div>
    </div>
  );
}

export function AdminFlasherGuide() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold">🔧 Flasher Guide — kya bharna hai</h1>
        <p className="text-sm text-gray-500">
          Factory Flasher GUI (<code className="text-brand">tools/flasher/flasher_gui.py</code>) me har field ka matlab —
          localhost testing se live site pe switch karte waqt yehi page kholo. Flasher me{" "}
          <span className="font-semibold">Mode</span> dropdown se server badlo, phir{" "}
          <span className="font-semibold">📖 Guide</span> button dabao — yehi page khulega.
        </p>
      </div>

      {/* Modes */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <ModeCard
          title="🌐 Mode 1 — Live site (production)"
          accent="text-emerald-400"
          rows={[
            { label: "Mode", value: "Live site" },
            { label: "Site URL (API)", value: LIVE },
            { label: "Admin user", value: "admin" },
            { label: "Password", value: "•••••• (site .env ADMIN_PASSWORD)", hint: "Anil@20552 — profile change pe .env sync hota hai" },
            { label: "ESP Server URL", value: LIVE, hint: "board live site se heartbeat karega" },
          ]}
        />
        <ModeCard
          title="💻 Mode 2 — Localhost (testing)"
          accent="text-sky-400"
          rows={[
            { label: "Mode", value: "Localhost" },
            { label: "Site URL (API)", value: "http://localhost:4000" },
            { label: "Admin user", value: "admin" },
            { label: "Password", value: "123456", hint: "testing accounts — sabka 123456" },
            { label: "ESP Server URL", value: "http://<LAN-IP>:4000", hint: "mode change pe auto-fill — board ko wahi IP dikhe jo server chala raha hai" },
          ]}
        />
      </div>

      {/* Field-by-field */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-night-800 p-5 dark:border-night-600">
        <h2 className="mb-4 font-semibold">📋 Fields — ek-ek karke</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Site URL (API)", "Jis server pe order hai. Mode se set hota hai — live site ya localhost."],
            ["Admin user / Password", "System admin ke creds. Live: admin + .env wala password. Localhost testing: admin / 123456."],
            ["ESP Server URL", "Board ke firmware me set hoga — heartbeat isi pe jayega. Localhost = LAN IP (192.168.x.x:4000), live = site URL."],
            ["Order #", "Order number ya ID (e.g. RSMSW6R8BYR8OX). Sirf verified-payment orders fetch honge (paid gate)."],
            ["Model", "Fetch ke baad dropdown me SIRF order ke devices dikhte hain — jo board flash kar rahe ho wahi choose karo."],
            ["Serial code", "Board ki lifetime identity. Generate dabao → server se order-linked serial aata hai (unique, factory-set)."],
            ["WiFi SSID / pass", "Order-time WiFi auto-fill. Nahi diya to default Robo_lab / Robosphere."],
            ["API key", "Order me key nahi mili to server pe create hota hai — user ke home se permanently bind."],
            ["COM port", "Board ka port (⟳ se refresh). Serial monitor ON ho to Flash/Provision block hoga — pehle Close karo."],
          ].map(([label, body]) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-night-900 px-3 py-2.5">
              <p className="text-sm font-semibold text-night-950">{label}</p>
              <p className="text-xs text-gray-500">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Flow */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-night-800 p-5 dark:border-night-600">
        <h2 className="mb-4 font-semibold">🔄 Flow — board banne tak</h2>
        <div className="space-y-4">
          <Step n={1} title="Login" body="Mode choose karo (Live site / Localhost) → admin creds → Login. Green ✓ aana chahiye." />
          <Step n={2} title="Fetch Order" body="Order # daalo → Fetch Order. Model list + WiFi + API key auto-fill hote hain. Paid-gate: payment verified hone pe hi fetch hoga." />
          <Step n={3} title="Serial + API key check" body="Serial khali ho to Generate (order-linked, unique). API key khali ho to auto-create hota hai — dono user se permanently bind." />
          <Step n={4} title="1 · Flash Firmware" body="COM port select → Flash dabao → confirmation dialog me model verify karo ('Are you sure yeh XCH board hai?') → OK pe bind + flash shuru. Model-specific firmware download hota hai." />
          <Step n={5} title="2 · Provision + Test" body="Board ke serial me config: WiFi, server URL, API key, hotspot naam (UserName_OrderID_last6_N), serial, model — phir relay self-test. Hotspot verify bhi hota hai (sticker se match na ho to FAIL)." />
          <Step n={6} title="3 · Mark Tested" body="Self-test pass hone pe Mark Tested → user ko notification jaati hai (✅ Factory test pass). Phir Next Board." />
          <Step n={7} title="Pack — Bill + Stickers" body={
            <span className="text-sm text-gray-500">
              Shop/Orders me <span className="font-semibold">🖨️ Bill</span> (invoice) aur{" "}
              <a href="/admin/print" className="text-brand underline">Serials print</a>{" "}
              (stickers: hotspot naam + password + QR activation) — pack karte waqt sab saath.
            </span>
          } />
        </div>
      </div>

      {/* Hotspot rules */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <h2 className="mb-2 font-semibold text-amber-600">📡 Hotspot naming rule (sticker se match)</h2>
        <p className="mb-2 text-sm text-gray-500">
          Board ka hotspot naam = <code className="text-brand">UserName_OrderID-last-6-chars</code> + device number{" "}
          <code className="text-brand">_N</code> (agar order me multiple boards) — password = serial key. User login karke
          webserver me edit kar sakta hai, factory reset pe serial wapas restore hota hai.
        </p>
        <div className="flex flex-wrap gap-2">
          {["demoflow_BYR8OX_1", "demoflow_BYR8OX_2"].map((h) => (
            <span key={h} className="rounded-full border border-amber-500/40 bg-night-900 px-3 py-1 font-mono text-xs text-amber-500">
              {h}
            </span>
          ))}
          <a
            href="/admin/print"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/20"
          >
            Stickers print <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
