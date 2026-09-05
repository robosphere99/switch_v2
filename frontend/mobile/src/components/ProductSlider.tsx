import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Image, Dimensions, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Product } from '../api/shop';
import { API_URL } from '../api/client';

const API_BASE = API_URL.replace(/\/api$/, '');
const SCREEN_WIDTH = Dimensions.get('window').width;

export function ProductSlider({ product }: { product: Product }) {
    const scrollRef = useRef<ScrollView>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const mediaList = product.media && product.media.length > 0
        ? product.media.map(m => m.url.startsWith('http') ? m.url : API_BASE + m.url)
        : product.imageUrl 
            ? [product.imageUrl.startsWith('http') ? product.imageUrl : API_BASE + product.imageUrl] 
            : ['https://via.placeholder.com/400'];

    useEffect(() => {
        if (mediaList.length <= 1) return;

        const timer = setInterval(() => {
            setActiveIndex(prev => {
                const nextIndex = (prev + 1) % mediaList.length;
                scrollRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
                return nextIndex;
            });
        }, 5000);

        return () => clearInterval(timer);
    }, [mediaList.length]);

    const goNext = () => {
        if (mediaList.length <= 1) return;
        const nextIndex = (activeIndex + 1) % mediaList.length;
        setActiveIndex(nextIndex);
        scrollRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
    };

    const goPrev = () => {
        if (mediaList.length <= 1) return;
        const prevIndex = activeIndex === 0 ? mediaList.length - 1 : activeIndex - 1;
        setActiveIndex(prevIndex);
        scrollRef.current?.scrollTo({ x: prevIndex * SCREEN_WIDTH, animated: true });
    };

    const handleMomentumScrollEnd = (event: any) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setActiveIndex(index);
    };

    return (
        <View style={{ width: SCREEN_WIDTH, height: 250 }}>
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                style={{ width: SCREEN_WIDTH, height: 250 }}
            >
                {mediaList.map((url, i) => (
                    <Image key={i} source={{ uri: url }} style={{ width: SCREEN_WIDTH, height: 250 }} resizeMode="contain" />
                ))}
            </ScrollView>

            {mediaList.length > 1 && (
                <>
                    <TouchableOpacity onPress={goPrev} style={[styles.navBtn, { left: 16 }]}>
                        <ChevronLeft color="#000" size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={goNext} style={[styles.navBtn, { right: 16 }]}>
                        <ChevronRight color="#000" size={24} />
                    </TouchableOpacity>
                    
                    <View style={styles.dotsContainer}>
                        {mediaList.map((_, i) => (
                            <View key={i} style={[styles.dot, activeIndex === i ? styles.activeDot : null]} />
                        ))}
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    navBtn: {
        position: 'absolute',
        top: '50%',
        marginTop: -20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    dotsContainer: {
        position: 'absolute',
        bottom: 12,
        flexDirection: 'row',
        alignSelf: 'center',
        gap: 8
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.2)'
    },
    activeDot: {
        backgroundColor: 'rgba(0,0,0,0.8)'
    }
});
