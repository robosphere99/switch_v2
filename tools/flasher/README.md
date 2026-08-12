# 🔧 RoboSphere Factory Flasher

Manufacturing tool for flashing + provisioning ESP32 relay boards before shipping.

## What it does

```
Order → serial + WiFi + API key (server se) → Flash firmware → Provision board
→ Relay self-test → Mark tested → Next board
```

| Step | Kya hota hai |
|------|--------------|
| **Login** | Admin credentials → server se token |
| **Fetch Order** | Order ke liye serial code, model, WiFi (decrypted), aur buyer home ka **fresh API key** milta hai |
| **Flash** | `/firmware/firmware.bin` download → `esptool` se ESP32 pe write (0x10000) |
| **Provision** | Serial commands se board pe save: `setwifi`, `setserver <url> <api_key>`, `setserial`, `setmodel` → `finish` (reboot) |
| **Self-test** | `testrelay` — har relay channel on/off cycle → `RELAY n OK/FAIL` |
| **Mark Tested** | Serial ko server pe factory-tested mark (audit log ke saath) |
| **Batch** | Order ke saare items ek queue me — "Next Board" se agla |

## Setup

```bash
pip install requests pyserial esptool
cd tools/flasher
python flasher_gui.py
```

## Usage

1. **Server Connection**: Site URL (`http://localhost:4000`), admin user/pass → **Login**.
   - *ESP Server URL* — board ko dikhne wala URL (ESP ke WiFi se reachable hona chahiye, e.g. `http://192.168.1.100:4000`). Localhost nahi chalega ESP ke liye.
2. **Order / Device**:
   - Order # daal kar **Fetch Order** — serial, WiFi, model, API key auto-fill.
   - Ya **manual**: serial **Generate** karo, model choose karo, WiFi/API key bharo.
3. **COM port** select karo (⟳ = refresh).
4. **1 · Flash Firmware** → **2 · Provision + Test** (relay test bhi isi me) → **3 · Mark Tested** → **Next Board**.

## Firmware commands (board pe, serial @115200)

```
setserial <RS-XXXX-XXXXXX>   — factory serial burn
setmodel  <2CH|4CH|...>      — model code
setwifi   <ssid> <pass>
setserver <url> <api_key>
testrelay                     — relay self-test (RELAY n OK/FAIL)
export                        — poora config JSON dump (verify)
finish                        — config complete + reboot
```

## Server endpoints (GUI inhi se baat karta hai)

- `POST /api/auth/login` — admin login
- `GET  /api/admin/orders/:id/provision` — order items + serial + WiFi (decrypted) + fresh API key
- `POST /api/admin/serials/:code/mark-tested` — factory test mark

## Notes

- Board ke heartbeat me ab `serial` + `model` bhi jaata hai → server pe ESP row me serial dikhta hai (Admin → OTA/ESP tab).
- Serial OTA update ke baad bhi **intact** rehta hai (NVS me saved, firmware reflash se nahi hota).
- `esptool` PATH me hona chahiye (`pip install esptool` se milta hai).
