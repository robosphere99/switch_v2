# 🔧 SwitchNest — Hardware & Firmware Documentation

> **Hardware Platform:** ESP32 (DOIT DevKit V1) + Relay Modules
> **Firmware:** PlatformIO + Arduino framework
> **Location:** `hardware/Robosphere-Dev/`

---

## 📦 Supported Board Models

| Model Code | Relays | Description |
|---|---|---|
| `1CH` | 1 | Single relay (lights, small appliances) |
| `2CH` | 2 | 2-relay module |
| `4CH` | 4 | 4-relay module (most common) |
| `6CH` | 6 | 6-relay module |
| `8CH` | 8 | 8-relay module |
| `DIM*` | 1 | Dimmer board (PWM) |

---

## 🧠 Firmware Architecture

The firmware is modular — each subsystem is a separate C++ manager in `src/core/`:

```
main.cpp
├── WiFiManager         — WiFi connection + AP fallback mode
├── MqttManager         — MQTT client (PubSubClient, primary realtime channel)
├── ApiManager          — HTTP REST client (fallback polling every ~10s)
├── SyncManager         — Background task (HTTP heartbeat + command poll)
├── RelayManager        — GPIO relay hardware control (thread-safe mutex)
├── SwitchManager       — Physical wall switch input + debouncing
├── BoardManager        — Board profile (relay count, pin mapping, relay names)
├── WebServerManager    — Local ESP web server (dashboard, WiFi config, API)
├── StatusManager       — Generates JSON status payload for local dashboard
├── OTAManager          — Arduino OTA + SwitchNest OTA HTTP check
├── LedManager          — Status LED indicator
├── DimmerManager       — PWM dimmer control (DIM boards only)
├── RecoveryManager     — Factory reset + boot watchdog
├── SystemManager       — System info (MAC, WiFi RSSI, heap, chip)
├── TimeManager         — NTP time sync
└── Logger              — Serial logging (structured output)
```

---

## 🔌 Pin Layout (4CH Default — RS-4CH)

| Channel | Relay GPIO | Switch GPIO |
|---|---|---|
| 1 | 26 | 4 |
| 2 | 27 | 5 |
| 3 | 14 | 18 |
| 4 | 12 | 19 |

> **Note:** Pin mapping is defined in `hardware/Robosphere-Dev/src/core/BoardProfiles.h`. Each model has its own `BoardProfile` struct.

---

## 📡 Communication Architecture

```
                    ┌─────────────────────────────────────┐
                    │         ESP32 Board                │
                    │                                     │
                    │  WiFi ──► MQTT (primary, <1s)      │
                    │       ──► HTTP poll (fallback 10s)  │
                    │                                     │
                    │  Relay 1 ──► Load (bulb/fan/etc)   │
                    │  Relay 2 ──► Load                   │
                    │  ...                                │
                    └─────────────────────────────────────┘
```

### MQTT (Primary Channel)
- **Broker:** SwitchNest Node.js server (Aedes MQTT broker embedded)
- **Subscribe topic:** `sn/{MAC}/cmd` — receives commands and device name mappings
- **Publish topic:** `sn/{MAC}/state` — sends relay states and telemetry
- **Heavy telemetry** (IP, SSID, FW version, model) sent only at **boot/reconnect** (bandwidth optimized)
- **Relay states** sent on **every change** (lightweight)

### HTTP (Fallback)
- Polls `GET /api/read-all` every ~10s (with 15s initial boot delay for MQTT to connect first)
- Exponential backoff on failure
- Used if MQTT is unavailable

---

## 🔒 Zero-Trust Serial Security

The serial console is **password-locked** by default.

### Serial Commands (post-unlock)

| Command | Format | Description |
|---|---|---|
| `unlock` | `unlock <password>` | Unlock the serial console |
| `lock` | `lock` | Re-lock the serial console |
| `setconsolepass` | `setconsolepass <pass>` | Set new console password (NVS) |
| `setwifi` | `setwifi <ssid> <password>` | Configure WiFi credentials |
| `setserver` | `setserver <url> <api_key>` | Set API server URL and device API key |
| `setserial` | `setserial <code>` | Set device serial code |
| `setmodel` | `setmodel <code>` | Set board model (4CH, 2CH, etc.) |
| `setapname` | `setapname <name>` | Set WiFi AP SSID |
| `setappass` | `setappass <pass>` | Set WiFi AP password |
| `setapkeep` | `setapkeep <on\|off>` | Keep AP active when WiFi connected |
| `setswitch` | `setswitch <momentary\|toggle>` | Switch type |
| `setotaurl` | `setotaurl <url>` | Set OTA check URL |
| `export` | `export` | Dump full config as JSON |
| `info` | `info` | Quick diagnostic dump (MAC, IP, RSSI, MQTT, uptime, free heap) |
| `reboot` | `reboot` | Restart the board |
| `finish` | `finish` | Save config and restart |
| `factoryreset` | `factoryreset` | Wipe WiFi/server/API key (preserves serial code) |
| `help` | `help` | List all commands |

**Default password:** `robosphere_admin_99` (for legacy unprovisioned devices)
**New device password:** Set during factory provisioning via `rotate_console_pass` MQTT command.

### Rotating Console Password (via MQTT)
Admin can rotate the serial console password remotely:
```json
// Published to sn/{MAC}/cmd topic
{ "rotate_console_pass": "new_secure_password_here" }
```

---

## 🌐 Local Web Server (On-Device Dashboard)

Each ESP32 runs a built-in web server accessible at its LAN IP:

