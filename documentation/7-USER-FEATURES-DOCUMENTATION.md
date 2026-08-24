# 👤 SwitchNest — User Features Documentation

> **Target:** End users (customers) of the SwitchNest platform
> **Platforms:** Web (ReactJS SPA) + Mobile (React Native / Expo)
> **Live site:** `https://onlineswitch.bhartitechnical.com`

---

## 🚀 Getting Started

### Sign Up
1. Go to the SwitchNest website or open the mobile app
2. Click **Sign Up**
3. Enter: username, email, password
4. Your account is created automatically + a **Home** is created for you (you're the Owner)
5. You receive a welcome notification

### Log In
- Enter **username or email** + password
- Session stays active via JWT refresh tokens (auto-renew)

### Forgot Password
- Click "Forgot Password" on login page
- Enter email → receive reset link
- Click link → enter new password

---

## 🏠 Dashboard — Device Control

The dashboard is the main screen. You see all your devices in your current home.

### Viewing Devices
- Each device shows as a **card** with:
  - Device name (custom name you gave it)
  - Type icon (💡 bulb, 🌀 fan, ❄️ AC, 📺 TV, 🔌 plug)
  - **ONLINE / OFFLINE** status badge (green dot = board connected)
  - Toggle button (ON/OFF)

### Toggling a Device
- Tap/click the **toggle button** on a device card
- The device switches state immediately (< 1 second via MQTT)
- Actually turns the physical relay on your wall on or off!

### Room Filter
- Devices can be organized into **rooms** (Living Room, Bedroom, Kitchen, etc.)
- Filter the dashboard by room using the room tabs

### Bulk Control (by Room)
- Select a room → click **All ON** or **All OFF** to control all devices at once

---

## 💡 Managing Devices

### Add a Device
1. Click **+ Add Device**
2. Enter: device name, type (bulb/fan/ac/tv/plug/custom)
3. Optionally assign to a room
4. Click Save — device appears on dashboard

> **Note:** This creates a *virtual device entry*. The physical relay binding happens during the factory provisioning of your ESP32 board.

### Rename / Edit Device
- Click the edit icon (✏️) on a device card
- Change name, type, or room assignment
- Save

### Delete Device
- Click delete icon → confirm
- Removes the virtual entry (physical board unaffected)

### Device Logs
- Click a device → see activity log:
  - Who toggled it (which family member)
  - When it was toggled
  - Schedule-triggered toggles

---

## ⏰ Schedules (Timers)

Automate your devices — set them to turn on/off at specific times.

### Create a Schedule
1. Open **Schedules** section (from dashboard or device detail)
2. Click **+ Add Schedule**
3. Fill in:
   - **Device**: Which device to control
   - **Action**: ON or OFF
   - **Name**: (optional label, e.g., "Morning Light On")
   - **Type**: `once`, `daily`, `weekly`, or `custom cron`
4. Set time and repeat pattern
5. Click Save — runs automatically!

### Schedule Types
| Type | Example |
|---|---|
| Once | Turn on at 7pm tonight only |
| Daily | Turn off every night at 11pm |
| Weekly | Turn on every Monday at 6am |
| Custom cron | `0 7 * * 1-5` (weekdays 7am) |

### Enable / Disable
- Toggle the switch next to each schedule to pause/resume it

### Next Run
- Each schedule shows when it will next fire (calculated automatically)

---

## 🏡 Homes & Rooms

### Multiple Homes
- You can belong to **multiple homes** (e.g., your home + your parents' home)
- Switch between homes using the **Home Switcher** (top of dashboard)

### Create a Home
- Go to Homes > **Create Home** > enter name

### Create a Room
- Go to Rooms > **+ Add Room** > name it (e.g., "Living Room")
- Assign devices to rooms from the device edit screen

---

## 👨‍👩‍👧‍👦 Family Members

### Invite Someone
1. Go to **Family** tab
2. Click **Invite Member**
3. An **invite code** is generated (e.g., `ROB7X2`)
4. Share the code with your family member (WhatsApp, SMS, etc.)
5. They join via the **"Join Home"** option and enter the code

### Member Roles
| Role | Can do |
|---|---|
| **Owner** | Everything — manage members, transfer ownership, delete home |
| **Admin** | Add/remove devices, manage members (not delete home) |
| **Member** | Control devices, create schedules, add devices |
| **Viewer** | See status only — cannot toggle anything |

### Change a Member's Role
- Family tab → tap/click member → change role → save
- Only Owner and Admin can change roles

### Remove a Member
- Family tab → tap/click member → Remove → confirm
- Their access is revoked instantly

---

## 🔔 Notifications

You receive in-app notifications (bell icon 🔔) for:

| Event | Notification |
|---|---|
| Payment verified | ✅ Payment verified — order taiyaar ho raha hai |
| Board factory tested | ✅ Factory test pass — pack hone chala |
| Order shipped | 🚚 Order shipped — serial keys: ... |
| Order delivered | 📦 Order delivered |
| Board offline | 📡 Your board [serial] went offline |
| Board reconnected | ✅ Board is back online |
| Family invite | Someone invited you to join [home] |
| Admin message | Message from SwitchNest support |

**Email notifications**: Also sent to your registered email (for orders/alerts) if SMTP is configured.

### Mark as Read
- Click notification → marks as read
- Or click **Mark All Read**

---

## 🛒 Shop — Buying SwitchNest Devices

### Browse Products
- Go to **Shop** tab (web or mobile)
- See available models: 2CH, 4CH, 6CH, 8CH boards

### Add to Cart
- Select product → choose quantity → **Add to Cart**

### Checkout
1. Review your cart
2. Enter delivery address + phone
3. Enter WiFi details (the board will come pre-configured with these!)
4. Choose payment:
   - **COD (Cash on Delivery)** — pay when product arrives
   - **UPI / Razorpay** — pay now online
5. Place order

### Payment (UPI/Razorpay)
- Redirects to Razorpay secure payment page
- Pay via UPI / Debit / Credit card
- On success → order confirmed automatically

### Order History
- **My Orders** tab shows all orders
- Expand an order to see:
  - Status timeline (placed → paid → shipped → delivered)
  - Payment details
  - Serial keys (after shipping)
  - Courier tracking placeholder (live integration coming soon)

---

## 📱 Claiming Your Device (After Delivery)

After receiving your SwitchNest board:

1. **Scan QR code** on the sticker OR visit the activation URL
2. Enter your **serial key** (printed on sticker)
3. Device is claimed to your home!
4. Power on the board → it connects to your WiFi automatically
5. Device appears on your dashboard → toggle it to test!

---

## 🤖 AI Assistant

The AI assistant helps you control your home with natural language.

### How to Use
- Go to **Assistant** tab (web)
- Type naturally:
  - "Turn off all fans"
  - "Turn on the living room light"
  - "Create a schedule to turn off the AC at 11pm daily"

### Confirmation
- AI always asks for confirmation before making changes
- Prevents accidental toggles

### Smart Suggestions
- After a few weeks of use, AI suggests automations:
  - "You turn on Living Room Light at 7pm daily — create a schedule?"
  - One-click to create the schedule

> 💡 AI works in **English and Hindi** (Hinglish supported!)

---

## 🔑 API Keys (For Developers / Advanced Users)

API keys let external scripts/apps control your devices programmatically.

### Create an API Key
1. Go to **API Keys** section (User profile area)
2. Click **Generate Key**
3. Give it a label (e.g., "Home automation script")
4. Copy the key — shown only once!

### Use the API
```bash
curl -H "x-api-key: YOUR_KEY" https://onlineswitch.bhartitechnical.com/api/read-all
```

### Revoke a Key
- Click **Delete** next to the key — access immediately revoked

---

## 📊 Usage Analytics

See how your home devices are being used:

- **Dashboard → 📊 Usage button**
- Select time range: 7 / 30 / 90 days
- See:
  - Switches/day bar chart
  - Per-device on-time (hours)
  - Per-member activity (who's using what)

---

## ⚡ Google Home & Alexa Integration

Control your SwitchNest devices with your voice!

### Setup (Google Home)
1. Go to Profile → **Integrations**
2. Click **Link Google Home**
3. Follow OAuth flow
4. Say: "Hey Google, turn on the living room light"

### Setup (Alexa)
1. Go to Profile → **Integrations**
2. Click **Link Alexa**
3. Follow Alexa skill activation
4. Say: "Alexa, turn on the fan"

---

## 🛡️ Account Security

### Change Password
- Profile → Change Password
- Enter current password + new password
- Suggestion: use a strong, unique password

### Session Management
- Each device/browser has its own session
- Logout from all devices: Profile → Logout All Sessions (coming soon)

### Privacy
- Your device usage data stays on our servers only
- API keys can be revoked at any time
- Delete account: removes all your data permanently (contact support)

---

## ❓ Getting Help

- **In-app support**: use the **Contact / Support** form
- **AI assistant**: for quick how-to questions
- Email: contact via the support form on the website
- **Admin can directly message you** in the support tab

---

*Last updated: 2026-08-25 | SwitchNest v2 | onlineswitch.bhartitechnical.com*
