import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "../lib/prisma";

// Global Expo SDK Client singleton
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN }); // accessToken is optional but provides higher limits

/**
 * Dispatch a guaranteed high-priority real-time push notification to a Specific User.
 * Bypasses polling delays by leveraging native Apple APNs and Firebase FCM pipelines.
 */
export async function sendPushToUser(userId: number, title: string, body: string, payload?: any, category: "device" | "system" = "system") {
    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: {
                userId,
                ...(category === "device" ? { pushDeviceToggles: true } : { pushSystemAlerts: true })
            },
            select: { token: true }
        });

        if (!subscriptions || subscriptions.length === 0) return false;

        const messages: ExpoPushMessage[] = [];
        for (const sub of subscriptions) {
            const pushToken = sub.token;
            if (!Expo.isExpoPushToken(pushToken)) {
                console.warn(`[Push Engine] Token ${pushToken} is invalid. Purging from registry.`);
                await prisma.$executeRawUnsafe(`DELETE FROM \`PushSubscription\` WHERE token = '${pushToken}'`).catch(() => { });
                continue;
            }

            messages.push({
                to: pushToken,
                sound: "default",      // Forces a hardware audio alert
                priority: "high",      // Bypass battery optimization throttling constraints
                title,
                body,
                data: payload || {},
            });
        }

        if (messages.length === 0) return false;

        const chunks = expo.chunkPushNotifications(messages);

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                console.log(`[Push Engine] Dispatched payload ${(ticketChunk[0] as any).id || 'batch'} to hardware bridging layer.`);
            } catch (ticketError) {
                console.error("[Push Engine] Segment Delivery Error:", ticketError);
            }
        }
        return true;
    } catch (e) {
        console.error("[Push Engine] Fatal notification construction error:", e);
        return false;
    }
}
