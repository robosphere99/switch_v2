# 🛡️ SwitchNest — Admin Guide (sab kuch manage kaise karein)

> Admin = system admin. Login: `ADMIN_USERNAME` / `ADMIN_PASSWORD` (`site/.env` me).
> Admin panel: login karke **`/admin`** (local: `http://localhost:5173/admin`).

---

## 📌 Daily Routine — 5 minute check

| Kaam | Kahan | Kya dekhein |
|---|---|---|
| 1. Koi naya order? | **Shop / Orders** tab | `pending` orders → payment verify karo (neeche flow) |
| 2. Naye support/contact messages? | **Support** tab | Unread count navbar me dikhta hai; reply karo |
| 3. Boards offline? | **Overview** pe red banner | "📡 N boards offline — 2+ min se sync nahi" → OTA/ESP tab me jaake dekho |
| 4. Naye signups? | **Overview** stats | Users/homes count + 7-day chart |
| 5. Server sehat? | **Logs** tab | "🚀 Last code update", "💓 Health Checker 5/5 ok", "🧠 No leak" |
| 6. Koi error? | **Logs** tab | CRASH/ERROR lines red me highlight hote hain |

---

## 🧭 Admin Panel — Har tab ka matlab

### 1. Overview (Dashboard)
- **12 stat cards**: Total Users, Revenue (₹), Orders, Homes, Devices, ESP Boards (online/offline), API Requests 24h, Support Messages, Pending Commands, API Keys, Audit Events, ESP Logs
- **🚀 Last code update** card: kaunsa commit live hai, deploy sync status (`synced`/`pending`/`lagging`/`local dev mode`)
- **📈 Last 7 days**: signups / orders / revenue trend chart
- **📡 Offline boards banner** (red) — turant fleet health
- **🕒 Recent activity**: audit events (kaun kya kiya)
- **🆘 Find anything**: global search — user / home / device / ESP / order / serial, kisi bhi cheez se kholo

### 2. Support
- Contact form messages + support conversations (users se chat)
- Reply karo → user ko realtime + email jata hai
- **💬 Message** button (Users tab me) — kisi bhi user se seedha chat kholo
- Status: open → resolved

### 3. Users
- List with role (system_admin/user), status (active/suspended), homes count
- Actions: **Make admin/Demote**, **Suspend/Activate**, **🗑️ Delete** (full data remove)
- **💬 Message** — support chat kholo

### 4. Homes
- Saare homes + owner + devices
- Actions: status toggle, delete

### 5. Devices
- Saare devices (platform-wide) — online/offline, last seen
- Actions: on/off control, **clear pending commands** (stuck command hatane ke liye), **push OTA** (single ya **all**), delete

### 6. OTA / ESP
- **ESP boards** fleet: name, serial, model, IP, firmware version, online/offline
- **🔍 Probe** button — board ka webserver reachable hai? (HTTP ping) → reachable ho to browser me khulta hai
- **🔄 Issue key** — board ke liye naya API key
- **OTA push** — naya firmware board(s) pe bhejo (firmware pehle upload karo)
- ESP history — heartbeat/IP logs

### 7. Shop / Orders
- Orders list: order number, buyer, amount, payment status, order status
- Har order pe:
  - **Status change** (pending → paid → shipped → delivered) — **Mark Paid** se user ko notification jata hai
  - **🖨️ Bill** — invoice print
  - **Serials generate** — order ke liye serial codes
  - **Provision** (flasher ke liye) — order ke items + serial + WiFi + API key
- **Products** (catalog): add/edit/delete — model, relay count, price
- **Serials**: generate (available pool), mark-tested, order se linked, sticker print

### 8. API Keys
- Saare device keys: kaunsa user, kaunsa home, label
- Create / delete (delete = us device ki access band)

### 9. Audit Log
- Har important action track: kaun, kya, kab (login, settings, ESP key, serial tested, device control, order status...)
- **Kuch galat ho to yahi se pata chalta hai** kisne kiya

### 10. Logs
- **🔬 Startup Diagnostics**: PID, uptime, RSS/heap, memory trend chart (leak detection), Health Checker (5/5), exit/crash history, boot history
- **🪵 System Logs**: last 300 lines, CRASH/ERROR highlight, Copy/Download buttons
- **🚀 Last code update** (deploy status bhi yahi)

### 11. Settings
- **Site**: brand name, contact info, theme (public site pe dikhta hai)
- **📧 Email (SMTP)**: host/port/user/pass — **Test Email** button se verify
- **🤖 AI Assistant**: provider (Off/OpenAI/Gemini/Ollama), model, API key (encrypted), **Test AI** button

