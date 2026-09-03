import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getProducts, type Product } from "../api/shop";
import { useCartStore } from "../stores/cart";
import { ProductCard } from "../components/ProductCard";
import { ProductDetailsModal } from "../components/ProductDetailsModal";

export function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
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

  // Chat se aaye ho (?product=) to us card pe scroll + highlight + open modal
  useEffect(() => {
    if (!highlightId || products.length === 0) return;
    const t = setTimeout(() => {
      cardRefs.current[highlightId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      const p = products.find(p => p.id === highlightId);
      if (p) setSelectedProduct(p);
    }, 350);
    return () => clearTimeout(t);
  }, [highlightId, products]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="text-brand">
              🛒 SwitchNest Shop
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Har board pe unique serial code — box pe sticker. Delivery ke baad Activate karke apne home me add karo.
          </p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative w-full sm:w-auto shrink-0 rounded-xl border-2 border-brand bg-brand/5 px-6 py-3 font-bold text-brand shadow-lg shadow-brand/10 transition-all hover:-translate-y-1 hover:bg-brand hover:text-white hover:shadow-brand/30"
        >
          🛒 Cart ({count})
        </button>
      </div>

      {error && <div className="mb-6 rounded-lg bg-red-900/40 border border-red-500/30 p-4 text-sm font-medium text-red-400">{error}</div>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => {
          const cartItem = items.find(i => i.productId === p.id);
          const cartQuantity = cartItem ? cartItem.quantity : 0;
          
          return (
            <ProductCard
              key={p.id}
              p={p}
              cartQuantity={cartQuantity}
              highlighted={highlightId === p.id}
              ref={(el) => { cardRefs.current[p.id] = el; }}
              onClick={() => setSelectedProduct(p)}
              onUpdateQuantity={(qty) => {
                if (qty <= 0) remove(p.id);
                else setQuantity(p.id, qty);
              }}
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
          );
        })}
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (() => {
        const cartItem = items.find(i => i.productId === selectedProduct.id);
        const cartQuantity = cartItem ? cartItem.quantity : 0;
        
        return (
          <ProductDetailsModal
            product={selectedProduct}
            cartQuantity={cartQuantity}
            onClose={() => setSelectedProduct(null)}
            onUpdateQuantity={(qty) => {
              if (qty <= 0) remove(selectedProduct.id);
              else setQuantity(selectedProduct.id, qty);
            }}
            onAdd={() => {
              add({
                productId: selectedProduct.id,
                name: selectedProduct.name,
                price: Number(selectedProduct.price),
                quantity: 1,
                modelCode: selectedProduct.modelCode,
              });
            }}
          />
        );
      })()}

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
                  className="block rounded-lg bg-brand px-4 py-3 text-center font-semibold text-white"
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
