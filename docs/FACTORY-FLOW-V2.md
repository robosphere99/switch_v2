# Factory & Order Flow v2 — Improvement Spec

> Status: **Phase 1 complete · Phase 2 items 3-5 done** (courier live-integration future) — user's vision, implement phase by phase
> Related: `tools/flasher/flasher_gui.py`, `site/apps/api/src/routes/admin.routes.ts`, `site/apps/api/src/routes/public.routes.ts`, ESP firmware (`hardware/Robosphere-Dev`), `docs/DEMO-WALKTHROUGH.md`

User ka order-to-delivery flow ka full vision — kya improve karna hai, kya implement ho chuka hai, kya pending hai.

---

## ✅ Done (implemented)

### Serial Monitor button — `flasher_gui.py`
- `🔍 Serial Monitor` button Row 3 me (Mark Tested ke baad, Next Board se pehle)
- Khulne pe alag window: live serial output (boot logs, **AP SSID / AP IP / IP** — webserver IP yahi dikhta hai), auto-scroll, Clear, Close
- Niche command box — board ko command bhej sakte ho (`help`, `reboot`, `factoryreset`, …)
- Port conflict guard: monitor khule rehne pe Flash/Provision block; flash/provision chalte waqt monitor button disabled
- Window band karte hi serial close + reader thread stop (koi zombie port nahi)

**Use case**: Provision+finish ke baad monitor kholo → board pe RESET dabao → boot logs me `AP IP : 192.168.4.1` / `IP : 192.168.x.x` dikhega → wahi IP browser me daalo → webserver khul raha hai ya nahi turant pata.

### Payment verified → user notification — `shop.service.ts`
- `updateOrderStatus` me `status === "paid"` pe (admin **Mark Paid** button = `PATCH /api/admin/orders/:id/status`) user ko notification: **"✅ Payment verified — aapka order taiyaar ho raha hai"**
- Notification table me entry + `notification:new` realtime se bell pe turant dikhta hai

### Fetch Order — paid-gate — `admin.routes.ts` provision endpoint
- `GET /api/admin/orders/:id/provision` ab sirf verified-payment orders accept karta hai
- `pending` / `cancelled` order fetch karne pe clear error: *"Payment verify nahi hua — pehle admin Orders me order ko 'Mark Paid' karo"*
- Response me `paymentStatus` bhi aata hai (GUI display ke liye)

### GUI layout swap — `flasher_gui.py`
- **Model** ab LEFT me, **Serial code + Generate** RIGHT me
- Model dropdown me **sirf order ke available devices** dikhte hain (fetch pe `order_models` se) — e.g. order me 2CH + 4CH ho to sirf yehi 2 options, puri MODELS list nahi

### WiFi / API key defaults — `flasher_gui.py`
- Order-time WiFi diya ho → fetch se auto-fill; **nahi diya → default `Robo_lab` / `Robosphere`** auto-fill
- **API key** order me nahi mila (buyer ka home nahi) → GUI me hi generate → server pe create
- Naya endpoint: `POST /api/admin/api-keys` (`{userId, label}`) — key userId/homeId pe permanently bind karta hai

### Flash confirmation + permanent bind — `flasher_gui.py`
- Flash dabane pe confirm dialog: *"Are you sure yeh {model} board hai?"* (order, serial, API key sab dikhta hai)
- OK pe: serial khali ho to server se generate (`/orders/:id/serials/generate` → orderId + reserved), API key khali ho to server pe create (`/api/admin/api-keys` → userId bind) — phir hi flash shuru hota hai

### Hotspot verify (factory quality check) — `flasher_gui.py` `_verify_hotspot`
- Provision me config commands ke baad `export` bhejkar board ka saved **AP naam + password verify** hota hai — sticker ke hotspot naam se match hona chahiye
- Mismatch → **Provision FAIL** (quality gate — galat hotspot wala board pack nahi hota)
- Export na mile (purana firmware) → WARN + manual monitor check
- Real board pe verified: `SwitchNest-RS-4CH-TJC8BD` + serial password → PASS

### Mark Tested → user notification — `admin.routes.ts` mark-tested endpoint
- Serial order se linked hai → user ko notification: **"✅ Factory test pass — Aapka board (serial) relay self-test pass kar chuka hai, ab pack hone chala gaya"**
- Live verified: `RS-2CH-3M6FNV` mark-tested → demoflow ko notification (id 45) mili

