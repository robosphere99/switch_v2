import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProducts, type Product } from "../api/shop";
import { AboutUsSection, ContactUsSection, HowItWorksSection, LocateUsSection } from "../components/LandingSections";
import { ShoppingCart } from "lucide-react";
import { Logo } from "../components/Logo";
import { ProductCard } from "../components/ProductCard";
import { useCartStore } from "../stores/cart";

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
    <div>
      {/* Hero */}
      <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6"><Logo size="lg" /></div>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight">
          <span className="text-brand">
            Welcome to SwitchNest
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-gray-500">
          Control all your IoT devices from one powerful dashboard — built for real
          families, not just one user.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            to="/signup"
            className="rounded-lg bg-brand px-8 py-3 font-semibold text-white shadow-lg shadow-brand/30 transition hover:-translate-y-0.5"
          >
            Create Your Home
          </Link>
          <Link
            to="/shop"
            className="rounded-lg border-2 border-brand px-8 py-3 font-semibold text-brand hover:bg-brand hover:text-white"
          >
            <ShoppingCart className="mr-1.5 inline h-4 w-4" />
            Shop Boards
          </Link>
        </div>
      </section>

      {/* Products showcase */}
      {products.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold">
                <span className="text-brand">
                  Shop Smart Hardware
                </span>
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Premium toughened glass touch switches, dimmers, & universal IR blasters.
              </p>
            </div>
            <Link to="/shop" className="text-sm font-semibold text-brand hover:underline shrink-0">
              View all products →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

          {/* Bottom track scroll indicator matching screenshot */}
          <div className="mt-8 flex justify-center">
            <div className="h-1.5 w-64 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
              <div className="absolute left-0 top-0 h-full w-1/3 rounded-full bg-slate-400 dark:bg-slate-600"></div>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <h2 className="mb-12 text-center text-4xl font-bold">
          <span className="text-brand">
            Why SwitchNest?
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
              <p className="text-sm text-gray-500">{f.desc}</p>
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
