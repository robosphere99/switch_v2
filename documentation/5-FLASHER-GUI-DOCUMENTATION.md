# 🔨 SwitchNest — Flasher GUI Documentation

> **Tool:** `tools/flasher/flasher_gui.py`
> **Type:** Python Tkinter desktop application
> **Purpose:** Factory provisioning of ESP32 SwitchNest boards
> **Launcher:** `Flasher-Latest.bat` (always uses the latest version from repo)

---

## 🎯 Purpose

The Flasher GUI automates the complete factory setup of a SwitchNest hardware board:
1. Download and flash firmware to the ESP32
2. Provision WiFi, server, serial, and model over serial port
3. Verify hardware quality (hotspot name, relay self-test, web server check)
4. Mark the board as factory-tested in the admin system

This eliminates manual steps, reduces errors, and ensures every board shipped to a customer is properly provisioned and verified.

---

## 🖥️ UI Layout

### Theme
**Tailwind Slate Dark palette:**
- Background: `#0f172a` (slate-900)
- Panel: `#1e293b` (slate-800)
- Border: `#334155` (slate-700)
- Text: `#f8fafc` (slate-50)
- Accent Blue: `#3b82f6` (blue-500)
- Action Green: `#10b981` (emerald-500)
- Muted Text: `#94a3b8` (slate-400)

### Tab Structure
```
┌─────────────────────────────────────────────────────────┐
│  SwitchNest Factory Flasher                             │
├──────────┬──────────────────────────────────────────────┤
│ Setup    │ Log / Serial Monitor                         │
├──────────┴──────────────────────────────────────────────┤
│ ┌─ Server Config ──────────────────────────────────────┐│
│ │ Mode: [Live Site / Localhost]  Site URL             ││
│ │ Admin User:          Admin Password:                ││
│ │ ESP Server URL:      [🔍 Detect LAN IP]             ││
│ └─────────────────────────────────────────────────────┘│
│ ┌─ Order ──────────────────────────────────────────────┐│
│ │ Order #:   [input]  [📦 Fetch Order]  [Install Deps]││
│ │ Order info: #123 · 2 boards (4CH, 2CH)              ││
│ └─────────────────────────────────────────────────────┘│
│ ┌─ Board ───────────────────────────────────────────────┐│
│ │ Model: [4CH ▼]  Serial: [auto-filled] [Generate]    ││
│ │ WiFi SSID:       WiFi Password:                     ││
│ │ API Key:         [auto-filled or generate]          ││
│ └─────────────────────────────────────────────────────┘│
│ ┌─ Flash ───────────────────────────────────────────────┐│
│ │ COM Port: [COM8 ▼]  [🔄 Refresh]                    ││
│ │ [💥 Fresh Start (Wipe)]    [⚡ Flash Firmware]       ││
│ │ [🚀 Provision + Test]      [🔍 Serial Monitor]       ││
│ │ [✅ Mark Tested]           [➡ Next Board]            ││
│ └─────────────────────────────────────────────────────┘│
│                            [📖 Guide]  [Install Deps]  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Factory Flow (Step by Step)

### Step 0 — Launch
```
Run: Flasher-Latest.bat
   - Opens repo's latest flasher_gui.py
   - NOT the old .exe files (those are outdated)
```

### Step 1 — Configure Server
- Select **Mode**: `Localhost` (for local testing) or `Live site` (production)
- Mode auto-fills:
  - **Localhost**: Site URL = `http://localhost:5173`, ESP Server = `http://192.168.1.x:4000`
  - **Live site**: Site URL = `https://onlineswitch.bhartitechnical.com`, ESP Server = production URL
- Enter admin **Username** and **Password**
- Click **Login** → get admin token

### Step 2 — Fetch Order
- Enter order number (e.g., `BYR8OX`)
- Click **📦 Fetch Order**
- Auto-fills: model, serial code, WiFi credentials, API key
- If API key missing → auto-generates from server
- Shows: `#BYR8OX · 2 board(s) baki → SwitchNest 4CH`

### Step 3 — Select COM Port
- Click **🔄 Refresh** to scan available serial ports
- Select the ESP32's port (e.g., `COM8`)

### Step 4 — Fresh Start (Optional Wipe)
- **💥 Fresh Start (Wipe)** — only use for pre-owned boards
- Wipes flash using esptool (`erase_flash`)
- Shows confirmation dialog first

### Step 5 — Flash Firmware
- Click **⚡ Flash Firmware**
- Shows confirm dialog with: Order, Model, Serial, API Key
- Firmware download:
  - Tries model-specific first: `firmware-4ch.bin`
  - Falls back to: `firmware.bin`
  - Download from: `<ESP Server URL>/firmware/<filename>`
- Flash via esptool:
  - First attempt: `460800` baud (fast)
  - Retry on fail: `115200` baud (stable)
- Shows firmware build timestamp
- Board reboots automatically after flash

