import { useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import type { Product } from "../../api/shop";
import { ProductCard } from "../ProductCard";
import { useCartStore } from "../../stores/cart";

export interface ProductShowcaseProps {
  products: Product[];
}

export function ProductShowcase({ products }: ProductShowcaseProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const items = useCartStore((s) => s.items);
  const add = useCartStore((s) => s.add);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);

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
    setScrollProgress(maxScroll <= 0 ? 0 : Math.min(100, Math.max(0, (scrollLeft / maxScroll) * 100)));
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: direction === "left" ? -340 : 340, behavior: "smooth" });
  };

  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-400">
            CATALOGUE // HARDWARE MODULES
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            SwitchNest Smart Hardware
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Toughened glass touch controllers, universal dimmers, and multi-channel relay modules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["left", "right"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => scroll(dir)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/90 text-zinc-300 shadow-sm transition hover:border-white/30 hover:text-white active:scale-95"
              aria-label={`Scroll ${dir}`}
            >
              {dir === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ))}
          <Link
            to="/shop"
            className="ml-2 flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            <span>All hardware</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="flex gap-5 overflow-x-auto pb-4 pt-2 no-scrollbar snap-x snap-mandatory scroll-smooth"
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
                onAdd={() =>
                  add({ productId: p.id, name: p.name, price: Number(p.price), quantity: 1, modelCode: p.modelCode })
                }
                onUpdateQuantity={(qty) => {
                  if (qty <= 0) remove(p.id);
                  else setQuantity(p.id, qty);
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Progress Track */}
      <div className="mt-6 flex justify-center">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full w-1/3 rounded-full bg-brand transition-all duration-200 ease-out"
            style={{ transform: `translateX(${(scrollProgress / 100) * 220}%)` }}
          />
        </div>
      </div>
    </section>
  );
}
