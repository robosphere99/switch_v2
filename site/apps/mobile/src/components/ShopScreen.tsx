import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform, PermissionsAndroid, Animated, Easing } from 'react-native';
import { Star, MessageCircle, Plus, Minus } from 'lucide-react-native';
import { ShoppingCart, Package, CreditCard, Check, X, Truck, Wifi, Eye, EyeOff } from 'lucide-react-native';
import { getProducts, Product, createOrder, initiatePayment, verifyPayment, demoPay, cancelOrder, getCurrentWifiSsid } from '../api/shop';
import RazorpayCheckout from 'react-native-razorpay';
import { useTheme } from '../theme/ThemeContext';
import * as Haptics from 'expo-haptics';
import { OrdersScreen } from './OrdersScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedAlert } from './ThemedAlert';


const FlyingItem = ({ uri, startX, startY, onComplete }: { uri: string, startX: number, startY: number, onComplete: () => void }) => {
    const animX = React.useRef(new Animated.Value(startX)).current;
    const animY = React.useRef(new Animated.Value(startY)).current;
    const scale = React.useRef(new Animated.Value(1)).current;
    const opacity = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        // Approximate cart position (top right)
        const targetX = 350;
        const targetY = 60;

        Animated.parallel([
            Animated.timing(animX, { toValue: targetX, duration: 600, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
            Animated.timing(animY, { toValue: targetY, duration: 600, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 0.2, duration: 600, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 600, delay: 400, useNativeDriver: true }),
        ]).start(() => {
            onComplete();
        });
    }, []);

    return (
        <Animated.Image 
            source={{ uri }} 
            style={{ 
                position: 'absolute', zIndex: 1000, 
                width: 60, height: 60, borderRadius: 30,
                transform: [{ translateX: animX }, { translateY: animY }, { scale }],
                opacity
            }} 
        />
    );
};