### Step 6 — Provision + Test
- Click **🚀 Provision + Test**
- Sends serial commands to board:
  1. `setwifi <ssid> <pass>` — customer's WiFi
  2. `setserver <url> <api_key>` — SwitchNest server + device API key
  3. `setserial <code>` — serial code
  4. `setmodel <model>` — 4CH/2CH/etc
  5. `setapname <username_OrderLast6>` — hotspot name (matches sticker)
  6. `setappass <serial>` — hotspot password
  7. `finish` — save config + reboot
- After reboot:
  - Waits for board to restart
  - **Hotspot verify**: sends `export` → checks AP name + password match sticker ✅ / ❌
  - **Relay self-test**: cycles each channel (`RELAY 1 OK`, `RELAY 2 OK`, ...)
  - **Web server check**: HTTP GET to board LAN IP → expects `200 OK`

### Step 7 — Serial Monitor (Optional but Recommended)
- Click **🔍 Serial Monitor** → opens a log window
- Shows real-time boot logs: `IP: 192.168.1.36`, `AP IP: 192.168.4.1`
- Can send commands: `help`, `info`, `reboot`, `factoryreset`
- Monitor must be closed before Flash/Provision (port conflict guard)

### Step 8 — Mark Tested
- Click **✅ Mark Tested**
- Calls: `POST /api/admin/serials/:id/mark-tested`
- Customer gets notification: "✅ Factory test pass — pack hone chala"
- Audit log updated

### Step 9 — Next Board (Multi-device orders)
- Click **➡ Next Board** → auto-loads next item from order queue
- Repeat steps 5–8 for each board

---

## 🔑 Serial Communication Details

The Flasher communicates with the ESP32 over the selected COM port at **115200 baud**.

### Factory Unlock Sequence
For provisioning, the Flasher automatically unlocks the serial console:
```
→ unlock robosphere_admin_99
← [OK] Console unlocked
→ setwifi <ssid> <pass>
← [OK] WiFi saved
→ ... (other commands)
→ finish
← [REBOOT]
```

### Export Verify Format
```json
{
  "apSSID": "username_BYR8OX_1",
  "apPass": "SN-XXXX-YYYY",
  "serial": "SN-XXXX-YYYY",
  "model": "4CH",
  "server": "http://192.168.1.35:4000",
  "apiKey": "sk_..."
}
```

---

## 📊 Log Tab

The **Log** tab shows a timestamped log of all actions:
```
[12:34:55] [info] Login OK — admin token acquired
[12:35:01] [info] Order #BYR8OX fetched — 2 boards
[12:35:12] [info] Firmware Build Time: 2026-08-25 01:38:05
[12:35:30] [ok] Downloaded 1.09 MB → firmware.bin
[12:35:45] [info] Flashing (esptool @ 460800)…
[12:36:02] [ok] Flash OK — board rebooting…
[12:36:17] [ok] Hotspot verify PASS — SwitchNest-RS-4CH-TJC8BD
[12:36:20] [ok] RELAY 1 OK
[12:36:21] [ok] RELAY 2 OK
[12:36:22] [ok] RELAY 3 OK
[12:36:23] [ok] RELAY 4 OK
[12:36:25] [ok] Web server reachable: http://192.168.1.36 → 200
[12:36:28] [ok] Mark Tested → user notified
```

Colors: `info` = blue, `ok` = green, `warn` = yellow, `err` = red

---

## ⚠️ Common Error Messages

| Error | Cause | Fix |
|---|---|---|
| `esptool failed (exit code 1)` | Wrong COM port / bad USB cable | Try different port/cable |
| `firmware download fail` | Server not running / firmware not uploaded | Start API server, upload firmware via Admin |
| `Hotspot verify FAIL` | AP name/pass mismatch | Check sticker serial matches what was provisioned |
| `Login FAIL` | Wrong creds / server down | Check mode (localhost vs live) + server status |
| `Flash @460800 fail` | Noisy USB / old cable | App auto-retries at 115200 |
| `Serial Monitor ON — close first` | Port conflict | Close serial monitor tab before flashing |
| `Port busy` | Another app (Arduino IDE) using port | Close other serial monitors |

---

## 🛠️ Development / Running from Source

### Requirements
```bash
pip install requests pyserial esptool
```

### Run
```bash
cd tools/flasher
python flasher_gui.py
```

### Key Dependencies
| Package | Purpose |
|---|---|
| `tkinter` | GUI (built into Python) |
| `requests` | HTTP calls to admin API |
| `pyserial` | Serial port communication |
| `esptool` | ESP32 flashing |
| `threading` | Non-blocking operations |

---

## 📝 Flasher Guide (In Admin Panel)

The admin panel has a built-in **Flasher Guide** at `/admin/flasher-guide`:
- Mode-specific URLs and credentials
- Field-by-field explanation
- 7-step factory flow diagram
- Hotspot naming rules
- Sticker print link

---

*Last updated: 2026-08-25 | Tool: flasher_gui.py | Python 3.x + Tkinter*