### Bill print — `PrintBill.tsx` (`/admin/bill/:orderId`)
- Admin order card pe **🖨️ Bill** button (har order pe, pending/paid/shipped/delivered/cancelled)
- Printable invoice: bill no/date/status badge, Billed To (name/phone/address/user), Payment (method/status/paidAt/ref), items table (product/qty/unit/amount/**serial codes**), total, factory note
- Naya endpoint `GET /api/admin/orders/:id` (items + buyer + payment)
- Print me sirf white bill dikhta hai (toolbar hidden) — `@media print` A4

### Shipped → user notification — `shop.service.ts` updateOrderStatus
- Mark-shipped pe user ko notification: **"🚚 Order shipped — aapke serial keys …"** (serial codes ke saath, Activate link ke liye)
- Delivered pe bhi: **"📦 Order delivered — serial keys …"**

---

## ✅ Phase 1 complete (items 1-7)

1. Payment verified → notification
2. Fetch Order paid-gate
3. GUI layout swap (Model left / Serial right, dropdown sirf order devices)
4. WiFi defaults (Robo_lab/Robosphere) + API key auto-generate (`POST /api/admin/api-keys`)
5. Flash confirmation + permanent serial/API-key bind
6. Mark Tested → notification
7. Bill print

---

## ✅ Phase 2 — items 3-5 implemented

### 3. Stickers — product-specific detail (done)
- Har sticker pe ab:
  - **Hotspot name**: `UserName_OrderID-last-6` + device number suffix (e.g. `demoflow_BYR8OX_1`, `_2`) — order-linked serials pe
  - Order nahi (available serials) → fallback `SwitchNest-<serial>`
  - **Password**: us ESP ki **SerialKey** (unique, factory set)
  - **QR code**: activation URL + serial embedded (pehle se)
- Server: `GET /api/admin/serials` ab har serial pe `orderIdx`/`orderTotal` deta hai (device number per order)
- `admin/print` sticker format upgrade — live verified: `demoflow_BYR8OX_1/_2` + QR

### 4. ESP hotspot naming (firmware side) (done)
- **Flasher GUI** ab provision me `setapname <username>_<orderLast6>[_N]` + `setappass <serial>` bhejta hai (sticker ke naam se match)
- **User login karke webserver me edit kar sakta hai** — WiFi page (`/wifi`) me ab **Access Point (Hotspot)** section: name + password edit fields, `Save & Connect` pe save + restart
- **Factory reset** (`factoryreset`) ab serial ko preserve karta hai (lifetime identity) aur AP credentials serial-derived pe restore karta hai: hotspot `SwitchNest-<serial>`, password = serial key
- WiFiManager effective AP creds: saved → serial-derived → factory default
- Firmware compile verified (model-4ch SUCCESS)

### 5. Courier tracking (UI ready — integration plan done)
- **My Orders** me ab har order pe **▼ Details** → order detail panel:
  - Status timeline (placed → paid → shipped → delivered)
  - Payment (method/status/paidAt/ref) + Shipping (name/phone/address/WiFi)
  - **🚚 Courier Tracking** placeholder box: "Future me courier service integration ke baad yahan live location dikhegi" + current status
- **Concrete integration plan**: `docs/COURIER-TRACKING-PLAN.md` — Shiprocket pehle (multi-courier ek API me), Order schema (courierProvider/AWB/courierStatus/webhook fields), admin ship flow, webhook + 30-min polling, My Orders tracking card upgrade, implementation order + risks

---

## Implementation notes
- Notifications: `site/apps/api/src/services/notification.service.ts` style — user ke paas existing notification system hai (bell 🔔 + realtime `notification:new`)
- Admin routes: `admin.routes.ts` me order/provision/serial endpoints pe checks + notification calls
- Flasher GUI: `tools/flasher/flasher_gui.py` — layout + confirm dialog + API key generate
- Firmware: `hardware/Robosphere-Dev/src/main.cpp` (`setapname`/`setappass` already exist — default naming + factory-reset restore add karna hai)

## Flasher Mode + Guide (localhost ↔ live site bhoolna band)
- **Flasher GUI** Row 1 me **Mode** dropdown: `Live site` / `Localhost` — select karte hi Site URL (API) + ESP Server URL preset se fill hote hain (dono editable). `on_server_mode()`
- **📖 Guide button** — browser me `/admin/flasher-guide` khulta hai (localhost pe web = `:5173`, live = site URL)
- **Admin panel**: naya tab **Flasher Guide** + standalone route `/admin/flasher-guide` (`AdminFlasherGuide.tsx`) — dono modes ki values (creds, ESP server URL), field-by-field matlab, 7-step flow, hotspot naming rule + sticker print link