export function ShopScreen() {
    const { theme } = useTheme();
    const { showAlert, AlertComponent } = useThemedAlert();
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [flyingItems, setFlyingItems] = useState<{id: string, uri: string, x: number, y: number}[]>([]);
    const cartScale = React.useRef(new Animated.Value(1)).current;

    // Local Cart State
    const [cart, setCart] = useState<{ product: Product, qty: number }[]>([]);
    const [cartVisible, setCartVisible] = useState(false);
    const [ordersVisible, setOrdersVisible] = useState(false);

    // Checkout State
    const [processing, setProcessing] = useState(false);
    const [successDisplay, setSuccessDisplay] = useState(false);
    const [showWifiPassword, setShowWifiPassword] = useState(false);
    const [shipping, setShipping] = useState({ name: '', phone: '', address: '' });
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi'>('cod');
    const [wifiConfig, setWifiConfig] = useState({ ssid: '', password: '' });
    const [savedWifis, setSavedWifis] = useState<{ ssid: string, password: string }[]>([]);

    // WiFi Connection State
    const [fetchingWifi, setFetchingWifi] = useState(false);

    useEffect(() => {
        loadDocs();
        loadSavedWifis();
    }, []);

    const loadSavedWifis = async () => {
        try {
            const data = await AsyncStorage.getItem('@switchnest_wifis');
            const parsed = data ? JSON.parse(data) : [];
            setSavedWifis(parsed);
        } catch (e) {
            console.error(e);
        }
    };

    const saveWifiNetwork = async (config: { ssid: string, password: string }) => {
        if (!config.ssid) return;
        try {
            const existing = savedWifis.find(w => w.ssid === config.ssid);
            let newWifis = savedWifis;
            if (!existing) {
                newWifis = [...savedWifis, config];
            } else if (existing.password !== config.password) {
                // Update password if changed for same SSID
                newWifis = savedWifis.map(w => w.ssid === config.ssid ? config : w);
            }
            await AsyncStorage.setItem('@switchnest_wifis', JSON.stringify(newWifis));
            setSavedWifis(newWifis);
        } catch (e) { }
    };

    const handleAutofillConnectedWifi = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setFetchingWifi(true);

        try {
            let activeSsid = '';

            // 1. Fall back to host machine's active network directly
            if (!activeSsid) {
                try {
                    const serverSsid = await getCurrentWifiSsid();
                    if (serverSsid) {
                        activeSsid = serverSsid;
                    }
                } catch (serverErr) {
                    console.warn("Failed to get SSID from server:", serverErr);
                }
            }

            if (!activeSsid) {
                showAlert('Autofill Failed', 'Unable to detect active WiFi network automatically. Please enter it manually.');
                return;
            }

            const matched = savedWifis.find(w => w.ssid === activeSsid);

            setWifiConfig({
                ssid: activeSsid,
                password: matched ? matched.password : ''
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (matched) {
                showAlert('Autofill Successful', `Connected to "${activeSsid}". Restored saved password.`);
            } else {
                showAlert('Connected to WiFi', `Connected to "${activeSsid}". Enter password to save.`);
            }
        } catch (e: any) {
            console.warn(e);
            showAlert('Autofill Failed', 'Unable to detect active WiFi connections.');
        } finally {
            setFetchingWifi(false);
        }
    };

    const loadDocs = async () => {
        try {
            const data = await getProducts();
            setProducts(data.filter(d => d.active));
        } catch (e: any) {
            console.error("Shop load error:", e.message);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product: Product, event?: any) => {
        if (event && product.imageUrl) {
            const { pageX, pageY } = event.nativeEvent;
            const newId = Math.random().toString();
            setFlyingItems(prev => [...prev, { id: newId, uri: product.imageUrl!, x: pageX - 30, y: pageY - 30 }]);
            setTimeout(() => {
                setFlyingItems(prev => prev.filter(f => f.id !== newId));
            }, 800);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCart(prev => {
            const existing = prev.find(p => p.product.id === product.id);
            if (existing) {
                return prev.map(p => p.product.id === product.id ? { ...p, qty: p.qty + 1 } : p);
            }
            return [...prev, { product, qty: 1 }];
        });
    };

    const decreaseQty = (product: Product) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCart(prev => {
            const existing = prev.find(p => p.product.id === product.id);
            if (existing && existing.qty > 1) {
                return prev.map(p => p.product.id === product.id ? { ...p, qty: p.qty - 1 } : p);
            }
            return prev.filter(p => p.product.id !== product.id);
        });
    };
    
    const removeFromCart = (productId: number) => {
        setCart(prev => prev.filter(p => p.product.id !== productId));
    };

    const getTotal = () => {
        return cart.reduce((acc, curr) => acc + (parseFloat(curr.product.price) * curr.qty), 0);
    };

    const doCheckout = async () => {
        if (!shipping.name || !shipping.phone || !shipping.address) {
            showAlert("Incomplete", "Please completely fill the shipping address.");
            return;
        }

        try {
            setProcessing(true);

            if (wifiConfig.ssid.trim().length > 0) {
                await saveWifiNetwork(wifiConfig); // Locally cache it
            }

            // Create order (state will be pending/unpaid if online)
            const created = await createOrder({
                items: cart.map(c => ({ productId: c.product.id, quantity: c.qty })),
                shipping,
                wifi: (wifiConfig.ssid.trim().length > 0) ? wifiConfig : undefined,
                paymentMethod: paymentMethod
            });

            // Trigger payment flow immediately for UPI/Razorpay during checkout
            if (paymentMethod === 'upi') {
                try {
                    const intent = await initiatePayment(created.id);
                    if (intent.mode === 'demo') {
                        // Confirm demo mode payment in sandbox/Expo Go
                        await new Promise<void>((resolve, reject) => {
                            showAlert(
                                'Demo Mode Payment',
                                `Confirm online payment of ₹${intent.amount.toLocaleString('en-IN')} via Demo UPI.`,
                                [
                                    {
                                        text: 'Cancel Payment',
                                        style: 'cancel',
                                        onPress: () => reject(new Error('PAYMENT_CANCELLED'))
                                    },
                                    {
                                        text: 'Mock Pay (Success)',
                                        style: 'default',
                                        onPress: async () => {
                                            try {
                                                await demoPay(created.id);
                                                resolve();
                                            } catch (e: any) {
                                                reject(new Error(e.message || 'Mock payment failed.'));
                                            }
                                        }
                                    }
                                ],
                                'confirm'
                            );
                        });
                    } else {
                        const isRazorpayAvailable = !!RazorpayCheckout && typeof RazorpayCheckout.open === 'function';

                        if (!isRazorpayAvailable) {
                            await new Promise<void>((resolve, reject) => {
                                showAlert(
                                    'Razorpay (Expo Go)',
                                    'Native Razorpay is not supported in the Expo Go sandbox. Would you like to use Demo Mode to mock this payment?',
                                    [
                                        {
                                            text: 'Cancel Payment',
                                            style: 'cancel',
                                            onPress: () => reject(new Error('PAYMENT_CANCELLED'))
                                        },
                                        {
                                            text: 'Mock Pay (Success)',
                                            style: 'default',
                                            onPress: async () => {
                                                try {
                                                    await demoPay(created.id);
                                                    resolve();
                                                } catch (e: any) {
                                                    reject(new Error(e.message || 'Mock payment failed.'));
                                                }
                                            }
                                        }
                                    ],
                                    'confirm'
                                );
                            });
                        } else {
                            const options = {
                                description: `Order #${created.id}`,
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

                            const response = await RazorpayCheckout.open(options);

                            await verifyPayment(created.id, {
                                razorpayOrderId: response.razorpay_order_id,
                                razorpayPaymentId: response.razorpay_payment_id,
                                razorpaySignature: response.razorpay_signature,
                            });
                        }
                    }
                } catch (payError: any) {
                    console.warn("Payment failed/cancelled, auto-cancelling order ID:", created.id, payError);
                    try {
                        await cancelOrder(created.id);
                    } catch (cancelErr) {
                        console.error("Failed to auto-cancel order:", cancelErr);
                    }
                    const isCancelled = payError.message === 'PAYMENT_CANCELLED' || payError.description === 'Payment cancelled by user';
                    const errorMsg = isCancelled ? 'Payment was cancelled. Order has been cancelled.' : `Payment failed: ${payError.message}`;

                    setCart([]);
                    setCartVisible(false);
                    setOrdersVisible(true);
                    showAlert("Payment Failed", errorMsg);
                    return;
                }
            }

            // Success feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCart([]);
            setCartVisible(false);
            setSuccessDisplay(true);
        } catch (e: any) {
            console.error(e);
            showAlert('Checkout Failed', e.message || "Order fail ho gaya — dobara try karo");
        } finally {
            setProcessing(false);
        }
    };

    const cartCount = cart.reduce((acc, curr) => acc + curr.qty, 0);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.primary }]}>
                        <Package color="#ffffff" size={24} />
                    </View>
                    <Text style={[styles.pageTitle, { color: theme.text }]}>Store</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => setOrdersVisible(true)} style={[styles.cartBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Truck color={theme.text} size={20} />
                    </TouchableOpacity>

                    {cartCount > 0 && (
                        <TouchableOpacity onPress={() => setCartVisible(true)} style={[styles.cartBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <ShoppingCart color={theme.text} size={20} />
                            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                                <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>{cartCount}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : products.length > 0 ? (
                    <View style={styles.grid}>
                        {products.map((prod) => (
                            <TouchableOpacity key={prod.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setSelectedProduct(prod)}>
                                {prod.imageUrl ? (
                                    <Image source={{ uri: prod.imageUrl }} style={styles.img} resizeMode="contain" />
                                ) : (
                                    <View style={[styles.img, { backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                                        <Package color={theme.textSecondary} size={32} />
                                    </View>
                                )}
                                <View style={{ padding: 16 }}>
                                    <Text style={[styles.prodName, { color: theme.text }]} numberOfLines={1}>{prod.name}</Text>
                                    <Text style={[styles.prodModel, { color: theme.textSecondary }]}>{prod.modelCode}</Text>
                                    
                                    {/* Ratings & Stock */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Star color="#f59e0b" size={14} fill="#f59e0b" />
                                            <Text style={{ color: theme.textSecondary, fontSize: 12, marginLeft: 4 }}>{Number(prod.rating || 0).toFixed(1)} ({prod.totalReviews || 0})</Text>
                                        </View>
                                        <Text style={{ color: (prod.stockCount || 0) > 0 ? '#10b981' : '#ef4444', fontSize: 10, fontWeight: 'bold' }}>
                                            {(prod.stockCount || 0) > 0 ? `${prod.stockCount} in stock` : 'OUT OF STOCK'}
                                        </Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                                        <Text style={[styles.priceTag, { color: theme.primary }]}>₹{parseFloat(prod.price).toLocaleString('en-IN')}</Text>
                                        
                                        {/* Blinkit Style Add Button */}
                                        {(() => {
                                            const inCart = cart.find(c => c.product.id === prod.id);
                                            if (inCart) {
                                                return (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, borderRadius: 8, overflow: 'hidden' }}>
                                                        <TouchableOpacity onPress={() => decreaseQty(prod)} style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.1)' }}>
                                                            <Minus color="#000" size={14} />
                                                        </TouchableOpacity>
                                                        <Text style={{ color: '#000', fontWeight: 'bold', paddingHorizontal: 12 }}>{inCart.qty}</Text>
                                                        <TouchableOpacity onPress={(e) => addToCart(prod, e)} style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.1)' }}>
                                                            <Plus color="#000" size={14} />
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            }
                                            return (
                                                <TouchableOpacity onPress={(e) => addToCart(prod, e)} disabled={(prod.stockCount || 0) <= 0} style={[styles.addBtn, { backgroundColor: (prod.stockCount || 0) > 0 ? theme.border : theme.background }]}>
                                                    <Text style={{ color: (prod.stockCount || 0) > 0 ? theme.text : theme.textSecondary, fontWeight: 'bold', fontSize: 12 }}>
                                                        {(prod.stockCount || 0) > 0 ? 'ADD' : 'SOLD OUT'}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })()}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={styles.centerBox}>
                        <Package color={theme.textSecondary} size={48} />
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hardware available yet.</Text>
                    </View>
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            
            {cartCount > 0 && (
                <View style={{ position: 'absolute', bottom: 30, left: 24, right: 24, zIndex: 10 }}>
                    <TouchableOpacity
                        onPress={() => setCartVisible(true)}
                        style={{ backgroundColor: theme.primary, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <ShoppingCart color="#000" size={24} style={{ marginRight: 12 }} />
                            <View>
                                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>{cartCount} ITEM{cartCount > 1 ? 'S' : ''}</Text>
                                <Text style={{ color: 'rgba(0,0,0,0.7)', fontSize: 12 }}>View Cart</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 18, marginRight: 8 }}>₹{getTotal().toLocaleString('en-IN')}</Text>
                            <View style={{ backgroundColor: '#000', padding: 8, borderRadius: 12 }}>
                                <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 12 }}>CHECKOUT</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            <Modal visible={cartVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCartVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.modalBg, { backgroundColor: theme.background }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Your Cart</Text>
                        <TouchableOpacity onPress={() => setCartVisible(false)} style={{ padding: 8 }}>
                            <X color={theme.text} size={24} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
                        {cart.map((c) => (
                            <View key={c.product.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.border }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>{c.product.name}</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Qty: {c.qty}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                                    <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 16 }}>₹{(parseFloat(c.product.price) * c.qty).toLocaleString('en-IN')}</Text>
                                    <TouchableOpacity onPress={() => removeFromCart(c.product.id)}>
                                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>REMOVE</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        <View style={{ marginVertical: 24, padding: 16, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
                            <Text style={{ color: theme.textSecondary, fontWeight: 'bold', marginBottom: 12, fontSize: 12 }}>SHIPPING DETAILS</Text>

                            <TextInput
                                placeholder="Full Name" placeholderTextColor={theme.textSecondary}
                                value={shipping.name} onChangeText={t => setShipping(p => ({ ...p, name: t }))}
                                style={[styles.formInput, { borderColor: theme.border, color: theme.text }]}
                            />
                            <TextInput
                                placeholder="Phone Number" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad"
                                value={shipping.phone} onChangeText={t => setShipping(p => ({ ...p, phone: t }))}
                                style={[styles.formInput, { borderColor: theme.border, color: theme.text }]}
                            />
                            <TextInput
                                placeholder="Complete Delivery Address" placeholderTextColor={theme.textSecondary}
                                value={shipping.address} onChangeText={t => setShipping(p => ({ ...p, address: t }))}
                                multiline style={[styles.formInput, { borderColor: theme.border, color: theme.text, height: 80, textAlignVertical: 'top' }]}
                            />
                        </View>

                        <View style={{ marginVertical: 0, marginBottom: 24, padding: 16, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 12 }}>PRE-CONFIGURE WIFI (OPTIONAL)</Text>
                                <Wifi color={theme.primary} size={16} />
                            </View>
                            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 16 }}>
                                Enter your home network details below. Your SwitchNest hardware will arrive pre-configured to auto-connect to your router the moment you power it on!
                            </Text>

                            {savedWifis.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                    {savedWifis.map((w, idx) => (
                                        <TouchableOpacity key={idx}
                                            onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                setWifiConfig({ ssid: w.ssid, password: w.password });
                                            }}
                                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '20', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: theme.primary }}>
                                            <Wifi color={theme.primary} size={12} style={{ marginRight: 6 }} />
                                            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: 'bold' }}>{w.ssid}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}

                            {/* Connected WiFi Autofill */}
                            <View style={{ marginBottom: 16 }}>
                                <TouchableOpacity
                                    onPress={handleAutofillConnectedWifi}
                                    disabled={fetchingWifi}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: theme.border,
                                        paddingVertical: 10,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: theme.border
                                    }}
                                >
                                    {fetchingWifi ? (
                                        <>
                                            <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 8 }} />
                                            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>Fetching connected network details...</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Wifi color={theme.text} size={14} style={{ marginRight: 8 }} />
                                            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>Use Currently Connected WiFi</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                placeholder="WiFi SSID (Network Name)" placeholderTextColor={theme.textSecondary}
                                autoCapitalize="none" autoCorrect={false}
                                value={wifiConfig.ssid} onChangeText={t => setWifiConfig(p => ({ ...p, ssid: t }))}
                                style={[styles.formInput, { borderColor: theme.border, color: theme.text }]}
                            />
                            <TextInput
                                placeholder="WiFi Password" placeholderTextColor={theme.textSecondary} secureTextEntry
                                autoCapitalize="none" autoCorrect={false}
                                value={wifiConfig.password} onChangeText={t => setWifiConfig(p => ({ ...p, password: t }))}
                                style={[styles.formInput, { borderColor: theme.border, color: theme.text, marginBottom: 0 }]}
                            />
                        </View>

                        <View style={{ marginVertical: 0, marginBottom: 24, padding: 16, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
                            <Text style={{ color: theme.textSecondary, fontWeight: 'bold', marginBottom: 16, fontSize: 12 }}>PAYMENT METHOD</Text>
                            <View style={{ gap: 12 }}>
                                <TouchableOpacity
                                    onPress={() => setPaymentMethod('cod')}
                                    style={[styles.payMethodCard, paymentMethod === 'cod' && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]}
                                >
                                    <View style={[styles.radioDot, paymentMethod === 'cod' && { backgroundColor: theme.primary, borderColor: theme.primary }]} />
                                    <View>
                                        <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>💵 Cash on Delivery</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>Pay upon doorstep delivery</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setPaymentMethod('upi')}
                                    style={[styles.payMethodCard, paymentMethod === 'upi' && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]}
                                >
                                    <View style={[styles.radioDot, paymentMethod === 'upi' && { backgroundColor: theme.primary, borderColor: theme.primary }]} />
                                    <View>
                                        <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>📱 UPI / Netbanking</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>Pay securely online via Razorpay</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={[styles.checkoutFooter, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Total:</Text>
                                <Text style={{ color: theme.primary, fontSize: 24, fontWeight: 'bold' }}>₹{getTotal().toLocaleString('en-IN')}</Text>
                            </View>
                            <TouchableOpacity onPress={doCheckout} disabled={processing || cart.length === 0} style={[styles.checkoutBtn, { backgroundColor: theme.primary }]}>
                                {processing ? <ActivityIndicator color="#000" /> : (
                                    <>
                                        <Text style={{ color: '#000', fontSize: 16, fontWeight: 'bold' }}>Secure Checkout</Text>
                                        <CreditCard color="#000" size={20} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={{ height: 60 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            {/* Success Overlay */}
            {successDisplay && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 100 }]}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                        <Check color="#000" size={40} />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>{paymentMethod === 'upi' ? 'Order Placed & Paid!' : 'Order Placed!'}</Text>
                    <Text style={{ color: '#aaa', fontSize: 16, textAlign: 'center', paddingHorizontal: 40, marginBottom: 32 }}>Check the Orders tab to track status.</Text>
                    <TouchableOpacity onPress={() => {
                        setSuccessDisplay(false);
                        setOrdersVisible(true);
                    }} style={{ paddingVertical: 14, paddingHorizontal: 32, borderRadius: 24, backgroundColor: '#333' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go to Orders</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Product Detail Modal */}
            <Modal visible={!!selectedProduct} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedProduct(null)}>
                <View style={[styles.modalBg, { backgroundColor: theme.background }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Product Details</Text>
                        <TouchableOpacity onPress={() => setSelectedProduct(null)} style={{ padding: 8 }}>
                            <X color={theme.text} size={24} />
                        </TouchableOpacity>
                    </View>
                    {selectedProduct && (
                        <ScrollView style={{ flex: 1 }}>
                            <Image source={{ uri: selectedProduct.imageUrl || 'https://via.placeholder.com/400' }} style={{ width: '100%', height: 250 }} resizeMode="contain" />
                            <View style={{ padding: 24 }}>
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>{selectedProduct.name}</Text>
                                <Text style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 16 }}>{selectedProduct.modelCode}</Text>
                                <Text style={{ fontSize: 28, fontWeight: 'bold', color: theme.primary, marginBottom: 24 }}>₹{parseFloat(selectedProduct.price).toLocaleString('en-IN')}</Text>
                                
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 8 }}>Description</Text>
                                <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 22, marginBottom: 24 }}>
                                    {selectedProduct.description || "Official SwitchNest Smart Hardware."}
                                </Text>

                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16 }}>Reviews & Ratings</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                                    <Star color="#f59e0b" size={32} fill="#f59e0b" />
                                    <View style={{ marginLeft: 12 }}>
                                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>{Number(selectedProduct.rating || 0).toFixed(1)} <Text style={{ fontSize: 14, color: theme.textSecondary, fontWeight: 'normal' }}>out of 5</Text></Text>
                                        <Text style={{ color: theme.textSecondary }}>Based on {selectedProduct.totalReviews || 0} reviews</Text>
                                    </View>
                                </View>
                                
                                {/* Placeholder for actual reviews fetched from API */}
                                <View style={{ padding: 16, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
                                    <MessageCircle color={theme.textSecondary} size={32} style={{ marginBottom: 8 }} />
                                    <Text style={{ color: theme.textSecondary }}>Reviews are loaded dynamically.</Text>
                                </View>
                                <View style={{ height: 100 }} />
                            </View>
                        </ScrollView>
                    )}
                </View>
            </Modal>
            
            <OrdersScreen visible={ordersVisible} onClose={() => setOrdersVisible(false)} />
            {AlertComponent}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
    headerIconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    pageTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
    scrollArea: { flex: 1 },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
    emptyText: { marginTop: 16, fontSize: 15 },
    grid: { paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: { width: '48%', borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
    img: { width: '100%', height: 120 },
    prodName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    prodModel: { fontSize: 12 },
    priceTag: { fontSize: 16, fontWeight: '900' },
    addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    cartBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    badge: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    modalBg: { flex: 1 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16 },
    modalTitle: { fontSize: 24, fontWeight: '800' },
    formInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 16 },
    payMethodCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#444', borderRadius: 12, padding: 16 },
    radioDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#666', marginRight: 16 },
    checkoutFooter: { padding: 24, borderRadius: 16, borderWidth: 1, marginTop: 8 },
    checkoutBtn: { paddingVertical: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', gap: 12, alignItems: 'center' }
});
