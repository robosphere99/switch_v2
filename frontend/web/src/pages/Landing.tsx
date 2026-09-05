import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProducts, type Product } from "../api/shop";
import { AboutUsSection, ContactUsSection, HowItWorksSection, LocateUsSection } from "../components/LandingSections";
import { ArrowRight, ChevronLeft, ChevronRight, ShoppingBag, Zap } from "lucide-react";
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
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const add = useCartStore((s) => s.add);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);

  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  // Auto-slide effect every 3.5 seconds (pauses on hover)
  useEffect(() => {
    if (products.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      if (!scrollRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const maxScroll = scrollWidth - clientWidth;

      if (scrollLeft + 20 >= maxScroll) {
        scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scrollRef.current.scrollBy({ left: 330, behavior: "smooth" });
      }
    }, 3500);

    return () => clearInterval(timer);
  }, [products, isPaused]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 0) {
      setScrollProgress(0);
    } else {
      setScrollProgress(Math.min(100, Math.max(0, (scrollLeft / maxScroll) * 100)));
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 340;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

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
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="section-title">Shop Smart Hardware</h2>
              <p className="section-subtitle">
                Premium toughened glass touch switches, dimmers, &amp; universal IR blasters.
              </p>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              {/* Slide Arrows */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => scroll("left")}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 dark:border-night-600 bg-white dark:bg-night-800 text-gray-700 dark:text-gray-200 shadow-sm transition hover:bg-gray-50 dark:hover:bg-night-700 active:scale-95"
                  aria-label="Slide left"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll("right")}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 dark:border-night-600 bg-white dark:bg-night-800 text-gray-700 dark:text-gray-200 shadow-sm transition hover:bg-gray-50 dark:hover:bg-night-700 active:scale-95"
                  aria-label="Slide right"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <Link
                to="/shop"
                className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline shrink-0 ml-2"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Horizontally Scrollable Container */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="flex gap-5 overflow-x-auto pb-4 pt-2 scrollbar-none snap-x snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {products.map((p) => {
              const cartItem = items.find((i) => i.productId === p.id);
              const cartQuantity = cartItem ? cartItem.quantity : 0;
              return (
                <div key={p.id} className="w-[280px] sm:w-[310px] shrink-0 snap-start">
                  <ProductCard
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
                </div>
              );
            })}
          </div>

          {/* Dynamic Scroll Track Indicator */}
          <div className="mt-6 flex justify-center">
            <div className="h-1.5 w-48 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden relative">
              <div
                className="h-full rounded-full bg-brand transition-all duration-200 ease-out"
                style={{
                  width: "35%",
                  transform: `translateX(${(scrollProgress / 100) * 185}%)`,
                }}
              />
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
