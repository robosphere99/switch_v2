# 📱 SwitchNest — Mobile App Documentation

> **Platform:** React Native (Expo)
> **Location:** `site/apps/mobile/`
> **Tech stack:** Expo + NativeWind (TailwindCSS for RN) + Zustand + Axios
> **Status:** Phase 8 — Feature Complete

---

## 🏗️ App Architecture

```
site/apps/mobile/
├── App.tsx                    — Root with navigation, auth guard, Socket.IO
├── src/
│   ├── api/                   — Axios API clients (auth, devices, homes, shop...)
│   │   ├── auth.ts           — Login, signup, token refresh
│   │   ├── devices.ts        — Device CRUD, toggle
│   │   ├── homes.ts          — Homes, members, invites
│   │   ├── shop.ts           — Orders, products, cart
│   │   ├── admin.ts          — Admin endpoints
│   │   └── notifications.ts  — Push notifications
│   ├── components/           — Reusable UI components
│   │   ├── DeviceCard.tsx    — Relay device on/off card
│   │   ├── HomeSelector.tsx  — Home picker dropdown
│   │   ├── MemberCard.tsx    — Member info card
│   │   └── ...
│   ├── stores/               — Zustand state stores
│   │   └── authStore.ts      — User, tokens, login/logout state
│   ├── hooks/                — Custom hooks
│   │   ├── useRealtime.ts    — Socket.IO real-time events
│   │   └── useNotifications.ts
│   ├── theme/                — NativeWind theme + colors
│   └── utils/                — Helpers
├── assets/                   — Icons, splash, app logo
└── app.config.js             — Expo app config (packaging, deep links)
```

---

## 📲 Screens & Navigation

### Auth Flow
| Screen | Description |
|---|---|
| Login | Email/username + password login |
| Signup | Register new account (creates a Home) |
| ForgotPassword | Request password reset email |

### Main App (Bottom Tab Navigator)
| Tab | Screens | Description |
|---|---|---|
| 🏠 Home | HomeScreen | Device cards for current home, room filter, real-time status |
| 👥 Family | MembersScreen | Family member list, invite, role management |
| 🛒 Shop | ShopScreen, ProductDetail, Cart, Checkout, OrderHistory | Buy SwitchNest devices |
| 👤 Profile | ProfileScreen | Edit profile, avatar, DOB, phone; change password |

### Additional Screens (Stack)
| Screen | Description |
|---|---|
| DeviceDetail | Device logs, schedule management |
| AddDevice | Add virtual device to home |
| CreateRoom | Create a new room |
| EditDevice | Rename device, change room/type |
| InviteCode | Join a home using invite code |
| OrderDetail | Full order info (status timeline, serial keys, tracking) |
| Checkout | Address, payment method (COD/UPI) |
| RazorpayWebView | Browser-based payment redirect |

---

## 🔐 Authentication

The app uses **JWT access tokens** stored in Zustand + **refresh token** via httpOnly cookie (API handles rotation automatically).

```typescript
// Login flow
const { login } = useAuthStore();
await login(email, password); // Sets access token in store

// All API calls automatically attach:
// Authorization: Bearer <access_token>
```

**Token refresh:** On 401 response, axios interceptor automatically calls `/api/auth/refresh` and retries the request.

---

## ⚡ Real-Time Updates (Socket.IO)

The mobile app connects to the Socket.IO server for live device status updates.

```typescript
// useRealtime hook subscribes to:
socket.on("device:updated", (data) => {
  // Update device state in UI instantly
});

socket.on("notification:new", (notif) => {
  // Show push notification / bell badge
});
```

---

## 🛒 E-Commerce Flow

```
Browse Products → Add to Cart → Checkout
    ↓
Payment Method:
  COD → Order placed (pending payment)
  UPI → Razorpay WebView → Payment verified
    ↓
Order History → View tracking → Serial Key claimed
```

### Razorpay Integration
- Opens a WebView with the Razorpay checkout URL
- On payment success: Razorpay calls webhook → backend marks order `paid` → user gets notification
- Cart is automatically cleared on successful payment

