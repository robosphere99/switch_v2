import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, Alert, DeviceEventEmitter, TextInput } from 'react-native';
import { Package, Truck, CheckCircle, ChevronLeft, CalendarClock, Wifi, Star, Search, Filter } from 'lucide-react-native';
import { getMyOrders, Order, initiatePayment, verifyPayment, demoPay, addProductReview } from '../api/shop';
import RazorpayCheckout from 'react-native-razorpay';
import { useTheme } from '../theme/ThemeContext';
import { useThemedAlert } from './ThemedAlert';

interface OrdersScreenProps {
    visible: boolean;
    onClose: () => void;
}

export function OrdersScreen({ visible, onClose }: OrdersScreenProps) {
    const { theme } = useTheme();
    const { showAlert, AlertComponent } = useThemedAlert();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
    const [reviewItem, setReviewItem] = useState<any>(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        let interval: any;
        let sub: any;

        if (visible) {
            fetchOrders(true);

            // Poll for fresh order records every 8 seconds silently
            interval = setInterval(() => {
                fetchOrders(false);
            }, 8000);

            // Listen to WebSocket notification sync triggers
            sub = DeviceEventEmitter.addListener('notification_sync', () => {
                fetchOrders(false);
            });
        }

        return () => {
            if (interval) clearInterval(interval);
            if (sub) sub.remove();
        };
    }, [visible]);

    const fetchOrders = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const data = await getMyOrders();
            // Sort by latest created
            setOrders(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        } catch (e) {
            console.error("Order fetch failed: ", e);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handlePay = async (orderId: number) => {
        setPayingOrderId(orderId);
        try {
            console.log(`[PAYMENT DEBUG] handlePay triggered for orderId: ${orderId}`);
            const intent = await initiatePayment(orderId);
            if (intent.mode === 'demo') {
                await demoPay(orderId);
                showAlert('Demo Mode Test', 'Payment was successful via demo mode.');
                await fetchOrders();
            } else {
                const isRazorpayAvailable = !!RazorpayCheckout && typeof RazorpayCheckout.open === 'function';

                if (!isRazorpayAvailable) {
                    showAlert(
                        'Razorpay (Expo Go)',
                        'Native Razorpay is not supported in the Expo Go sandbox. Would you like to use Demo Mode to mock this payment?',
                        [
                            {
                                text: 'Cancel',
                                style: 'cancel',
                                onPress: () => { }
                            },
                            {
                                text: 'Mock Pay (Success)',
                                style: 'default',
                                onPress: async () => {
                                    setPayingOrderId(orderId);
                                    try {
                                        await demoPay(orderId);
                                        showAlert('Mock Payment', 'Demo test payment completed successfully.');
                                        await fetchOrders();
                                    } catch (e: any) {
                                        showAlert('Error', e.message || 'Mock payment failed.');
                                    } finally {
                                        setPayingOrderId(null);
                                    }
                                }
                            }
                        ],
                        'confirm'
                    );
                    setPayingOrderId(null);
                    return;
                }

                const options = {
                    description: `Order #${orderId}`,
                    currency: 'INR',
                    key: intent.keyId,
                    amount: intent.amount * 100, // amount in paise
                    name: 'SwitchNest',
                    order_id: intent.razorpayOrderId ?? "",
                    theme: { color: theme.primary },
                    prefill: {
                        name: "SwitchNest User",
                        email: "support@switchnest.com",
                        contact: "9999999999"
                    }
                };

                // Open Native Razorpay 
                const response = await RazorpayCheckout.open(options);

                // Verify with backend
                await verifyPayment(orderId, {
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                });

                showAlert('Payment Success', 'Your payment was verified!');
                await fetchOrders();
            }
        } catch (error: any) {
            console.error("Payment error:", error);
            let parsedMsg = "Payment failed or cancelled";

            // The Razorpay React Native wrapper often stringifies the JSON payload into error.description
            if (error?.description && typeof error.description === 'string') {
                try {
                    const parsed = JSON.parse(error.description);
                    if (parsed?.error) {
                        parsedMsg = parsed.error.description || parsed.error.reason || error.description;
                    } else {
                        parsedMsg = error.description;
                    }
                } catch (e) {
                    parsedMsg = error.description;
                }
            } else if (error?.message) {
                parsedMsg = error.message;
            } else if (error?.error?.description) {
                parsedMsg = error.error.description;
            } else if (error?.description) {
                parsedMsg = String(error.description);
            }

            // Remove useless "undefined" strings thrown by internal razorpay logic if reason is absent
            if (parsedMsg === "undefined" || !parsedMsg || parsedMsg.includes("undefined")) {
                parsedMsg = "Payment failed or cancelled";
            }

            showAlert('Payment Failed', String(parsedMsg));
        } finally {
            setPayingOrderId(null);
        }
    };

    
    const handleReviewSubmit = async () => {
        if(!reviewItem) return;
        try {
            await addProductReview(reviewItem.productId, { rating: reviewRating, comment: reviewComment });
            showAlert('Success', 'Review submitted successfully!');
            setReviewItem(null);
            setReviewComment('');
            setReviewRating(5);
        } catch(e: any) {
            showAlert('Error', e.message || 'Failed to submit review');
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        let color = theme.textSecondary;
        let icon = <CalendarClock color={color} size={14} />;

        switch (status) {
            case 'paid':
            case 'shipped':
                color = theme.primary;
                icon = <Truck color={color} size={14} />;
                break;
            case 'delivered':
                color = '#22c55e'; // Green
                icon = <CheckCircle color={color} size={14} />;
                break;
            case 'cancelled':
                color = '#ef4444'; // Red
                break;
        }

        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${color}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                {icon}
                <Text style={{ color, fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>{status}</Text>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>

                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.card }]}>
                        <ChevronLeft color={theme.text} size={24} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: theme.text }]}>Purchase History</Text>
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.scroll}>
                        {orders
                            .filter(o => statusFilter === 'all' || o.status === statusFilter)
                            .filter(o => !searchQuery || o.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase())))
                            .length === 0 ? (
                            <View style={[styles.center, { marginTop: '50%' }]}>
                                <Package color={theme.border} size={64} />
                                <Text style={{ color: theme.textSecondary, marginTop: 16, fontSize: 16 }}>No orders found.</Text>
                            </View>
                        ) : (
                            orders.map((order) => (
                                <View key={order.id} style={[styles.orderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                        <View>
                                            <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 16 }}>{order.orderNumber}</Text>
                                            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </Text>
                                        </View>
                                        <StatusBadge status={order.status} />
                                    </View>

                                    <View style={[styles.divider, { borderColor: theme.border }]} />

                                    {order.status === 'pending' && order.paymentMethod !== 'cod' && (
                                        <>
                                            {order.paymentStatus === 'failed' && (
                                                <Text style={{ color: '#ef4444', fontSize: 13, marginBottom: 8, textAlign: 'center', fontWeight: 'bold' }}>
                                                    Last payment attempt failed.
                                                </Text>
                                            )}
                                            <TouchableOpacity
                                                onPress={() => handlePay(order.id)}
                                                disabled={payingOrderId !== null}
                                                style={[
                                                    styles.payButton,
                                                    { backgroundColor: order.paymentStatus === 'failed' ? '#ef4444' : theme.primary, opacity: payingOrderId === order.id ? 0.7 : 1 }
                                                ]}
                                            >
                                                {payingOrderId === order.id ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Text style={styles.payButtonText}>{order.paymentStatus === 'failed' ? '⚠️ Retry Payment' : '💳 Pay Now'}</Text>
                                                )}
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    {order.items.map((item, idx) => (
                                        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }}>
                                            
                                            <View>
                                                <Text style={{ color: theme.text, fontSize: 14 }}><Text style={{ color: theme.textSecondary }}>{item.quantity}x </Text>{item.productName}</Text>
                                                {order.status === 'delivered' && (
                                                    <TouchableOpacity onPress={() => { setReviewItem(item); setReviewRating(5); setReviewComment(''); }}>
                                                        <Text style={{ color: theme.primary, fontSize: 12, marginTop: 4, fontWeight: 'bold' }}>Write a Review</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>₹{parseFloat(item.price).toLocaleString('en-IN')}</Text>
                                        </View>
                                    ))}

                                    <View style={[styles.divider, { borderColor: theme.border }]} />

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View>
                                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Total Paid</Text>
                                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>₹{parseFloat(order.totalAmount).toLocaleString('en-IN')}</Text>
                                        </View>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{order.paymentMethod.toUpperCase()}</Text>
                                    </View>

                                </View>
                            ))
                        )}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                )}
                {AlertComponent}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16 },
    closeBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    title: { fontSize: 24, fontWeight: '800' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 24 },
    orderCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
    divider: { borderBottomWidth: 1, marginVertical: 12, borderStyle: 'dashed' },
    payButton: { padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12, justifyContent: 'center' },
    payButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
