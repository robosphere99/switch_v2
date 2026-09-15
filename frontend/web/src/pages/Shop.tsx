import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getProducts, type Product } from "../api/shop";
import { useCartStore } from "../stores/cart";
import { ProductCard } from "../components/ProductCard";
import { ProductDetailsModal } from "../components/ProductDetailsModal";
import { CartDrawer } from "../components/shop/CartDrawer";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { ShoppingBag, Flame, Sparkles, Clock } from "lucide-react";
import { safeStorage } from "../lib/safeStorage";

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
      return JSON.parse(safeStorage.getItem("recentProducts") || "[]");
    } catch {
      return [];
    }
  });

  const items = useCartStore((s) => s.items);
  const add = useCartStore((s) => s.add);
  const remove = useCartStore((s) => s.remove);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const count = useCartStore((s) => s.count());
  const [params] = useSearchParams();
  const highlightId = params.get("product") ? Number(params.get("product")) : null;
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    getProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => {
        setProducts([]);
        setError("Failed to load products. Please check server connectivity.");
      });
  }, []);

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setRecentViewIds((prev) => {
      const next = [p.id, ...prev.filter((id) => id !== p.id)].slice(0, 4);
      safeStorage.setItem("recentProducts", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (!highlightId || (products?.length ?? 0) === 0) return;
    const t = setTimeout(() => {
      cardRefs.current[highlightId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      const p = (products || []).find((prod) => prod.id === highlightId);
      if (p) handleSelectProduct(p);
    }, 350);
    return () => clearTimeout(t);
  }, [highlightId, products]);

  // Derivations
  const filteredProducts = (products || []).filter((p) => {
    if (category === "All") return true;
    const f = p.features as any;
    if (category === "Relays") return f?.channels;
    if (category === "Dimmers") return f?.dimmer || f?.fanDimmer;
    if (category === "Plugs & Extras") return !f?.channels && !f?.dimmer && !f?.fanDimmer;
    return true;
  });

  const trending = [...(products || [])].sort((a, b) => Number(b.price || 0) - Number(a.price || 0)).slice(0, 4);
  const suggestions = [...(products || [])].filter((p) => !trending.find((t) => t.id === p.id)).sort(() => Math.random() - 0.5).slice(0, 4);
  const recentProducts = recentViewIds.map((id) => (products || []).find((p) => p.id === id)).filter(Boolean) as Product[];

  const renderProductCard = (p: Product) => {
    const cartItem = items.find((i) => i.productId === p.id);
    const cartQuantity = cartItem ? cartItem.quantity : 0;
    return (
      <ProductCard
        key={p.id}
        p={p}
        cartQuantity={cartQuantity}
        highlighted={highlightId === p.id}
        ref={(el) => {
          cardRefs.current[p.id] = el;
        }}
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
    <div className="page-enter mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            SwitchNest Hardware Store
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Factory tested ESP32 touch switches with unique cryptographic serial codes.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setCartOpen(true)}
          leftIcon={<ShoppingBag className="h-4 w-4" />}
        >
          Cart
          {count > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/25 px-1.5 text-[11px] font-bold">
              {count}
            </span>
          )}
        </Button>
      </div>

      {error && (
        <div className="mb-8">
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              category === c
                ? "bg-brand text-white shadow-sm shadow-brand/20"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
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
            <h2 className="mb-4 text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Flame className="h-4 w-4 text-amber-500" /> Popular Boards
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {trending.slice(0, 2).map(renderProductCard)}
            </div>
          </div>

          {/* Suggestions Section */}
          <div className="flex-1">
            <h2 className="mb-4 text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-brand" /> Recommended For You
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {suggestions.slice(0, 2).map(renderProductCard)}
            </div>
          </div>
        </div>
      )}

      {/* Main Product Grid */}
      <div className="mb-16">
        <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
          {category === "All" ? "All Hardware Boards" : `${category} Boards`}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map(renderProductCard)}
        </div>
      </div>

      {/* Recently Viewed Section */}
      {recentProducts.length > 0 && (
        <div className="mt-16 pt-10 border-t border-slate-200 dark:border-slate-800">
          <h2 className="mb-4 text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Clock className="h-4 w-4 text-slate-400" /> Recently Viewed
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recentProducts.map(renderProductCard)}
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {selectedProduct && (() => {
        const cartItem = items.find((i) => i.productId === selectedProduct.id);
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

      {/* Cart Drawer */}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
