import { create } from 'zustand';
import { Product } from '../api/shop';

interface CartItem {
    product: Product;
    qty: number;
}

interface CartStore {
    cart: CartItem[];
    addToCart: (product: Product) => void;
    decreaseQty: (product: Product) => void;
    removeFromCart: (productId: number) => void;
    clearCart: () => void;
}

export const useCartStore = create<CartStore>((set) => ({
    cart: [],
    addToCart: (product) => set((state) => {
        const existing = state.cart.find(c => c.product.id === product.id);
        if (existing) {
            return {
                cart: state.cart.map(c => c.product.id === product.id ? { ...c, qty: Math.min(c.qty + 1, product.stockCount || 999) } : c)
            };
        }
        return { cart: [...state.cart, { product, qty: 1 }] };
    }),
    decreaseQty: (product) => set((state) => {
        const existing = state.cart.find(c => c.product.id === product.id);
        if (existing && existing.qty > 1) {
            return {
                cart: state.cart.map(c => c.product.id === product.id ? { ...c, qty: c.qty - 1 } : c)
            };
        }
        return { cart: state.cart.filter(c => c.product.id !== product.id) };
    }),
    removeFromCart: (productId) => set((state) => ({
        cart: state.cart.filter(c => c.product.id !== productId)
    })),
    clearCart: () => set({ cart: [] })
}));
