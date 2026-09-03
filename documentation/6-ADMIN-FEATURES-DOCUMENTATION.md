# 🛡️ SwitchNest — Admin Features Documentation

> **Admin Login:** `admin@robosphere.local` (or configured username)
> **Admin Panel:** `/admin` on the web app
> **Access:** Only `system_admin` role users can access these features

---

## 🗓️ Daily Admin Routine (5-Minute Check)

| # | Task | Location | What to look for |
|---|---|---|---|
| 1 | New orders? | Shop → Orders | `pending` orders — verify payment |
| 2 | Support messages? | Support tab | Unread count in navbar bell 🔔 |
| 3 | Boards offline? | Overview red banner | "📡 N boards offline — 2+ min" |
| 4 | New signups? | Overview stats | Users/homes count + 7-day chart |
| 5 | Server health? | Logs tab | Health Checker 5/5 ok · No leak |
| 6 | Any errors? | Logs tab | CRASH/ERROR lines in red |

---

## 🧭 Admin Panel Tabs

### 1. 📊 Overview (Dashboard)

**Stats Cards (12 total):**
| Card | What it shows |
|---|---|
| Total Users | All registered user accounts |
| Revenue (₹) | Total + this month from paid orders |
| Orders | Total, pending, today, this month |
| Homes | Total homes created |
| Devices | Total virtual devices |
| ESP Boards | Online / offline board count |
| API Requests 24h | Real-time API call tracker |
| Support Messages | Unread/total messages |
| Pending Commands | Commands in queue (should be ~0) |
| API Keys | Total active device keys |
| Audit Events | Total audit log entries |
| ESP Logs | Heartbeat events in last 24h |

**Chart:** Last 7 days — signups / orders / revenue trend

**🚀 Last Code Update card:**
- Shows: commit hash, timestamp, CI badge
- Status: `synced` / `pending` / `lagging` / `local dev mode`

**🔍 Global Search:** Find user / home / device / ESP / order / serial instantly

---

### 2. 💬 Support

- All contact form messages + user support threads
- Reply inbox — user gets real-time + email response
- Actions: Reply, Mark Resolved
- Each user has a **💬 Message** button in Users tab for direct outreach

---

### 3. 👥 Users

| Column | Description |
|---|---|
| Name / Email | User info |
| Role | `system_admin` or `user` |
| Status | Active or Suspended |
| Homes | How many homes they're in |
| Joined | Registration date |

**Actions per user:**
- 👑 **Make Admin** — promote to system_admin
- 📉 **Demote** — remove admin privilege
- 🚫 **Suspend** — block login (keeps data)
- ✅ **Activate** — reinstate a suspended user
- 🗑️ **Delete** — permanently remove user + all their data
- 💬 **Message** — open support conversation

---

### 4. 🏠 Homes

All homes on the platform:
- Home name, Owner name, member count, device count
- Creation date, status (active/suspended)

**Actions:**
- Toggle status (Suspend/Activate)
- Delete home (+ all devices/members)

---

### 5. 💡 Devices

All virtual devices across all homes:
- Device name, type, home, online/offline, last seen

**Actions:**
- Toggle ON/OFF (admin override)
- **Clear Pending Commands** — unstick a stuck device
- **Push OTA** (single device board, if ESP linked)
- Delete device

---

### 6. 📡 OTA / ESP Boards

Fleet management for all physical ESP32 boards.

| Column | Description |
|---|---|
| Name / Serial | Board identity |
| Model | 4CH, 2CH, etc. |
| MAC/IP | Network address |
| Firmware | Current firmware version |
| Online | ✅ / ❌ (2-min heartbeat threshold) |
| Last seen | Timestamp of last heartbeat |

**Actions per board:**
- 🔍 **Probe** — HTTP ping the board's web server
- 🔄 **Issue Key** — generate a new API key for the board
- 📤 **OTA Push** — send firmware update to this board
- History — view heartbeat/IP log

**Bulk OTA:** "Push OTA to All Boards" — updates the entire fleet at once

**Rotate Console Password:**
- `PATCH /api/admin/esp/:mac/rotate-console-password`
- Pushes new password via MQTT `rotate_console_pass` command

---

### 7. 🛒 Shop / Orders

#### Orders List
| Column | Description |
|---|---|
| Order # | Unique order identifier |
| Buyer | Customer name + contact |
| Amount | Total (₹) |
| Payment | pending/paid + method (COD/UPI/Razorpay) |
| Status | pending/processing/shipped/delivered/cancelled |

**Per-order actions:**
- **Status Change** → Mark Paid / Process / Ship / Deliver / Cancel
- **🖨️ Bill** — Printable invoice (A4, serial codes included)
- **Serials Generate** — Create serial codes for this order
- **Provision** — Get data for Flasher GUI (opens in Flasher)
- **Mark Paid** → customer notification instantly

