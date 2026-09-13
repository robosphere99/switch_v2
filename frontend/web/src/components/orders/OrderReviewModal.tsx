import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { Star } from "lucide-react";

export interface OrderReviewModalProps {
  item: { productId: number; productName: string } | null;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  isSubmitting: boolean;
}

export function OrderReviewModal({
  item,
  onClose,
  onSubmit,
  isSubmitting,
}: OrderReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  if (!item) return null;

  return (
    <Modal title="Rate Product" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="font-semibold text-sm text-slate-900 dark:text-white">{item.productName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Share your experience with this device</p>
        </div>

        <div className="flex justify-center gap-2 py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="p-1 transition transform hover:scale-110 focus:outline-none"
            >
              <Star
                className={`h-7 w-7 ${
                  star <= rating ? "text-amber-500 fill-amber-500" : "text-slate-300 dark:text-slate-700"
                }`}
              />
            </button>
          ))}
        </div>

        <Textarea
          label="Your Review"
          rows={4}
          placeholder="How was the build quality, WiFi setup, and daily responsiveness?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSubmit(rating, comment)}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            Submit Review
          </Button>
        </div>
      </div>
    </Modal>
  );
}
