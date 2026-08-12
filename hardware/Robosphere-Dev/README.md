# Robosphere IoT — PlatformIO Project

PlatformIO version of the Robosphere IoT ESP32 firmware. Original code, organized folder-wise (sirf include paths fix kiye hain, code logic untouched).

## Folder Structure

```
Robosphere-Dev/
├── platformio.ini          # PlatformIO config (esp32dev, ArduinoJson v6)
├── src/
│   ├── main.cpp            # Entry point (RobosphereIot.ino ka content)
│   ├── core/               # Managers — API, WiFi, Relay, Switch, Sync, OTA, LED, Time, etc.
│   ├── preferences/        # PreferencesManager (NVS storage)
│   └── web/                # Web pages — Dashboard, Server, System, WiFi
└── include/
    ├── Config.h            # Shared config (root)
    ├── Device.h            # Device model (root)
    ├── BoardProfile.h      # Board profile struct (root)
    ├── core/               # Manager headers
    ├── preferences/        # PreferencesManager.h
    └── web/                # Page headers
```

## Build

```bash
cd Robosphere-Dev
pio run                 # build
pio run -t upload       # upload to board
pio device monitor      # serial monitor (115200)
```

## Multi-Device Upload (IMPORTANT)

Har device ke 2 environments hain — **serial** (USB cable) aur **ota** (WiFi).

| Device | Serial (USB) | OTA (WiFi) |
|---|---|---|
| Device 1 (ghar wala) | `pio run -e esp32doit-devkit-v1 -t upload` (COM8) | `pio run -e esp32-ota -t upload` (IP `192.168.1.33`) |
| Device 2 | `pio run -e esp32doit-devkit2 -t upload` (COM5) | `pio run -e esp32doit-devkit2-ota -t upload` (IP `192.168.1.36`) |

**Serial monitor:** `pio device monitor -e esp32doit-devkit2` (COM port env se aata hai)

### Nayi device kaise add karein

`platformio.ini` mein har device ka block copy karke COM port + IP badal do:

```ini
[env:mydevice-serial]
extends = env:esp32doit-devkit-v1      ; common settings inherit
device = ESP32DOIT_DEVKIT_V1         ; optional: alag board ho toh
upload_port = COMx
monitor_port = COMx

[env:mydevice-ota]
extends = env:mydevice-serial
upload_protocol = espota
upload_port = 192.168.1.xx            ; us device ka IP
upload_flags =
    -a
    admin
```

### OTA kaise kaam karta hai (samajhne ke liye)

- `upload_port = 192.168.1.33` wo **device ka apna IP** hai jo usne router se DHCP liya hai.
- `pio run -e esp32-ota -t upload` firmware ko **WiFi ke upar us IP pe bhejta hai** — USB cable ki zaroorat nahi.
- **Har device ka IP alag hota hai** — isliye har device ka apna `-ota` env bana hai.
- ⚠️ **DHCP IP badal sakta hai!** Naya device add karo, ya kabhi OTA fail ho toh:
  - Device ka current IP dekho: dashboard pe, serial boot log mein (`IP : 192.168.1.xx`), ya router ke DHCP client list mein.
  - Phir `platformio.ini` mein `upload_port` update karo.
  - **Stable chahte ho?** Router mein us device ke MAC ke liye **static IP reservation** kar do (MAC: serial boot log ya `espota`/router se).
- `-a admin` = ArduinoOTA password (web login password ke equal).

### Tip: koi bhi env pe override

Config change kiye bina bhi upload target badal sakte ho:

```bash
pio run -e esp32doit-devkit-v1 -t upload --upload-port COM5
pio run -e esp32-ota -t upload --upload-port 192.168.1.36
```

## Auto-Detect Device IPs (script)

**`tools/find_devices.py`** — network scan karke saare Robosphere devices dhoondhta
hai aur `platformio.ini` ke OTA IPs khud update kar deta hai. IP change ho jaye
toh bas yeh chalao:

```bash
python tools/find_devices.py            # sirf scan + report
python tools/find_devices.py --update   # scan + platformio.ini IPs update
python tools/find_devices.py --map      # naya device mila? interactively map karo
```

- Device ki pehchaan **MAC address** se hoti hai (`.device_map.json`: MAC → env name)
- IP change ho jaye toh bhi pata rehta hai kaunsa device hai (MAC same rehta hai)
- Naya device pehli baar UNKNOWN dikhta hai — uske MAC ko `--map` se env se jodo

## Factory Provisioning Tool (boards sell karne ke liye)

**`tools/provision.py`** — nayi ESP32 board ko sell-ready banata hai ek command
mein: firmware flash + default name/password + verify + label.

```bash
python tools/provision.py --port COM5                       # full flow
python tools/provision.py --port COM5 --no-flash            # sirf serial config
python tools/provision.py --list-ports                      # ports dekho
python tools/provision.py                                   # interactive wizard
python tools/provision_gui.py                               # GUI version (window)
```

**GUI (`provision_gui.py`)** — polished dark-theme tkinter window (rounded UI):