### 12. Flasher Guide
- Flasher GUI ke liye poora guide — mode values, creds, 7-step flow, hotspot naming rule

---

## 🛒 Order Flow — Complete (payment → delivery)

```
1. Order aata hai (site pe COD/UPI)         → Orders tab me "pending"
2. Payment aya? → Mark Paid                  → user ko NOTIFICATION: "✅ Payment verified — order taiyaar ho raha hai"
3. Ab order flasher me fetch hoga (paid-gate) → Flasher → Fetch Order (order #)
4. Flash firmware + Provision + Test         → hotspot verify + relay self-test
5. Mark Tested                               → user ko NOTIFICATION: "✅ Factory test pass — pack hone chala"
6. Bill print + Sticker print (QR)           → pack karo
7. Ship karo: Mark Shipped                   → user ko NOTIFICATION: "🚚 Order shipped — serial keys..."
8. User ko product mila → Mark Delivered     → user ko NOTIFICATION: "📦 Order delivered"
9. User QR scan / serial claim karta hai     → device uske home me activate
```

**Ek kaam karna hai**: order me multiple devices → har device ka serial alag (sticker pe `_1/_2`), mark-tested har device ka.

---

## 🏭 Factory Flow — Flasher kaise use karein

1. **`Flasher-Latest.bat`** kholo (Desktop/Downloads — hamesha repo wala latest). **Purane `RoboSphere-Flasher*.exe` mat use karo** (15 Aug ke hain, features missing).
2. **Mode**: `Localhost` (testing) ya `Live site` (production)
3. **Login** (admin creds)
4. **Order fetch**: order number daalo → serial, model, WiFi, API key auto-fill
5. **COM port** select
6. **1 · Flash Firmware** → confirm dialog (model confirm) → flash
7. **2 · Provision + Test** → setwifi/setserver/serial/model + hotspot verify + relay self-test + **web server check** (naya!)
8. **3 · Mark Tested** → user ko notification
9. **Next Board** → agla device (multi-device order me)

---

## 📡 Monitoring — Kya dekhna chahiye

### Boards online/offline
- **Overview** red banner: jo boards 2+ min sync nahi karte
- **OTA/ESP** tab: har board ka last heartbeat, IP, firmware
- **Heartbeat** har 10s aata hai — IP change pe wahi update

### Server health (Logs tab)
- **Health Checker**: har 30s full-chain check (5/5 ok hona chahiye)
- **Memory trend**: line consistently upar = leak ⚠️ (RSS +20% in 4h)
- **Exits/restarts/crashes**: 0 hona chahiye (clean ✅)

### Deploy status
- **🚀 Last code update**: `synced` = live site latest code pe
- **lagging** = push hua par live nahi pahuncha → webhook check (GitHub → Settings → Webhooks → Recent Deliveries → Redeliver)
- **local dev mode** (localhost pe) = normal, kuch nahi karna

### Notifications
- User ko **notification + email** jata hai: payment verified, factory tested, shipped, delivered, offline alert, warranty status
- Email tabhi jata hai jab **SMTP settings** configure ho (Settings → Email)

---

## 🔧 Setup Checklist (ek baar karna hai)

- [ ] **SMTP** configure karo (Settings → Email) → Test Email
- [ ] **AI Assistant** on karo (Settings → AI) — provider + key → Test AI
- [ ] **Products** catalog bharo (Shop → Products)
- [ ] **Firmware** upload karo (Logs/OTA section → upload .bin → activate)
- [ ] **Flasher-Latest.bat** Desktop pe hai — factory laptop pe bhi copy karo
- [ ] Admin creds strong rakho (`.env` me `ADMIN_PASSWORD`)

---

## 🚨 Common Problems

| Problem | Kya karo |
|---|---|
| Board offline | OTA/ESP tab → probe karo; board ka WiFi/AP check; serial monitor se boot logs |
| Stuck pending command | Devices tab → **clear commands** |
| Email nahi jaa raha | Settings → Test Email (SMTP galat hai to error bata dega) |
| Board webserver nahi khul raha | PC ko board ke hotspot (192.168.4.1) ya same LAN pe hona chahiye |
| Deploy lagging | Webhook redeliver (upar dekho) |
| User ki access band karni hai | API Keys tab → delete key |
| User suspend karna hai | Users tab → Suspend |

---

*Ye guide repo me `docs/ADMIN-GUIDE.md` — update hoti rahegi jaisi features badhte hain.*
