import { api } from './client';

export interface Product {
    id: number;
    name: string;
    modelCode: string;
    relayCount: number;
    price: string;
    description: string | null;
    features: Record<string, unknown> | null;
    imageUrl: string | null;
    active: boolean;
}

export interface OrderItem {
    id: number;
    orderId: number;
    productId: number;
    productName: string;
    price: string;
    quantity: number;
    serialCode: string | null;
}

export interface Order {
    id: number;
    orderNumber: string;
    status: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
    paymentMethod: "cod" | "upi" | "manual";
    paymentStatus: string;
    totalAmount: string;
    createdAt: string;
    items: OrderItem[];
}

export async function getProducts(): Promise<Product[]> {
    const { data } = await api.get('/shop/products');
    return data.data;
}

export async function createOrder(payload: {
    items: Array<{ productId: number; quantity: number }>;
    shipping: { name: string; phone: string; address: string };
    wifi?: { ssid: string; password: string };
    paymentMethod: "cod" | "upi" | "manual";
}): Promise<Order> {
    const { data } = await api.post('/shop/orders', payload);
    return data.data;
}

export async function getMyOrders(): Promise<Order[]> {
    const { data } = await api.get('/shop/orders');
    return data.data;
}

export async function cancelOrder(id: number): Promise<void> {
    await api.post(`/shop/orders/${id}/cancel`);
}

export async function demoPay(orderId: number): Promise<{ paid: boolean; status: string; paymentRef?: string }> {
    const { data } = await api.post(`/shop/orders/${orderId}/pay/demo`);
    return data.data;
}

export interface PayIntent {
    mode: "razorpay" | "demo";
    razorpayOrderId?: string;
    keyId?: string;
    upiIntent?: string;
    amount: number;
    note?: string;
}

export async function initiatePayment(orderId: number): Promise<PayIntent> {
    const { data } = await api.post(`/shop/orders/${orderId}/pay`);
    return data.data;
}

export async function verifyPayment(orderId: number, payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
    const { data } = await api.post(`/shop/orders/${orderId}/pay/verify`, payload);
    return data.data;
}