- **Rounded design** — cards, input fields, PROVISION button aur custom
  checkboxes sab rounded corners ke saath; top pe brand accent bar
- **DEVICE** section — COM port dropdown (⟳ Refresh) + env select
- **DEFAULTS** section (2-column compact) — AP name/password, admin,
  switch mode, OTA/server fields
- **OPTIONS** section — Flash / Factory reset / Build first (custom
  accent checkboxes)
- **Styled dropdowns** — dark popdown list + purple selection highlight
  (postcommand se har dropdown khulte hi style hota hai)
- Ek bada **PROVISION** button (hover effect, Enter se bhi chalta hai)
- **Live colored log** — hamesha visible (window size ke saath expand),
  steps amber, success green, errors red, placeholder text pehle se
- **Status bar** (colored dot) + "Boards ready" counter

Provisioning background thread mein chalta hai (UI freeze nahi hoti), end
mein label log mein print hota hai. CLI wale logic ko hi reuse karta hai
(`provision.py`).

**Requirements:** Python + `pip install pyserial` (tkinter Python ke saath
aata hai). Chalane ke liye: `cd Robosphere-Dev && python tools/provision_gui.py`

Har naye board pe yeh hota hai:

1. **Flash** — PlatformIO se firmware (COM port pe)
2. **Factory reset** — clean NVS (purana config nahi rehta)
3. **Defaults set** (serial commands):
   - **AP name** — `auto` mode MAC se unique naam banata hai (e.g. `Robosphere-F4A0`) —
     har unit ka alag naam, same ghar mein multiple units clash nahi karte
   - **AP password** (default `12345678`)
   - **Admin login** (default `admin`/`admin`)
   - **Switch mode** (`momentary`/`toggle`)
   - OTA URL / server URL + API key (optional, flags se)
4. **Verify** — serial config export compare + boot log se AP SSID confirm
5. **Label print** — box pe chipkane ke liye (AP name, passwords, buyer setup steps)

Board **setup mode mein hi rehta hai** — buyer phone se AP se judke
`192.168.4.1` kholta hai aur apna WiFi + admin set karta hai.

### Nayi serial commands (firmware mein add kiye)

| Command | Kya karta hai |
|---|---|
| `setapname <name>` | AP SSID set karo (per-unit naam — sell ke liye) |
| `setappass <pass>` | AP password set karo |
| `export` | Pura config JSON + MAC print (verify ke liye) |
| `reboot` | Restart (bina config change kiye) |
| `factoryreset` | NVS wipe + restart (clean slate) |

AP name/password ab NVS mein save hote hain (config export/import mein bhi
include hain) — `WiFiManager::startAccessPoint()` saved values use karta hai.
Setup page pe pre-set admin credentials **pre-filled** dikhte hain (buyer
change kar sakta hai).

## ⚠️ Recovery Button (GPIO0) Note

`RECOVERY_BUTTON_PIN = 0` (BOOT button) hai. **Serial monitor/uploader DTR line
ko assert karta hai toh GPIO0 LOW hota hai = "button pressed"** — purane firmware
mein isse 10s tak rakho toh factory reset trigger ho jaata tha. Fix ho gaya
(`src/core/RecoveryManager.cpp`): boot ke baad 3s grace + press tabhi count jab
button pehle release (HIGH) dekha gaya ho. Ab serial monitor khulne se kuch
nahi hota — asli button dabane pe hi recovery/factory reset kaam karta hai.

> Note: device 2 (COM5) ke boot log mein "Recovery Button Pressed" dikhta hai
> toh woh us board pe DTR timing ka effect tha — naye firmware se yeh line
> sirf asli button dabane pe aayegi.

## Notes

- Board `esp32dev` is a generic default — apni board ke hisaab se `platformio.ini` mein `board` change karo. (Abhi `esp32doit-devkit-v1` set hai — DOIT DEVKIT V1.)
- `ArduinoJson v6` pinned hai (`^6.21.5`) kyunki code `StaticJsonDocument` use karta hai (v7 mein remove ho gaya).
- `WifiManager.h` → `WiFiManager.h` rename kiya hai (Linux case-sensitive systems pe include fail hota tha).
- Original source project root mein hai; yeh sirf PlatformIO build ke liye organized copy hai.

## Development Workflow (IMPORTANT)

**Root folder (`../`) = purana working prototype — FROZEN. Kabhi chhedo mat.**
Yeh sirf reference/backup hai (`Release v0.13.0` git pe committed hai).

**Saara naya development isi `Robosphere-Dev/` folder mein hoga.**

- Is folder mein jo changes hain wo root se aage hai:
  - `main.cpp` — setup/AP mode mein OTA check skip (web server turant start), serial config commands (`setwifi`/`setadmin`/`setserver`/`finish`)
  - `WiFiManager.cpp` — station join/leave diagnostic logging
  - `JsonDocument` → `DynamicJsonDocument` (ArduinoJson 6.21 ke liye fix)
- Root mein kabhi bhi changes copy karne ki zaroorat nahi — sirf yahin kaam karo.
- Build/upload hamesha yahin se: `cd Robosphere-Dev && pio run` / `pio run -t upload`
