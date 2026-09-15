# 🚀 SwitchNest ESP32 Firmware & System Optimization Task Tracker

> **Document Status:** Temporary Task Plan & Architectural Blueprint  
> **Target Hardware:** SwitchNest IoT Series (ESP32-WROOM-32 / 2CH, 4CH, 6CH, 8CH, Dimmer)  
> **Active Production Version:** v1.1.5 ➔ **Target Optimized Version:** v1.1.6  
> **Last Updated:** 2026-09-16  

---

## 🛡️ Part 1: Security & Database Cleanup (Immediate Priority)

### 1.1 Root Cause of Board Overlap / "Second Board"
- **Observation:** `Second Board` (`d0:ef:76:33:56:a0`) was showing under **Robo's Home** with API Key `rs_a2kmw` and dummy devices (`Fan1`, `Fan 2`, `Jhumar`, `Big Light`).
- **Cause:** It was an older test board provisioned during laboratory testing using Robo's Home API key. It has been offline since September 9, 2026.
- **Customer Board Verification:**
  1. **Customer 1 (Robo Lab):** `SwitchNest 4CH (Robo Lab)` — MAC: `10:06:1c:f4:f4:a0` | Serial: `RS-4CH-3GW2FS` | Home: `Robo's Home` | Status: `ONLINE`
  2. **Customer 2 (Shinde Home):** `SwitchNest 4CH (Shinde Home)` — MAC: `c0:cd:d6:85:41:34` | Serial: `RS-4CH-FFYJR3` | Home: `shinde's Home` | Status: `ONLINE`

### 1.2 Action Items for Security & Data Sanitization
- [ ] **Delete Stale Board & Dummy Devices:** Purge `Second Board` (`d0:ef:76:33:56:a0`) and its 4 orphan channels (`Fan1`, `Fan 2`, `Jhumar`, `Big Light`).
- [ ] **Orders & Serials Cleanup:** Purge dummy/test order history and unused test serials while strictly preserving real customer orders (#2 & #8) and registered customer serials.
- [ ] **Strict Multi-Tenant Isolation:** Enforce that API keys and MQTT topics (`sn/{mac}/*`) are strictly validated against `macAddress` + `homeId` in backend middleware to guarantee zero cross-home data leakage.

---

## ⚡ Part 2: ESP32 Firmware Optimization (6 Core Modules)

### Module 1: Pure Event-Driven MQTT (EMQX Cloud) — Elimination of HTTP Polling
- **Goal:** Sub-50ms latency for mobile/web toggles and zero unnecessary HTTP polling load.
- **Tasks:**
  - [ ] **Disable Synchronous HTTP Command Polling:** Deprecate FreeRTOS `/api/device/commands` polling loop when MQTT connection is active.
  - [ ] **Dual-Topic MQTT Architecture:**
    - Subscribed: `sn/{mac}/cmd` (Instant execution of relay actions, LED toggle, remote config).
    - Published: `sn/{mac}/state` (Instant delta telemetry upon any relay change) + `sn/{mac}/online` (LWT birth/death).
  - [ ] **Lightweight MQTT Heartbeat:** Send 30s keepalive/ping via MQTT instead of heavy HTTP POST requests.
  - [ ] **Fallback Mechanism:** If MQTT fails continuously for > 60s, smoothly activate HTTP fallback until MQTT reconnects.

### Module 2 & 3: High-Priority Physical Switch (Zero-Delay Offline Operation)
- **Goal:** Wall switch responds in **< 5ms** under all conditions (even if WiFi is disconnected, router is off, or internet is down).
- **Tasks:**
  - [ ] **Decoupled Switch Handler:** Switch GPIO reading and relay switching executed with top priority before any network stack calls.
  - [ ] **Non-Blocking Asynchronous Reconnect:** Ensure `WiFi.begin()`, DNS lookups, and TLS handshakes never call blocking `delay()` in main loop.
  - [ ] **Queue-Based Telemetry:** When offline, physical switch toggles update relay state immediately; state change is enqueued in RAM and published as soon as WiFi reconnects.
  - [ ] **Self-Healing Watchdog:** If WiFi is disconnected for > 15 minutes, perform a background non-blocking WiFi radio restart **without flickering or resetting relay states**.

### Module 4: Multi-WiFi Network Failover (Primary + Backup Hotspot)
- **Goal:** Automatically connect to Primary Home WiFi; if unavailable, seamlessly fall back to Backup WiFi / Mobile Hotspot.
- **Tasks:**
  - [ ] **NVS Storage for Secondary Credentials:** Store `wifi_ssid_2` and `wifi_pass_2` in NVS preferences.
  - [ ] **Smart Sequential Scanner / WiFiMulti:** Boot tries Primary SSID (10s timeout); if not found, immediately attempts Backup SSID.
  - [ ] **Captive Portal Web UI Update:** Update local AP setup page (192.168.4.1) to accept "Primary WiFi" + "Backup WiFi (Optional)".

### Module 5: Flash-Safe NVS State Memory (Power-Cut State Restoration)
- **Goal:** Restore previous ON/OFF state after a power cut while protecting ESP32 Flash memory from wear-and-tear.
- **Tasks:**
  - [ ] **1-Byte State Bitmask:** Store 8 relay states as a single `uint8_t` byte (`0b00001011`).
  - [ ] **Change-Only Commit:** Flash write is executed ONLY if the bitmask value has actually changed (`newByte != cachedByte`).
  - [ ] **Debounced Flash Write (500ms):** Prevent rapid multiple writes if physical switch is flipped quickly.
  - [ ] **Boot Recovery:** In `setup()`, read NVS bitmask and apply pin states to relays before enabling network stack.

### Module 6: Admin Panel OTA Firmware Push & Live Progress Testing
- **Goal:** 1-Click over-the-air firmware updates from SwitchNest Admin Panel with live percentage progress bar.
- **Tasks:**
  - [ ] **PlatformIO Production Build:** Compile `.bin` firmware with new version tag (e.g., `v1.1.6`).
  - [ ] **Admin Panel Publishing:** Upload `.bin` to Admin Panel (`/admin` -> Firmware Tab).
  - [ ] **Push Notification via MQTT:** Admin clicks "Push OTA" -> backend publishes OTA payload on `sn/{mac}/cmd`.
  - [ ] **Progress Reporting (`0% -> 100%`):** ESP32 streams download progress to `/api/device/ota-progress` -> Admin UI shows realtime progress bar.
  - [ ] **Safe Dual-Bank Swap & Reboot:** ESP32 validates binary hash, writes to OTA partition, and restarts into new firmware.

---

## 📊 Summary Execution Plan
1. **Phase A:** Execute Database Cleanup (Remove `Second Board`, clean test orders, protect real customer boards).
2. **Phase B:** Firmware Core Refactor (`RelayManager` NVS persistence, `SwitchManager` zero-delay priority, `WiFiManager` multi-SSID, `MqttManager` pure event loop).
3. **Phase C:** PlatformIO Build `.bin` & Upload via Admin Panel OTA to test live wireless update.
