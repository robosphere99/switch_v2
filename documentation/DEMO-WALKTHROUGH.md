# SwitchNest — Full Demo Walkthrough (Video Script)

> Is script ke saath live site par ek-ek step karo aur screen record karo
> (Windows: **Win+G** Game Bar, ya OBS). Har section = video ka ek segment.
> Demo ke liye login/creds niche diye hain — sab real, live system pe chalte hain.

**Demo credentials**

> ⚠️ Testing convention (user ka rule): **sab non-admin accounts ka password `123456`** hai —
> admin (`Anil@20552`) ke alawa. Naye test accounts bhi hamesha `123456` se banao, taaki
> baar-baar password reset nahi karna pade.

| Role | Login | Password |
|---|---|---|
| Customer (demoflow) | `demoflow@example.com` | `123456` |
| Family member (sonu) | `sonu@example.com` | `123456` |
| Test (livetest) | `livetest@example.com` | `123456` |
| Admin | `admin` | `Anil@20552` |

**Live site:** `https://onlineswitch.bhartitechnical.com` (dev: `http://localhost:5173`)

---

## Part 1 — Customer Journey (0:00–4:00)

### 1.1 Account create
1. Landing page → **Sign Up / Create Your Home**
2. Fill: username, email, password, home name → **Sign Up**
3. Dashboard khul jata hai — "Welcome home! 👋"

### 1.2 AI assistant se suggestion
1. Bottom-right 🤖 **Chat widget** kholo
2. Chip pe click karo: `"4CH board chahiye"` → AI boards suggest karta hai (clickable)
3. Suggestion se seedha **Shop** khul jata hai

### 1.3 Order + payment
1. **4CH WiFi Relay Module (₹799)** → **Add to Cart** (2CH bhi add karo — demo me dono boards)
2. Cart → **Checkout** → shipping details (name, address, phone) + UPI select
3. **Place Order** → order number milta hai (e.g. `RSMSW6R8BYR8OX`), status **Pending**
4. **Pay Now** → UPI modal (`switchnest@okaxis`) → demo mode me **"Maine UPI se pay kar diya"**
5. Status **💳 Paid** ✅

---

## Part 2 — Factory: Flash + Serial + Ship (4:00–8:00)

> **Yeh segment manufacturing side ka hai** — `tools/flasher/flasher_gui.py`
> (RoboSphere Factory Flasher). Windows pe chalane ke liye:
> ```
> pip install requests pyserial esptool
> python flasher_gui.py
> ```

### 2.1 Flasher GUI — field by field
GUI me 3 sections hain. Har field ka matlab:

