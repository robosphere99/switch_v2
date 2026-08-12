import { useEffect, useState } from "react";
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

function ProductCard({ p, onAdd }: { p: Product; onAdd: () => void }) {
  return (
    <div className="flex flex-col rounded-xl border border-brand/20 bg-night-800 p-6 transition hover:-translate-y-1 hover:border-brand">
      <div className="mb-3 text-4xl">{MODEL_ICON[p.modelCode] ?? "📦"}</div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{p.name}</h3>
        <span className="rounded bg-brand/20 px-2 py-0.5 text-xs font-semibold text-brand-light">
          {p.modelCode}
        </span>
      </div>
      <div className="mb-2 text-sm text-gray-400">
        {p.relayCount > 1 ? `${p.relayCount} relay channels` : "Single channel"} · ESP32
      </div>
      <p className="mb-4 flex-1 text-sm text-gray-400">{p.description}</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {featureChips(p).map((c) => (
          <span key={c} className="rounded-full bg-night-700 px-2.5 py-0.5 text-xs text-gray-300">
            {c}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xl font-bold text-brand-light">₹{Number(p.price).toLocaleString("en-IN")}</span>
        <button
          onClick={onAdd}
          className="rounded-lg bg-gradient-to-r from-brand to-brand-light px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}

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

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setError("Products load nahi hue — API chal raha hai kya?"));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
              🛒 RoboSphere Shop
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Har board pe unique serial code — box pe sticker. Delivery ke baad Activate karke apne home me add karo.
          </p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative rounded-lg border-2 border-brand-light px-4 py-2 font-semibold text-brand-light hover:bg-brand-light hover:text-night-900"
        >
          🛒 Cart ({count})
        </button>
      </div>

      {error && <div className="mb-6 rounded bg-red-900/40 p-3 text-sm text-red-300">{error}</div>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            p={p}
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
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            {items.length === 0 ? (
              <p className="flex-1 text-sm text-gray-400">Cart khali hai — products add karo.</p>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto">
                {items.map((i) => (
                  <div key={i.productId} className="flex items-center justify-between gap-3 rounded-lg bg-night-700 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{i.name}</div>
                      <div className="text-xs text-gray-400">
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
                      <button onClick={() => remove(i.productId)} className="ml-1 text-red-400 hover:text-red-300">
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
                <Link to="/orders" className="mt-2 block text-center text-sm text-gray-400 hover:text-brand-light">
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
