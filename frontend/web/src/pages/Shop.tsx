import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { getProducts, type Product } from "../api/shop";
import { useCartStore } from "../stores/cart";
import { ProductCard } from "../components/ProductCard";
import { ProductDetailsModal } from "../components/ProductDetailsModal";
import { ShoppingBag, X, Minus, Plus, Trash2, ArrowRight, Flame, Sparkles, Clock } from "lucide-react";

const CATEGORIES = ["All", "Relays", "Dimmers", "Plugs & Extras"];

export function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState("All");
  
  // Last Visited State
  const [recentViewIds, setRecentViewIds] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("recentProducts") || "[]");
    } catch {
      return [];
    }
  });

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

  useEffect(() => {
    if (cartOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [cartOpen]);

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setRecentViewIds(prev => {
      const next = [p.id, ...prev.filter(id => id !== p.id)].slice(0, 4);
      localStorage.setItem("recentProducts", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (!highlightId || products.length === 0) return;
    const t = setTimeout(() => {
      cardRefs.current[highlightId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      const p = products.find(p => p.id === highlightId);
      if (p) handleSelectProduct(p);
    }, 350);
    return () => clearTimeout(t);
  }, [highlightId, products]);

  // Derivations
  const filteredProducts = products.filter(p => {
    if (category === "All") return true;
    const f = p.features as any;
    if (category === "Relays") return f?.channels;
    if (category === "Dimmers") return f?.dimmer || f?.fanDimmer;
    if (category === "Plugs & Extras") return !f?.channels && !f?.dimmer && !f?.fanDimmer;
    return true;
  });

  const trending = [...products].sort((a, b) => Number(b.price || 0) - Number(a.price || 0)).slice(0, 4);
  const suggestions = [...products].filter(p => !trending.find(t => t.id === p.id)).sort(() => Math.random() - 0.5).slice(0, 4);
  const recentProducts = recentViewIds.map(id => products.find(p => p.id === id)).filter(Boolean) as Product[];

  const renderProductCard = (p: Product) => {
    const cartItem = items.find(i => i.productId === p.id);
    const cartQuantity = cartItem ? cartItem.quantity : 0;
    return (
      <ProductCard
        key={p.id}
        p={p}
        cartQuantity={cartQuantity}
        highlighted={highlightId === p.id}
        ref={(el) => { cardRefs.current[p.id] = el; }}
        onClick={() => handleSelectProduct(p)}
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
  };

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

      {/* Category Filters */}
      <div className="mb-10 flex gap-2 overflow-x-auto thin-scrollbar pb-2">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-all ${
              category === c 
                ? "bg-brand text-white shadow-md shadow-brand/20" 
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-night-800 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {category === "All" && (
        <div className="mb-12 flex flex-col lg:flex-row gap-8">
          {/* Trending Section */}
          <div className="flex-1">
            <h2 className="mb-5 text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <Flame className="h-5 w-5 text-orange-500" /> Trending Now
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {trending.slice(0, 2).map(renderProductCard)}
            </div>
          </div>
          
          {/* Suggestions Section */}
          <div className="flex-1">
            <h2 className="mb-5 text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <Sparkles className="h-5 w-5 text-brand" /> Recommended for You
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {suggestions.slice(0, 2).map(renderProductCard)}
            </div>
          </div>
        </div>
      )}

      {/* Main Product Grid */}
      <div className="mb-16">
        <h2 className="mb-5 text-lg font-bold text-gray-900 dark:text-white">
          {category === "All" ? "All Products" : `${category} Products`}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map(renderProductCard)}
        </div>
      </div>

      {/* Recently Viewed Section */}
      {recentProducts.length > 0 && (
        <div className="mt-16 pt-10 border-t border-gray-200 dark:border-night-700">
          <h2 className="mb-5 text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Clock className="h-5 w-5 text-gray-500" /> Recently Viewed
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recentProducts.map(renderProductCard)}
          </div>
        </div>
      )}

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
      {cartOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-xs"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col border-l border-gray-100 bg-white shadow-2xl dark:border-night-600 dark:bg-night-800"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "slideInRight 0.25s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            {/* Cart header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-night-600 shrink-0">
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
              <div className="border-t border-gray-100 px-6 py-5 dark:border-night-600 shrink-0 bg-white dark:bg-night-800">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    Rs. {total.toLocaleString("en-IN")}
                  </span>
                </div>
                <Link
                  to="/checkout"
                  onClick={() => setCartOpen(false)}
                  className="btn-primary w-full justify-center py-3 text-base font-bold shadow-lg shadow-brand/20"
                >
                  Proceed to Checkout
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/orders"
                  onClick={() => setCartOpen(false)}
                  className="mt-3 block text-center text-sm text-gray-400 transition hover:text-brand"
                >
                  View my orders →
                </Link>
              </div>
            )}
          </div>
        </div>,
        document.body
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
