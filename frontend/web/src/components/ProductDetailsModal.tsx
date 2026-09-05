import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { type Product, type ProductReview, getProductReviews } from "../api/shop";
import { ChevronLeft, ChevronRight, X, Star } from "lucide-react";

type Tab = "details" | "specs" | "faqs" | "reviews";

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
  const thumbsRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  // Fallback if no media exists
  const hasMedia = product.media && product.media.length > 0;
  
  // Create an array of media to display (combines cover image and product media)
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

  const scrollThumbnails = (dir: "left" | "right") => {
    if (!thumbsRef.current) return;
    thumbsRef.current.scrollBy({
      left: dir === "left" ? -160 : 160,
      behavior: "smooth",
    });
  };

  const goToPrevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayMedia.length <= 1) return;
    const prevIdx = (activeMediaIndex - 1 + displayMedia.length) % displayMedia.length;
    setActiveMediaIndex(prevIdx);
  };

  const goToNextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayMedia.length <= 1) return;
    const nextIdx = (activeMediaIndex + 1) % displayMedia.length;
    setActiveMediaIndex(nextIdx);
  };

  // Scroll active thumbnail into view whenever activeMediaIndex changes
  useEffect(() => {
    if (!thumbsRef.current) return;
    const activeEl = thumbsRef.current.children[activeMediaIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeMediaIndex]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // Fetch reviews on tab switch
  useEffect(() => {
    if (activeTab === "reviews" && !reviewsLoaded) {
      getProductReviews(product.id).then(res => {
        setReviews(res);
        setReviewsLoaded(true);
      }).catch(err => {
        console.error("Failed to load reviews:", err);
      });
    }
  }, [activeTab, product.id, reviewsLoaded]);

  const features = (product.features || {}) as any;
  const faqs = features.faqs || [];
  const specifications = features.specifications || [];

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto" 
      onClick={onClose}
    >
      <div 
        className="relative my-auto flex w-full max-w-5xl h-[85vh] flex-col overflow-hidden rounded-2xl border border-night-600 bg-night-800 shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Universal Close Button */}
        <button 
          onClick={onClose} 
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-night-900/90 text-gray-300 backdrop-blur hover:bg-night-950 hover:text-white transition shadow-lg border border-night-700"
          title="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Media Section */}
        <div className="flex bg-night-900 md:w-1/2 flex-col justify-between overflow-hidden min-h-[320px] md:min-h-0 border-r border-night-700">
          {/* Main Display */}
          <div className="relative flex aspect-square w-full items-center justify-center bg-black/20 p-4 md:aspect-auto md:flex-1 overflow-hidden min-h-0">
            {displayMedia.length > 0 && activeMedia ? (
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

            {displayMedia.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goToPrevMedia}
                  className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/80 hover:scale-105 active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={goToNextMedia}
                  className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/80 hover:scale-105 active:scale-95"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          
          {/* Thumbnails Row */}
          {displayMedia.length > 1 && (
            <div className="relative flex items-center gap-1.5 border-t border-night-700 bg-night-950 px-2 py-2.5 shrink-0">
              <button
                type="button"
                onClick={() => scrollThumbnails("left")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-night-800/90 text-gray-300 shadow hover:bg-night-700 hover:text-white transition active:scale-95 border border-night-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div
                ref={thumbsRef}
                className="flex flex-1 gap-2 overflow-x-auto scroll-smooth scrollbar-none [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {displayMedia.map((m, idx) => (
                  <button
                    key={m.id || idx}
                    onClick={() => setActiveMediaIndex(idx)}
                    className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 transition-all ${
                      activeMediaIndex === idx
                        ? "border-brand shadow-md shadow-brand/20 scale-105"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    {m.type === "video" ? (
                      <div className="flex h-full w-full items-center justify-center bg-night-800 text-brand font-bold text-[10px]">▶ VIDEO</div>
                    ) : (
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => scrollThumbnails("right")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-night-800/90 text-gray-300 shadow hover:bg-night-700 hover:text-white transition active:scale-95 border border-night-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Details Section */}
        <div className="flex flex-col md:w-1/2">
          
          <div className="p-6 md:px-8 md:pt-8 shrink-0">
            <div className="mb-2 pr-8">
              <span className="mb-2 inline-block rounded bg-brand/20 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-brand">
                {product.modelCode}
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white">{product.name}</h2>
              
              {/* Ratings */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center text-yellow-500">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="ml-1 text-sm font-bold">{Number(product.rating || 0).toFixed(1)}</span>
                </div>
                <span className="text-sm text-gray-500">({product.totalReviews || 0} reviews)</span>
              </div>
            </div>
            
            <div className="text-2xl font-bold text-brand">
              ₹{Number(product.price).toLocaleString("en-IN")}
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex border-b border-night-700 px-6 md:px-8">
            {(["details", "specs", "faqs", "reviews"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-3 text-sm font-semibold capitalize transition-colors ${
                  activeTab === tab ? "text-brand" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 h-0.5 w-full bg-brand rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* Scrollable Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 thin-scrollbar">
            
            {/* DETAILS TAB */}
            {activeTab === "details" && (
              <div className="animate-in fade-in duration-300">
                <div className="mb-6 text-base leading-relaxed text-gray-300">
                  {product.description || "No description provided."}
                </div>
                
                {/* Basic Key Features */}
                <div className="mb-8">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">Key Features</h3>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                    {Object.entries(features).filter(([k]) => !['faqs', 'specifications'].includes(k)).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-brand">✓</span>
                        <span className="text-sm font-medium text-gray-300 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="text-sm text-gray-400">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SPECS TAB */}
            {activeTab === "specs" && (
              <div className="animate-in fade-in duration-300">
                {specifications.length > 0 ? (
                  <div className="rounded-xl border border-night-700 bg-night-900/50 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <tbody>
                        {specifications.map((spec: any, idx: number) => (
                          <tr key={idx} className="border-b border-night-700 last:border-0">
                            <th className="py-3 px-4 bg-night-800/50 font-medium text-gray-400 w-1/3">{spec.label}</th>
                            <td className="py-3 px-4 text-gray-200">{spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No specifications listed.</p>
                )}
              </div>
            )}

            {/* FAQs TAB */}
            {activeTab === "faqs" && (
              <div className="animate-in fade-in duration-300 space-y-4">
                {faqs.length > 0 ? (
                  faqs.map((faq: any, idx: number) => (
                    <div key={idx} className="rounded-xl bg-night-900/50 p-4 border border-night-700">
                      <h4 className="font-semibold text-brand mb-2">{faq.question}</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{faq.answer}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No FAQs available.</p>
                )}
              </div>
            )}

            {/* REVIEWS TAB */}
            {activeTab === "reviews" && (
              <div className="animate-in fade-in duration-300">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Customer Reviews</h3>
                  <button className="text-sm text-brand font-semibold hover:underline">Write a Review</button>
                </div>

                {!reviewsLoaded ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
                  </div>
                ) : reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map(review => (
                      <div key={review.id} className="rounded-xl border border-night-700 bg-night-900/50 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-night-700 flex items-center justify-center text-xs font-bold text-gray-300">
                              {review.user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-200">{review.user.username}</div>
                              <div className="text-xs text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <div className="flex text-yellow-500">
                            {[1,2,3,4,5].map(star => (
                              <Star key={star} className={`h-3 w-3 ${star <= Number(review.rating) ? "fill-current" : "text-gray-600"}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {review.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-night-900/30 rounded-xl border border-dashed border-night-700">
                    <Star className="h-8 w-8 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No reviews yet.</p>
                    <p className="text-sm text-gray-500 mt-1">Be the first to review this product!</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Action Area */}
          <div className="border-t border-night-700 p-6 md:px-8 md:py-6 shrink-0 bg-night-800">
            {product.upcoming ? (
              <button disabled className="w-full rounded-xl bg-blue-500/10 py-4 text-lg font-bold text-blue-500 cursor-not-allowed">
                Coming Soon
              </button>
            ) : (!product.active || (product.features as any)?.soldOut) ? (
              <button disabled className="w-full rounded-xl bg-gray-500/10 py-4 text-lg font-bold text-gray-500 cursor-not-allowed">
                Sold Out
              </button>
            ) : cartQuantity === 0 ? (
              <button
                onClick={onAdd}
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
    </div>,
    document.body
  );
}
