import { useState } from "react";
import { type Product } from "../api/shop";

export function ProductDetailsModal({
  product,
  cartQuantity,
  onClose,
  onAdd,
  onUpdateQuantity
}: {
  product: Product;
  cartQuantity: number;
  onClose: () => void;
  onAdd: () => void;
  onUpdateQuantity: (qty: number) => void;
}) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({ transform: "scale(1)", transformOrigin: "center center" });

  // Fallback if no media exists
  const hasMedia = product.media && product.media.length > 0;
  
  // Create an array of media to display (combines cover image and product media)
  // If product.media exists, we use it. If not, we just use imageUrl if it exists.
  const displayMedia = hasMedia 
    ? product.media! 
    : (product.imageUrl ? [{ id: 0, url: product.imageUrl, type: "image", productId: product.id, createdAt: "" }] : []);
    
  const activeMedia = displayMedia[activeMediaIndex];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeMedia?.type === "video") return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: "scale(2)",
    });
  };

  const handleMouseLeave = () => {
    setZoomStyle({ transform: "scale(1)", transformOrigin: "center center" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div 
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-night-600 bg-night-800 shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button (Mobile Floating) */}
        <button 
          onClick={onClose} 
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-night-900/80 text-gray-400 backdrop-blur hover:bg-night-900 hover:text-white md:hidden"
        >
          ✕
        </button>

        {/* Media Section */}
        <div className="flex bg-night-900 md:w-1/2 flex-col">
          {/* Main Display */}
          <div className="relative flex aspect-square w-full items-center justify-center bg-black/20 p-6 md:aspect-auto md:flex-1 overflow-hidden">
            {displayMedia.length > 0 ? (
              activeMedia.type === "video" ? (
                <video 
                  src={activeMedia.url} 
                  controls 
                  className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
                  autoPlay
                  muted
                  loop
                />
              ) : (
                <div 
                  className="relative flex h-full w-full cursor-crosshair items-center justify-center overflow-hidden rounded-lg"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  <img 
                    src={activeMedia.url} 
                    alt={product.name} 
                    className="max-h-full max-w-full object-contain shadow-lg transition-transform duration-100 ease-out"
                    style={zoomStyle}
                  />
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-600">
                <span className="mb-2 text-6xl">📦</span>
                <span className="text-sm font-medium">No Image Available</span>
              </div>
            )}
          </div>
          
          {/* Thumbnails */}
          {displayMedia.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-t border-night-700 bg-night-950 p-4 scrollbar-hide">
              {displayMedia.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMediaIndex(idx)}
                  className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 transition-all ${activeMediaIndex === idx ? "border-brand shadow-md shadow-brand/20" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  {m.type === "video" ? (
                    <div className="flex h-full w-full items-center justify-center bg-night-800 text-brand">▶</div>
                  ) : (
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details Section */}
        <div className="flex flex-col overflow-y-auto p-6 md:w-1/2 md:p-8">
          {/* Close Button (Desktop) */}
          <button 
            onClick={onClose} 
            className="absolute right-6 top-6 hidden text-gray-400 hover:text-white md:block"
          >
            ✕
          </button>
          
          <div className="mb-2">
            <span className="mb-2 inline-block rounded bg-brand/20 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-brand">
              {product.modelCode}
            </span>
            <h2 className="text-3xl font-bold text-white">{product.name}</h2>
          </div>
          
          <div className="mb-6 text-2xl font-bold text-brand">
            ₹{Number(product.price).toLocaleString("en-IN")}
          </div>
          
          <div className="mb-6 text-base leading-relaxed text-gray-400">
            {product.description || "No description provided."}
          </div>
          
          {/* Features */}
          {product.features && Object.keys(product.features).length > 0 && (
            <div className="mb-8">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">Key Features</h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                {Object.entries(product.features).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="text-brand">✓</span>
                    <span className="text-sm font-medium text-gray-300 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span className="text-sm text-gray-400">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto pt-6">
            {cartQuantity === 0 ? (
              <button
                onClick={() => {
                  onAdd();
                  // Optional: onClose(); if we want it to close. But Blinkit keeps it open and shows the stepper.
                }}
                className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white shadow-lg shadow-brand/25 transition-all hover:-translate-y-1 hover:bg-brand-500 hover:shadow-brand/40"
              >
                Add to Cart
              </button>
            ) : (
              <div className="flex w-full items-center justify-between overflow-hidden rounded-xl bg-brand shadow-lg shadow-brand/30 transition-all animate-in zoom-in-95 duration-200">
                <button
                  onClick={() => onUpdateQuantity(cartQuantity - 1)}
                  className="flex h-14 flex-1 items-center justify-center bg-black/10 text-2xl font-light text-white hover:bg-black/20 transition-colors"
                >
                  −
                </button>
                <div className="flex flex-col items-center justify-center px-6">
                  <span className="text-xl font-bold text-white">{cartQuantity}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">in cart</span>
                </div>
                <button
                  onClick={() => onUpdateQuantity(cartQuantity + 1)}
                  className="flex h-14 flex-1 items-center justify-center bg-black/10 text-2xl font-light text-white hover:bg-black/20 transition-colors"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
