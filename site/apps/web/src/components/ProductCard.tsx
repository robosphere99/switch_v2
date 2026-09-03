import { forwardRef } from "react";
import { Star } from "lucide-react";
import type { Product } from "../api/shop";

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

export const ProductCard = forwardRef<
  HTMLDivElement,
  {
    p: Product;
    cartQuantity?: number;
    onAdd?: () => void;
    onUpdateQuantity?: (qty: number) => void;
    onClick?: () => void;
    highlighted?: boolean;
    showDescription?: boolean;
  }
>(function ProductCard(
  { p, cartQuantity = 0, onAdd, onUpdateQuantity, onClick, highlighted, showDescription = false },
  ref
) {
  const isSoldOut = !p.active || Boolean((p.features as any)?.soldOut);

  // Derived values for realistic shop appearance matching design request
  const rating = Number((p.features as any)?.rating || 5);
  const reviewsCount = Number(
    (p.features as any)?.reviewCount || (p.id === 1 ? 42 : p.id === 2 ? 1 : p.id === 3 ? 13 : (p.id * 9) % 50 + 3)
  );

  const priceNum = Number(p.price) || 0;
  const originalPriceNum =
    Number((p.features as any)?.originalPrice) ||
    Math.round((priceNum * 3.1) / 100) * 100 - 1;

  const formatRs = (val: number) => {
    return `Rs. ${val.toLocaleString("en-IN")}.00`;
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      style={highlighted ? { scrollMarginTop: 90 } : undefined}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-slate-300/50 dark:hover:shadow-black/60 ${
        highlighted
          ? "border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/40"
          : "border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700/50"
      }`}
    >
      {/* Top Left Badge */}
      <div className="absolute left-3 top-3 z-10">
        {isSoldOut ? (
          <span className="inline-flex items-center justify-center rounded-full bg-[#f4a127] px-3 py-1 text-[11px] font-bold text-white shadow-sm">
            Sold Out
          </span>
        ) : (
          <span className="inline-flex items-center justify-center rounded-full bg-[#f4a127] px-3.5 py-1 text-[11px] font-bold text-white shadow-sm">
            Sale
          </span>
        )}
      </div>

      {/* Model Code Chip Top Right */}
      <div className="absolute right-3 top-3 z-10">
        <span className="rounded-full bg-slate-900/70 dark:bg-slate-800/80 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white backdrop-blur">
          {p.modelCode}
        </span>
      </div>

      {/* Product Image Container */}
      <div className="relative flex h-52 w-full items-center justify-center overflow-hidden bg-slate-100/70 dark:bg-slate-800/40 p-4">
        {p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt={p.name}
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl transition-transform duration-500 group-hover:scale-110">
            {MODEL_ICON[p.modelCode] ?? "📦"}
          </div>
        )}
      </div>

      {/* Product Details Content */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Title */}
        <h3 className="mb-2 line-clamp-2 min-h-[2.5rem] text-sm sm:text-base font-semibold leading-snug text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {p.name}
        </h3>

        {/* Optional Description */}
        {showDescription && p.description && (
          <p className="mb-3 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {p.description}
          </p>
        )}

        {/* Rating & Reviews */}
        <div className="mb-3 flex items-center gap-1">
          <div className="flex items-center text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < rating
                    ? "fill-amber-400 text-amber-400"
                    : "fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700"
                }`}
              />
            ))}
          </div>
          <span className="ml-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
            {reviewsCount} {reviewsCount === 1 ? "review" : "reviews"}
          </span>
        </div>

        {/* Pricing */}
        <div className="mb-4 flex items-baseline gap-2">
          {originalPriceNum > priceNum && (
            <span className="text-xs sm:text-sm text-slate-400 line-through">
              {formatRs(originalPriceNum)}
            </span>
          )}
          <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {formatRs(priceNum)}
          </span>
        </div>

        {/* Bottom Action Button */}
        <div className="mt-auto pt-1">
          {isSoldOut ? (
            <button
              disabled
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg bg-[#3b79ab]/50 text-white py-2.5 text-sm font-medium cursor-not-allowed transition-all opacity-80"
            >
              Soldout
            </button>
          ) : cartQuantity === 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd?.();
              }}
              className="w-full rounded-lg bg-[#3b79ab] hover:bg-[#316996] active:bg-[#28577e] text-white py-2.5 text-sm font-medium transition-all shadow-sm hover:shadow"
            >
              Add to cart
            </button>
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex w-full items-center justify-between rounded-lg bg-[#3b79ab] p-1 text-white shadow-sm"
            >
              <button
                onClick={() => onUpdateQuantity?.(cartQuantity - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-black/20 hover:bg-black/40 text-lg font-bold transition-colors"
              >
                −
              </button>
              <span className="text-sm font-semibold px-2">
                {cartQuantity} in cart
              </span>
              <button
                onClick={() => onUpdateQuantity?.(cartQuantity + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-black/20 hover:bg-black/40 text-lg font-bold transition-colors"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
