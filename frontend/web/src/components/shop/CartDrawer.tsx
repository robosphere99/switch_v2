import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useCartStore } from "../../stores/cart";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { X, Minus, Plus, Trash2, ArrowRight, ShoppingBag } from "lucide-react";

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const items = useCartStore((s) => s.items);
  const remove = useCartStore((s) => s.remove);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const total = useCartStore((s) => s.total());

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "slideInRight 0.25s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Cart header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-brand" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Your Shopping Cart</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="py-16">
              <EmptyState
                icon={<ShoppingBag className="h-8 w-8 text-slate-400" />}
                title="Your Cart is Empty"
                description="Browse our smart touch boards and add them to your cart."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((i) => (
                <div
                  key={i.productId}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {i.name}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      ₹{i.price.toLocaleString("en-IN")} × {i.quantity} ={" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        ₹{(i.price * i.quantity).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQuantity(i.productId, i.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-slate-900 dark:text-white">
                      {i.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(i.productId, i.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(i.productId)}
                      className="ml-1 p-1 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Remove item"
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
          <div className="border-t border-slate-100 p-6 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Subtotal</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                ₹{total.toLocaleString("en-IN")}
              </span>
            </div>
            <Link
              to="/checkout"
              onClick={onClose}
              className="block"
            >
              <Button variant="primary" size="lg" className="w-full" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Proceed to Checkout
              </Button>
            </Link>
            <Link
              to="/orders"
              onClick={onClose}
              className="block text-center text-xs font-medium text-slate-400 hover:text-brand transition-colors"
            >
              View past orders →
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
