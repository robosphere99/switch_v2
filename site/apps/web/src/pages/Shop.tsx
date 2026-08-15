import { forwardRef, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { getProducts, type Product } from "../api/shop";
import { useCartStore } from "../stores/cart";

const MODEL_ICON: Record<string, string> = {
  "2CH": "🎛️",
  "4CH": "🎛️",
  "5CH": "🎛️",
  "6CH": "🎛️",
  "8CH": "🎛️",
  "4CH-IR": "📡",
  "FAN-DIM": "🌀",
  "DIM-3S": "💡",
  "DIM-4S": "💡",
};

function featureChips(p: Product): string[] {
  const f = (p.features ?? {}) as Record<string, unknown>;
  const chips: string[] = [];
  if (p.modelCode.startsWith("DIM")) chips.push(`Touch · ${f.steps ?? 3}-step`);
  if (f.ir) chips.push("IR Remote");
  if (f.fanDimmer) chips.push("Fan Speed");
  if (f.wifi) chips.push("WiFi");
  if (f.ota) chips.push("OTA Update");
  return chips;
}

const ProductCard = forwardRef<HTMLDivElement, { p: Product; onAdd: () => void; highlighted?: boolean }>(
  function ProductCard({ p, onAdd, highlighted }, ref) {
  return (
    <div
      ref={ref}
      className={`flex flex-col rounded-xl border bg-night-800 p-6 transition hover:-translate-y-1 ${highlighted ? "border-brand shadow-lg shadow-brand/30 ring-2 ring-brand/50" : "border-brand/20 hover:border-brand"}`}
      style={highlighted ? { scrollMarginTop: 90 } : undefined}
    >
      <div className="mb-3 text-4xl">{MODEL_ICON[p.modelCode] ?? "📦"}</div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{p.name}</h3>
        <span className="rounded bg-brand/20 px-2 py-0.5 text-xs font-semibold text-brand">
          {p.modelCode}
        </span>
      </div>
      <div className="mb-2 text-sm text-gray-500">
        {p.relayCount > 1 ? `${p.relayCount} relay channels` : "Single channel"} · ESP32
      </div>
      <p className="mb-4 flex-1 text-sm text-gray-500">{p.description}</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {featureChips(p).map((c) => (
          <span key={c} className="rounded-full bg-night-700 px-2.5 py-0.5 text-xs text-gray-600">
            {c}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xl font-bold text-brand">₹{Number(p.price).toLocaleString("en-IN")}</span>
        <button
          onClick={onAdd}
          className="rounded-lg bg-gradient-to-r from-brand to-brand-light px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
  },
);

export function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const items = useCartStore((s) => s.items);
  const add = useCartStore((s) => s.add);
  const remove = useCartStore((s) => s.remove);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const count = useCartStore((s) => s.count());
  const total = useCartStore((s) => s.total());
  const [params] = useSearchParams();
  const highlightId = params.get("product") ? Number(params.get("product")) : null;
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setError("Products load nahi hue — API chal raha hai kya?"));
  }, []);

  // Chat se aaye ho (?product=) to us card pe scroll + highlight
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => {
      cardRefs.current[highlightId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    return () => clearTimeout(t);
  }, [highlightId, products]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
              🛒 SwitchNest Shop
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Har board pe unique serial code — box pe sticker. Delivery ke baad Activate karke apne home me add karo.
          </p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative rounded-lg border-2 border-brand-light px-4 py-2 font-semibold text-brand hover:bg-brand-light hover:text-white"
        >
          🛒 Cart ({count})
        </button>
      </div>

      {error && <div className="mb-6 rounded bg-red-900/40 p-3 text-sm text-red-600">{error}</div>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            p={p}
            highlighted={highlightId === p.id}
            ref={(el) => { cardRefs.current[p.id] = el; }}
            onAdd={() => {
              add({
                productId: p.id,
                name: p.name,
                price: Number(p.price),
                quantity: 1,
                modelCode: p.modelCode,
              });
              setCartOpen(true);
            }}
          />
        ))}
      </div>

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setCartOpen(false)}>
          <div
            className="flex h-full w-full max-w-md flex-col border-l border-brand/20 bg-night-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Your Cart</h2>
              <button onClick={() => setCartOpen(false)} className="text-gray-500 hover:text-night-950">
                ✕
              </button>
            </div>

            {items.length === 0 ? (
              <p className="flex-1 text-sm text-gray-500">Cart khali hai — products add karo.</p>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto">
                {items.map((i) => (
                  <div key={i.productId} className="flex items-center justify-between gap-3 rounded-lg bg-night-700 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{i.name}</div>
                      <div className="text-xs text-gray-500">
                        ₹{i.price.toLocaleString("en-IN")} × {i.quantity} = ₹{(i.price * i.quantity).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity(i.productId, i.quantity - 1)}
                        className="h-7 w-7 rounded bg-night-600 hover:bg-night-500"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm">{i.quantity}</span>
                      <button
                        onClick={() => setQuantity(i.productId, i.quantity + 1)}
                        className="h-7 w-7 rounded bg-night-600 hover:bg-night-500"
                      >
                        +
                      </button>
                      <button onClick={() => remove(i.productId)} className="ml-1 text-red-400 hover:text-red-600">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="mt-4 border-t border-brand/20 pt-4">
                <div className="mb-3 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>
                <Link
                  to="/checkout"
                  className="block rounded-lg bg-gradient-to-r from-brand to-brand-light px-4 py-3 text-center font-semibold text-white"
                >
                  Checkout →
                </Link>
                <Link to="/orders" className="mt-2 block text-center text-sm text-gray-500 hover:text-brand">
                  View my orders
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
