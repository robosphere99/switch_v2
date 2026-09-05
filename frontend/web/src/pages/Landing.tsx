import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProducts, type Product } from "../api/shop";
import { AboutUsSection, ContactUsSection, HowItWorksSection, LocateUsSection } from "../components/LandingSections";
import { ArrowRight, ShoppingBag, Zap } from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { useCartStore } from "../stores/cart";

const FEATURES = [
  {
    icon: "🏠",
    color: "bg-blue-50 dark:bg-blue-500/10",
    title: "One Home, Whole Family",
    desc: "Devices belong to your home. Add family members with roles — owner, admin, member, viewer.",
  },
  {
    icon: "⚡",
    color: "bg-amber-50 dark:bg-amber-500/10",
    title: "Real-time Control",
    desc: "Toggle devices from anywhere. Two-way sync — physical switch se bhi app update hota hai.",
  },
  {
    icon: "📶",
    color: "bg-green-50 dark:bg-green-500/10",
    title: "WiFi Boards, Zero Wiring Hassle",
    desc: "ESP32 relay boards with captive-portal setup. WiFi name + password order pe bhi de sakte ho.",
  },
  {
    icon: "🔄",
    color: "bg-purple-50 dark:bg-purple-500/10",
    title: "OTA Updates, No USB",
    desc: "Naya firmware publish karo, board khud update ho jata hai — kabhi cable nahi chahiye.",
  },
  {
    icon: "🔑",
    color: "bg-orange-50 dark:bg-orange-500/10",
    title: "Serial Activation",
    desc: "Har board ka unique serial code. Delivery ke baad activate karo — device sirf aapka.",
  },
  {
    icon: "🤖",
    color: "bg-rose-50 dark:bg-rose-500/10",
    title: "AI Assist",
    desc: "Natural-language control and smart suggestions on the roadmap.",
  },
];

export function Landing() {
  const [products, setProducts] = useState<Product[]>([]);
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const add = useCartStore((s) => s.add);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  return (
    <div className="page-enter">
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative flex min-h-[82vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
        {/* Subtle radial glow behind hero */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 40%, rgb(var(--brand) / 0.07) 0%, transparent 70%)",
          }}
        />

        {/* Eyebrow label */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-4 py-1.5 text-xs font-semibold text-brand">
          <Zap className="h-3.5 w-3.5" />
          India's Smart Home Platform
        </div>

        <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
          Welcome to{" "}
          <span className="text-brand">SwitchNest</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-500 dark:text-gray-400">
          Control all your IoT devices from one powerful dashboard — built for real
          families, not just one user.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/signup"
            className="btn-primary px-7 py-3 text-base"
          >
            Create Your Home
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/shop"
            className="btn-outline px-7 py-3 text-base"
          >
            <ShoppingBag className="h-4 w-4" />
            Shop Boards
          </Link>
        </div>

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="text-green-500">✓</span> 100% Factory tested</span>
          <span className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <span className="flex items-center gap-1.5"><span className="text-green-500">✓</span> 1 Year Serial Warranty</span>
          <span className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <span className="flex items-center gap-1.5"><span className="text-green-500">✓</span> WiFi OTA Updates</span>
          <span className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <span className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Made in India</span>
        </div>
      </section>

      {/* ── Products Showcase ─────────────────────────────── */}
      {products.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="section-title">Shop Smart Hardware</h2>
              <p className="section-subtitle">
                Premium toughened glass touch switches, dimmers, &amp; universal IR blasters.
              </p>
            </div>
            <Link
              to="/shop"
              className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline shrink-0"
            >
              View all products
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 4).map((p) => {
              const cartItem = items.find((i) => i.productId === p.id);
              const cartQuantity = cartItem ? cartItem.quantity : 0;
              return (
                <ProductCard
                  key={p.id}
                  p={p}
                  cartQuantity={cartQuantity}
                  onClick={() => navigate(`/shop?product=${p.id}`)}
                  onAdd={() => {
                    add({
                      productId: p.id,
                      name: p.name,
                      price: Number(p.price),
                      quantity: 1,
                      modelCode: p.modelCode,
                    });
                  }}
                  onUpdateQuantity={(qty) => {
                    if (qty <= 0) remove(p.id);
                    else setQuantity(p.id, qty);
                  }}
                />
              );
            })}
          </div>

          {/* Scroll track indicator */}
          <div className="mt-8 flex justify-center">
            <div className="h-1 w-48 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-gray-400 dark:bg-gray-500" />
            </div>
          </div>
        </section>
      )}

      {/* ── Features ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="section-title">Why SwitchNest?</h2>
          <p className="section-subtitle">Everything you need to make your home truly smart.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card p-6 group"
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <HowItWorksSection />

      {/* About us */}
      <AboutUsSection />

      {/* Locate us */}
      <LocateUsSection />

      {/* Contact / feedback */}
      <ContactUsSection />
    </div>
  );
}