| Route | Description |
|---|---|
| `/` | Dashboard — relay on/off buttons with device names |
| `/status` | JSON status endpoint (relay states, IP, firmware, names) |
| `/wifi` | WiFi config page (SSID, password, AP config) |
| `/update` | OTA firmware upload page (for manual updates) |
| `/logs` | Serial log viewer |

**Authentication:** Admin username/password (set in NVS via `setadmin` command).

---

## 🔄 OTA (Over-the-Air Updates)

### OTA Mechanisms
1. **SwitchNest Server OTA** — Admin pushes OTA via `POST /api/admin/esp/:id/push-ota`.  
   Board checks `version.json` from server, downloads `.bin`, and flashes.

2. **Arduino OTA** — Local network OTA via PlatformIO `pio run -t upload --upload-port <IP>`.

3. **Web UI OTA** — Upload via board's built-in `/update` page.

### Firmware Files
- **Binary:** `hardware/firmware/firmware.bin` (served at `/firmware/firmware.bin`)
- **Model-specific:** `firmware-4ch.bin`, `firmware-2ch.bin` (Flasher tries model-specific first)

---

## 🏭 Factory Provisioning Sequence

1. **Fresh Start / Wipe** — erase flash using esptool
2. **Flash Firmware** — write `firmware.bin` via esptool at 460800 baud (115200 fallback)
3. **Provision via Serial:**
   - `setwifi <ssid> <pass>` — customer's WiFi
   - `setserver <url> <api_key>` — SwitchNest server + device key
   - `setserial <code>` — factory serial code
   - `setmodel <model>` — board model (4CH/2CH/etc)
   - `setapname <name>` — hotspot name (e.g., `username_OrderLast6_1`)
   - `setappass <serial>` — hotspot password (serial key)
4. **Hotspot Verify** — send `export` command, verify AP name/pass match sticker
5. **Relay Self-Test** — cycle each relay, check `RELAY n OK`
6. **Web Server Check** — HTTP GET to board LAN IP, verify response
7. **Mark Tested** — admin marks serial as tested in dashboard

---

## 📊 MQTT Payload Formats

### State Publish (`sn/{MAC}/state`)
```json
// Lightweight (relay state changes):
{ "mac": "AABBCCDDEEFF", "states": [1, 0, 1, 0] }

// Full telemetry (at boot/reconnect only):
{
  "mac": "AABBCCDDEEFF",
  "ip": "192.168.1.36",
  "ssid": "Robo_lab",
  "fw": "v2.1.0",
  "model": "4CH",
  "states": [1, 0, 1, 0]
}
```

### Command Subscribe (`sn/{MAC}/cmd`)
```json
// Relay control:
{ "commands": [{ "deviceId": 1, "status": "on" }] }

// Device name mapping (for local dashboard):
{ "names": ["Living Room Light", "Fan", "AC", "TV"] }

// Rotate console password:
{ "rotate_console_pass": "new_password_here" }

// WiFi reconfiguration:
{ "setwifi": { "ssid": "NewWiFi", "password": "pass123" } }
```

---

## 🏗️ Building & Flashing

### Prerequisites
- PlatformIO (VS Code extension or CLI)
- `C:\Users\robos\.platformio\` (PlatformIO installs here automatically)
- ESP32 board + USB cable (CP210x or CH340 driver)

### Build
```bash
cd hardware/Robosphere-Dev
pio run                          # Compile only
pio run -t upload                # Compile + Flash (auto-detect port)
pio run -t upload --upload-port COM8   # Specify port
```

### Build Targets (platformio.ini)
| Target | Description |
|---|---|
| `esp32doit-devkit-v1` | Standard DOIT DevKit V1 |
| `esp32doit-devkit2` | Alternative DevKit variant |
| `esp32-ota` | OTA-enabled release build |

### After Build
Copy the binary to the firmware directory so the API can serve it:
```powershell
Copy-Item -Path "hardware/Robosphere-Dev/.pio/build/esp32doit-devkit-v1/firmware.bin" `
          -Destination "hardware/firmware/firmware.bin" -Force
```

---

## 🔍 Serial Monitor / Diagnostics

Connect at **115200 baud**. Boot output includes:
```
[BOOT] SwitchNest Firmware v2.1.0
[WIFI] Connecting to Robo_lab...
[WIFI] Connected! IP: 192.168.1.36
[MQTT] Connecting to mqtt://192.168.1.35:1883...
[MQTT] Connected! Subscribed to sn/AABBCCDDEEFF/cmd
[MQTT] Sent telemetry: {"mac":"AABBCC...","ip":"192.168.1.36",...}
AP IP : 192.168.4.1
IP    : 192.168.1.36
```

Use `info` command for a quick diagnostic dump without rebooting:
```
[INFO] MAC: AA:BB:CC:DD:EE:FF
[INFO] IP: 192.168.1.36
[INFO] RSSI: -58 dBm
[INFO] MQTT: Connected
[INFO] Uptime: 1234567 ms
[INFO] Free Heap: 187452 bytes
```

---

## ⚠️ Known Limitations & Gotchas

- **Factory reset preserves serial code** (lifetime device identity) but wipes WiFi/server/API key
- **Dual-mode AP** (`setapkeep on`): board stays in AP mode while connected to WiFi (useful for factory testing)
- **MQTT vs HTTP priority**: MQTT state changes happen instantly via interrupt; HTTP is fallback only (15s boot delay)
- **Board must be on same LAN** as the PC for the Flasher "web server check" to succeed (HTTP ping to LAN IP)
- **Relay names are RAM-cached** (not NVS) — refreshed on every MQTT reconnect from server push

---

*Last updated: 2026-08-25 | Firmware Platform: PlatformIO + Arduino ESP32 3.x | Board: ESP32 DOIT DevKit*
