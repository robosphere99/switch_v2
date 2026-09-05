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

  const rating = Number((p.features as any)?.rating || 5);
  const reviewsCount = Number(
    (p.features as any)?.reviewCount || (p.id === 1 ? 42 : p.id === 2 ? 1 : p.id === 3 ? 13 : (p.id * 9) % 50 + 3)
  );

  const priceNum = Number(p.price) || 0;
  const originalPriceNum =
    Number((p.features as any)?.originalPrice) ||
    Math.round((priceNum * 3.1) / 100) * 100 - 1;

  const formatRs = (val: number) => `Rs. ${val.toLocaleString("en-IN")}.00`;

  return (
    <div
      ref={ref}
      onClick={onClick}
      style={highlighted ? { scrollMarginTop: 90 } : undefined}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white dark:bg-night-800 transition-all duration-250
        hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/80 dark:hover:shadow-black/40 ${
        highlighted
          ? "border-brand shadow-lg shadow-brand/15 ring-2 ring-brand/25"
          : "border-gray-100 dark:border-night-600 hover:border-gray-200 dark:hover:border-night-500"
      }`}
    >
      {/* Top Left Badge */}
      <div className="absolute left-3 top-3 z-10">
        {p.upcoming ? (
          <span className="inline-flex items-center justify-center rounded-full bg-blue-500 px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">
            Upcoming
          </span>
        ) : isSoldOut ? (
          <span className="inline-flex items-center justify-center rounded-full bg-amber-500 px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">
            Sold Out
          </span>
        ) : (
          <span className="inline-flex items-center justify-center rounded-full bg-amber-500 px-3.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
            Sale
          </span>
        )}
      </div>

      {/* Model Code Chip — Top Right */}
      <div className="absolute right-3 top-3 z-10">
        <span className="rounded-full bg-gray-900/60 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white backdrop-blur dark:bg-black/50">
          {p.modelCode}
        </span>
      </div>

      {/* Product Image */}
      <div className="relative flex h-52 w-full items-center justify-center overflow-hidden bg-gray-50 dark:bg-night-700 p-4">
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

      {/* Content */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Name */}
        <h3 className="mb-2 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 group-hover:text-brand transition-colors duration-150">
          {p.name}
        </h3>

        {/* Optional Description */}
        {showDescription && p.description && (
          <p className="mb-3 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
            {p.description}
          </p>
        )}

        {/* Stars & Reviews */}
        <div className="mb-3 flex items-center gap-1.5">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${
                  i < rating
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {reviewsCount} {reviewsCount === 1 ? "review" : "reviews"}
          </span>
        </div>

        {/* Pricing */}
        <div className="mb-4 flex items-baseline gap-2">
          {originalPriceNum > priceNum && (
            <span className="text-xs text-gray-400 line-through">
              {formatRs(originalPriceNum)}
            </span>
          )}
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {formatRs(priceNum)}
          </span>
        </div>

        {/* Action */}
        <div className="mt-auto">
          {p.upcoming ? (
            <button
              disabled
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-medium text-blue-400 cursor-not-allowed dark:border-night-600 dark:bg-night-700 dark:text-blue-500"
            >
              Coming Soon
            </button>
          ) : isSoldOut ? (
            <button
              disabled
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-xl border border-gray-200 bg-gray-100 py-2.5 text-sm font-medium text-gray-400 cursor-not-allowed dark:border-night-600 dark:bg-night-700 dark:text-gray-500"
            >
              Soldout
            </button>
          ) : cartQuantity === 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd?.();
              }}
              className="btn-primary w-full py-2.5 text-sm"
            >
              Add to cart
            </button>
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex w-full items-center justify-between rounded-xl bg-brand p-1 text-white shadow-sm"
            >
              <button
                onClick={() => onUpdateQuantity?.(cartQuantity - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-lg font-bold transition-colors"
              >
                −
              </button>
              <span className="text-sm font-semibold px-2">
                {cartQuantity} in cart
              </span>
              <button
                onClick={() => onUpdateQuantity?.(cartQuantity + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-lg font-bold transition-colors"
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
