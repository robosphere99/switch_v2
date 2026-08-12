import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts, type Product } from "../api/shop";

const FEATURES = [
  {
    icon: "🏠",
    title: "One Home, Whole Family",
    desc: "Devices belong to your home. Add family members with roles — owner, admin, member, viewer.",
  },
  {
    icon: "⚡",
    title: "Real-time Control",
    desc: "Toggle devices from anywhere. Two-way sync — physical switch se bhi app update hota hai.",
  },
  {
    icon: "📶",
    title: "WiFi Boards, Zero Wiring Hassle",
    desc: "ESP32 relay boards with captive-portal setup. WiFi name + password order pe bhi de sakte ho.",
  },
  {
    icon: "🔄",
    title: "OTA Updates, No USB",
    desc: "Naya firmware publish karo, board khud update ho jata hai — kabhi cable nahi chahiye.",
  },
  {
    icon: "🔑",
    title: "Serial Activation",
    desc: "Har board ka unique serial code. Delivery ke baad activate karo — device sirf aapka.",
  },
  {
    icon: "🤖",
    title: "AI Assist",
    desc: "Natural-language control and smart suggestions on the roadmap.",
  },
];

function LandingProductCard({ p }: { p: Product }) {
  const icon =
    p.modelCode.startsWith("DIM")
      ? "💡"
      : p.modelCode === "FAN-DIM"
        ? "🌀"
        : p.modelCode.includes("IR")
          ? "📡"
          : "🎛️";
  const sub = p.relayCount > 1 ? `${p.relayCount} CH Relay` : `${p.modelCode}`;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/20 bg-night-800 p-5 transition hover:-translate-y-0.5 hover:border-brand">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <div className="font-semibold">{p.name}</div>
          <div className="text-xs text-gray-500">{sub} · ESP32</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-brand-light">₹{Number(p.price).toLocaleString("en-IN")}</div>
      </div>
    </div>
  );
}

export function Landing() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="max-w-3xl text-5xl font-bold leading-tight">
          <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
            Welcome to RoboSphere
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-gray-400">
          Control all your IoT devices from one powerful dashboard — built for real
          families, not just one user.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            to="/signup"
            className="rounded-lg bg-gradient-to-r from-brand to-brand-light px-8 py-3 font-semibold text-white shadow-lg shadow-brand/30 transition hover:-translate-y-0.5"
          >
            Create Your Home
          </Link>
          <Link
            to="/shop"
            className="rounded-lg border-2 border-brand-light px-8 py-3 font-semibold text-brand-light hover:bg-brand-light hover:text-night-900"
          >
            🛒 Shop Boards
          </Link>
        </div>
      </section>

      {/* Products showcase */}
      {products.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-4xl font-bold">
              <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
                Shop Hardware
              </span>
            </h2>
            <Link to="/shop" className="text-sm text-brand-light hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(0, 6).map((p) => (
              <LandingProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <h2 className="mb-12 text-center text-4xl font-bold">
          <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
            Why RoboSphere?
          </span>
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-brand/20 bg-night-800 p-8 transition hover:-translate-y-1 hover:border-brand"
            >
              <div className="mb-4 text-4xl">{f.icon}</div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
