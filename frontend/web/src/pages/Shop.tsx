import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getProducts, type Product } from "../api/shop";
import { useCartStore } from "../stores/cart";
import { ProductCard } from "../components/ProductCard";
import { ProductDetailsModal } from "../components/ProductDetailsModal";
import { ShoppingBag, X, Minus, Plus, Trash2, ArrowRight } from "lucide-react";

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
    <div className="page-enter mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">SwitchNest Shop</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Har board pe unique serial code — box pe sticker. Delivery ke baad Activate karke apne home me add karo.
          </p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="btn-primary relative shrink-0 gap-2 px-5 py-2.5 text-sm"
        >
          <ShoppingBag className="h-4 w-4" />
          Cart
          {count > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/25 px-1.5 text-[11px] font-bold">
              {count}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="alert-error mb-8">{error}</div>
      )}

      {/* Product grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

      {/* ── Cart Slide-out ─────────────────────────────────── */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setCartOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col border-l border-gray-100 bg-white shadow-2xl dark:border-night-600 dark:bg-night-800"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "slideInRight 0.25s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            {/* Cart header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-night-600">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Cart</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-gray-300 hover:text-gray-700 dark:border-night-600 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto thin-scrollbar px-6 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ShoppingBag className="mb-3 h-12 w-12 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm text-gray-500">Cart khali hai — products add karo.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((i) => (
                    <div
                      key={i.productId}
                      className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3 dark:border-night-600"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{i.name}</div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          Rs. {i.price.toLocaleString("en-IN")} × {i.quantity} ={" "}
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            Rs. {(i.price * i.quantity).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                      {/* Qty controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQuantity(i.productId, i.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-brand hover:text-brand dark:border-night-600"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-gray-900 dark:text-white">
                          {i.quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(i.productId, i.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-brand hover:text-brand dark:border-night-600"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(i.productId)}
                          className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-red-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart footer */}
            {items.length > 0 && (
              <div className="border-t border-gray-100 px-6 py-5 dark:border-night-600">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    Rs. {total.toLocaleString("en-IN")}
                  </span>
                </div>
                <Link
                  to="/checkout"
                  className="btn-primary w-full justify-center py-3"
                >
                  Proceed to Checkout
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/orders"
                  className="mt-3 block text-center text-sm text-gray-400 transition hover:text-brand"
                >
                  View my orders →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cart slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