---

## 🔔 Push Notifications

Push notifications are handled via **Expo Push Notifications** + the backend.

Notification types the app receives:
| Trigger | Message |
|---|---|
| Payment verified | "✅ Payment verified — aapka order taiyaar ho raha hai" |
| Factory tested | "✅ Factory test pass — pack hone chala" |
| Order shipped | "🚚 Order shipped — serial keys …" |
| Order delivered | "📦 Order delivered" |
| Board offline | "📡 Board offline: [serial]" |
| Board online | "✅ Board reconnected" |
| Admin message | Direct message from admin support |

---

## 🏠 Device Management

### Device Card
Each device card shows:
- Device name (custom or fallback)
- Type icon (bulb 💡, fan 🌀, AC ❄️, TV 📺, plug 🔌)
- Online/Offline status badge
- Large toggle ON/OFF button
- Last seen timestamp

### Toggle Flow
```
User taps toggle
  → API call: POST /api/homes/:homeId/devices/:id/toggle
  → Backend writes to device_commands table
  → MQTT push to ESP32 (if connected)
  → ESP32 flips relay
  → Socket.IO event → UI updates
```

---

## 🏡 Family & Members

### Actions available in MembersScreen:
- View all family members + their roles
- Invite new member (generates invite code, share via WhatsApp/SMS)
- Remove a member
- Change member role (owner/admin/member/viewer)

### Role Hierarchy
```
Owner > Admin > Member > Viewer
```
- **Owner**: Full control, transfer ownership, delete home
- **Admin**: Manage devices + members
- **Member**: Control devices, create schedules
- **Viewer**: Read-only (can see status but not toggle)

---

## 👤 Profile

Users can edit:
- Display name
- Username
- Email
- Phone number
- Date of Birth
- Avatar image URL

Password change requires entering the current password.

---

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g @expo/cli`
- Android Studio (for Android emulator) or Expo Go app on physical device

### Start Development Server
```bash
cd site/apps/mobile
npm install
npx expo start -c      # -c clears cache
```

Then:
- Press `a` for Android emulator
- Scan QR code with **Expo Go** app on your phone

### Environment Variables
```env
# site/apps/mobile/.env
EXPO_PUBLIC_API_URL=http://192.168.1.x:4000  # Your local IP:4000
```

> ⚠️ Use your local LAN IP (not localhost) so physical devices can reach the API.

### Build APK for Testing
```bash
eas build --platform android --profile preview
```

### Wireless Expo Start
```bash
run-expo-wireless.bat  # Uses tunnel mode for remote testing
```

---

## 📦 Key Dependencies

| Package | Purpose |
|---|---|
| `expo` | Mobile app framework |
| `expo-router` | File-based navigation |
| `nativewind` | TailwindCSS for React Native |
| `zustand` | Global state management |
| `axios` | HTTP API client |
| `socket.io-client` | Real-time WebSocket |
| `expo-notifications` | Push notifications |
| `expo-camera` | QR code scanning (device claim) |
| `@react-navigation/native` | Navigation library |
| `react-native-razorpay` | (Replaced by WebView redirect) |

---

## 🐛 Known Issues / Limitations

1. **Razorpay native SDK** was replaced with WebView redirect due to Android build complexity
2. **NetInfo dependency** removed — WiFi detection now handled server-side
3. **Push notifications** require Expo Push Token registration at startup
4. **iOS build:** Not tested yet (requires Mac + Apple Developer account)
5. **Real-time on mobile background:** Socket disconnects when app is backgrounded — reconnects on foreground

---

## 🗺️ What's Coming Next

- iOS App Store build + submission
- Native local notifications for schedule completions
- Offline mode (cache last known device states)
- Biometric login (fingerprint/FaceID)
- Widget support for quick device control
- Deep link integration from QR codes on device stickers

---

*Last updated: 2026-08-25 | Expo SDK: Latest | Platform: Android (primary), iOS (planned)*