**1 · Server Connection**
| Field | Kya bharna hai | Kya hota hai |
|---|---|---|
| **Site URL** | `https://onlineswitch.bhartitechnical.com` | Admin API jahan login hoga |
| **Admin user** | `admin` | Admin login |
| **Password** | `Anil@20552` | Admin login |
| **ESP Server URL** | `http://<machine-LAN-IP>:4000` | Board ko yahi URL yaad rahega — isi pe heartbeat bhejega (auto-filled, don't change unless server alag ho) |

**Login** button → "✓ Logged in" (admin token)

**2 · Order / Device**
| Field | Kya bharna hai | Kya hota hai |
|---|---|---|
| **Order #** | `RSMSW6R8BYR8OX` (ya order id) | **Fetch Order** — order se WiFi + API key auto-load |
| **Serial code** | auto (ya **Generate** dabao) | Server-side unique serial (RS-XXXX-XXXXXX) order se linked |
| **Model** | `4CH` (auto — order se) | Kaunsa firmware flash karna hai |
| **WiFi SSID** | auto (order pe diya tha) | Board is WiFi se connect hoga |
| **WiFi pass** | auto | WiFi password |
| **API key** | auto (provision se) | Board is key se server se baat karega |

**3 · Flash & Provision** — physical board USB se PC se connect karo
| Button | Kya karta hai |
|---|---|
| **1 · Flash Firmware** | `esptool` se firmware `.bin` server se download karke board pe flash karta hai (0x10000 partition). 460800 baud pe, fail ho to 115200 pe retry |
| **2 · Provision + Test** | Serial pe commands: `setwifi` (WiFi), `setserver` (server URL + API key), `setserial` (serial code), `setmodel` (model), `testrelay` (har relay ON/OFF cycle — **SELF-TEST**), `finish` (reboot) |
| **3 · Mark Tested** | Server pe serial `factory-tested` mark karta hai — quality gate |
| **Next Board ▸** | Order ka agla board (quantity expand hoti hai — har board alag) |

### 2.2 Admin side — verify + ship
1. Logout → **admin login**
2. **Shop / Orders** tab → order `RSMSW6R8BYR8OX` (Paid) dikhta hai
3. **Serial Registry** → **Generate serials** (2CH ×2, 4CH ×2 — har board ka unique serial)
4. **Mark Shipped** → serials order ko assign (2CH → `RS-2CH-...`, 4CH → `RS-4CH-...`)
5. **Mark Delivered** → serials `delivered` status
6. **🖨️ Print Stickers** → QR + serial codes wali sticker sheet (box pe lagti hai)

---

## Part 3 — User: Activate + Home Setup (8:00–13:00)

### 3.1 Serial activate
1. Customer login (`demoflow@example.com` / `Test@12345`)
2. **Activate** page → delivered serial (e.g. `RS-4CH-5STJRF`) → home choose → **Activate**
3. Board device ban jata hai (offline — asli hardware abhi connect nahi)

### 3.2 4CH wala room + devices
1. Dashboard → **📍 Rooms** → `Main Room` banao
2. **Add Device** → `Ceiling Light` (bulb) → Main Room; aise hi TV, AC, Fan
3. Boards page pe dono boards linked dikhte hain

### 3.3 Toggle feel (optimistic + pending)
1. Device toggle dabao — UI **turant** flip (pending pulse) → server confirm → green
2. Offline device pe **"Offline — control band"** + "Last seen: X min ago" — control disabled
3. Room me **All off / All on**, home pe **💡 All lights off**

### 3.4 Schedule (bina cron ke)
1. Device select → **Every day** → **Turn ON** → "🌙 Tonight 9 PM" → **Add Schedule**
2. **Custom (advanced)** → `30 6 * * *` → cron schedule bhi live

### 3.5 AI se ON/OFF
1. **AI** page → home select → "TV on karo" → AI confirm card → **✅ Confirm & Execute**
2. "pankha band karo" → OFF ✅ (confirm pehle, execute baad — by design)

---

## Part 4 — Family (13:00–15:00)

1. Customer → **Family** → `sonu@example.com` (role Member) → **Send Invite** → code `X72NTTC3`-jaisa milta hai
2. Logout → **signup** `sonu` / `sonu@example.com` / `Sonu@12345`
3. **Family** page → Join code enter → **Join** → "✅ Joined Demo Family Home"
4. Dashboard → home switch → sonu ko 6 devices dikhte hain, role **member** (tenant isolation ✅)

---

## Part 5 — Support (15:00–16:30)

1. Customer (sonu ya demoflow) → **Support** page
2. New ticket: subject **Device Not Working**, order select, message → **📨 Send Message**
3. Admin → **Support** tab → conversation dikhti hai → reply (WhatsApp-style chat)
4. Customer ke bell 🔔 me reply ka notification

---

## Part 6 — OTA Update (16:30–19:00)

> **OTA = Over-The-Air**: firmware bina USB ke WiFi pe update. Board update isi tarah hota hai jese mobile OS update hota hai.

### 6.1 Admin — firmware publish
1. Admin → **OTA / ESP** tab
2. **Firmware** section: file `firmware-4ch.bin` (ya universal `firmware.bin`) + **Version** `1.0.1` + **Board model** `4CH` + release notes
3. **📤 Publish Firmware** → `CURRENT: 1.0.1` badge + version history me entry + audit log `ADMIN.FIRMWARE.UPLOAD`
4. Firmware served at `/firmware/firmware-4ch.bin` — boards isi URL se download karte hain

### 6.2 Admin — push update
1. **ESP Boards** list me board (e.g. `RS-4CH-5STJRF · SwitchNest-4CH`, IP, firmware 1.0.0, ONLINE)
2. Board row me **📤 Push** (ya **Push to All**) → server pe `otaPendingVersion = 1.0.1`

### 6.3 ESP update cycle (board ki taraf se)
1. Board ka agla heartbeat (har ~10s) → server **OTA instruction** deta hai:
   ```json
   { "version": "1.0.1", "url": "http://<server>/firmware/firmware-4ch.bin", "required": true }
   ```
2. Board `.bin` download karta hai → flash → har step pe `/ota-progress` se **progress report** (10/35/65/90 → 100, status `downloading` → `installed`)
3. Admin panel me live progress dikhta hai
4. Board **naya `fw_version: 1.0.1`** heartbeat karta hai → server pending clear kar deta hai
5. Admin ESP table me board ab **FIRMWARE 1.0.1 · ONLINE** — update complete ✅
6. Safety: **dual-slot** system — flash gadbad ho to purana firmware wapas boot (brick nahi hota)

### 6.4 User bhi push kar sakta hai
Boards/device page se user khud **Update** dabayega — same mechanism (`user.ota.push`), owner/admin ko notification.

---

## Part 7 — Wrap-up (19:00–20:00)

- Admin **Overview**: stats (users, revenue ₹1,398, orders, devices, ESP boards 2/2, API requests)
- **Audit Log**: poore journey ke events (order → payment → serial → shipped → delivered → claim → OTA → assistant)
- Recap: *Kharido → Flash + Serial → Ship → Activate → Room + Devices → Control (manual/AI/schedule) → Family → Support → OTA updates*

---

## Recording tips

- **Win+G** (Game Bar) ya OBS — full-screen record karo, 1080p
- Har section se pehle 2 sec ruk kar batao "ab X kar rahe hain"
- Har click ke baad 1-2 sec wait karo — viewer ko samajhne de
- Password/creds reveal karna video me theek hai (demo)
- Chat widget (🤖) ka suggestion flow Part 1.2 me zyada achha dikhta hai

## Common troubleshooting

| Problem | Fix |
|---|---|
| Flasher me `Missing dependencies` | `pip install requests pyserial esptool` (ya GUI me **Install now**) |
| Flash pe `No more data to read` | Cable/baud — GUI 115200 pe auto-retry karta hai |
| Board heartbeat nahi aa raha | ESP Server URL sahi hai? Board wahi WiFi pe hai? |
| Board online nahi dikhta | `offline` 90s staleness — board har 10s heartbeat kare to kabhi offline nahi hota |
| OTA progress stuck | Board ka WiFi download bandwidth — progress har heartbeat pe report hota hai |
