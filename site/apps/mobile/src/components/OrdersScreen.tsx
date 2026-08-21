import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { Package, Truck, CheckCircle, ChevronLeft, CalendarClock, Wifi } from 'lucide-react-native';
import { getMyOrders, Order } from '../api/shop';
import { useTheme } from '../theme/ThemeContext';

interface OrdersScreenProps {
    visible: boolean;
    onClose: () => void;
}

export function OrdersScreen({ visible, onClose }: OrdersScreenProps) {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        if (visible) {
            fetchOrders();
        }
    }, [visible]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const data = await getMyOrders();
            // Sort by latest created
            setOrders(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        } catch (e) {
            console.error("Order fetch failed: ", e);
        } finally {
            setLoading(false);
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
                        {orders.length === 0 ? (
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

                                    {order.items.map((item, idx) => (
                                        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }}>
                                            <Text style={{ color: theme.text, fontSize: 14 }}><Text style={{ color: theme.textSecondary }}>{item.quantity}x </Text>{item.productName}</Text>
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
    divider: { borderBottomWidth: 1, marginVertical: 12, borderStyle: 'dashed' }
});