#### Products Catalog
- Add / Edit / Delete products
- Fields: name, description, model (4CH/2CH/etc), relay count, price (₹), image URL, stock

#### Serials
- Generate available serials (pool for orders)
- **Mark Tested** — after factory provisioning
- View: order linked, buyer, board tested status
- **🖨️ Sticker Print** — QR code sticker with hotspot name, password, activation URL

---

### 8. 🔑 API Keys

All device API keys on the platform:
- Label, User, Home, Created at, Last used

**Actions:**
- Delete (revokes device access immediately)
- Create (admin can create for any user)

---

### 9. 📋 Audit Log

Every significant admin action is logged:

| What's tracked |
|---|
| Login / logout |
| User create/suspend/delete |
| Home create/suspend/delete |
| Device toggle (who toggled, when) |
| Order status changes |
| Serial tested |
| OTA push |
| API key create/delete |
| Settings changes |
| Admin message sent |
| Password change |

Each entry: actor, action, target, timestamp, metadata (IP, old/new value, etc)

---

### 10. 📄 Logs

#### 🔬 Startup Diagnostics Panel
- PID, uptime, RSS/heap memory
- **Memory trend chart** (24h, 1h/6h ranges, drag-zoom) — shows RSS/heap over time
- **Health Checker**: 5/5 pass status (API → DB → socket → scheduler → firmware)
- Exit/crash history (should be 0)
- Boot history log

#### 🪵 System Logs
- Last 300 lines of `app.log`
- Color-highlighted: CRASH/ERROR = red, WARN = yellow
- Copy / Download buttons

#### 🚀 Deploy Info
- Last commit, timestamp, CI badge, sync status

---

### 11. ⚙️ Settings

#### Site Config
- Brand name, contact email, support phone
- Displayed on landing page + emails

#### 📧 Email (SMTP)
| Field | Example |
|---|---|
| Host | smtp.gmail.com |
| Port | 587 (TLS) |
| User | your@gmail.com |
| Password | App password |
| From name | SwitchNest |

**Test Email button** verifies delivery before saving.

#### 🤖 AI Assistant
| Field | Options |
|---|---|
| Provider | Off / OpenAI / Gemini / Ollama |
| Model | e.g., `gpt-4o`, `gemini-pro` |
| API Key | Encrypted in DB |
| Base URL | For Ollama / custom endpoints |

**Test AI button** sends a test prompt and shows response.

---

### 12. 📚 Flasher Guide

Step-by-step guide for factory operators:
- Mode values (Localhost vs Live site)
- Credentials to enter
- 7-step factory flow diagram
- Hotspot naming rules (`username_OrderLast6_N`)
- Link to sticker print page

---

## 🏭 Complete Order → Delivery Flow

```
Customer places order (Web/Mobile/COD)
        ↓
Admin: Mark Paid → Customer notification: "✅ Payment verified"
        ↓
Factory: Fetch Order in Flasher → Flash + Provision + Test
        ↓
Factory: Mark Tested → Customer notification: "✅ Factory test pass"
        ↓
Admin: Print Bill + Print Sticker (QR)
        ↓
Package & Ship → Mark Shipped → Customer notification: "🚚 Order shipped, serial keys..."
        ↓
Customer receives → Mark Delivered → Customer notification: "📦 Delivered"
        ↓
Customer scans QR / enters serial → device activates in their home
```

---

## 📡 Monitoring & Alerts

### Board Offline Alert
- Admin sees: red banner on Overview "📡 N boards offline"
- Customer gets: in-app + email notification "📡 Board offline: [serial]"
- When reconnects: "✅ Board reconnected"

### Email Notifications (All to Customer)
| Trigger | Message |
|---|---|
| Payment verified | ✅ Payment verified — order taiyaar ho raha hai |
| Factory tested | ✅ Factory test pass — pack hone chala |
| Order shipped | 🚚 Order shipped — serial keys: ... |
| Order delivered | 📦 Order delivered |
| Board offline | 📡 Your board [serial] offline |
| Board online | ✅ Board reconnected |
| Warranty submitted | Warranty under review |
| Warranty resolved | Warranty status update |

---

## 🚨 Troubleshooting Guide

| Problem | Action |
|---|---|
| Board offline | OTA/ESP tab → Probe → Check WiFi/AP |
| Stuck pending command | Devices tab → Clear Commands |
| Email not sending | Settings → Test Email (check SMTP) |
| Board web UI not opening | PC must be on same LAN as board (192.168.x.x) |
| Deploy lagging | GitHub → Webhooks → Redeliver |
| User stuck can't login | Users tab → check status (not suspended) |
| Duplicate API processes | Run `fix-api-instances.bat` |
| Production 503 | Check Logs tab → diagnostics → iisnode crash |

---

*Last updated: 2026-08-25 | SwitchNest Admin v2 | Platform: `onlineswitch.bhartitechnical.com`*
