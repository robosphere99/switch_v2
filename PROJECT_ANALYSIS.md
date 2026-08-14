# 🚀 RoboSphere — Complete Project Analysis

> **What this is:** A deep-dive analysis of the *current* project (pure PHP + MySQL IoT device control platform). This is a **read-only snapshot** — nothing here is a plan to change; the future plan lives in [`ROADMAP.md`](./ROADMAP.md).

---

## 1. What Is This Project?

**RoboSphere** is a self-hosted **Smart IoT Device Management Platform**. Users create an account, add virtual "devices" (bulb, fan, AC, TV, plug, custom), and control them (on/off) from a web dashboard. Real ESP32 microcontrollers (with relay modules) poll the server over HTTP and physically switch relays based on the device status stored in the database. Devices talk to the server via **API keys**, not user sessions.

**In simple words:** a web dashboard + REST API + ESP32 hardware — where the database is the single source of truth for device state.

| Item | Detail |
|---|---|
| Project name | RoboSphere (folder: `onlineswitch`) |
| Language | PHP (procedural, no framework, no Composer) |
| Database | MySQL / MariaDB (database name: `switch`) |
| Frontend | Server-rendered PHP + Bootstrap 5 + jQuery + custom CSS |
| Hardware | ESP32 + 4-channel relay module |
| Deployment | XAMPP-style local hosting (`htdocs`), free hosts (free.nf) |
| Scale | 39 PHP files, ~3,800 lines of PHP |
| Git history | Single `first commit` — no structured history |

---

## 2. How It Works (End-to-End Flow)

```
Browser                                PHP Server (XAMPP)                    MySQL (switch)
   │                                         │                                   │
   ├─ index.php ──► installed.txt exists? ──► yes ──► home/ (landing page)       │
   │                    │ no                                                    │
   │                    ▼                                                       │
   │              setup/ creates 6 tables + installed.txt                       │
   │                                                                             │
   ├─ Sign Up / Login (jQuery AJAX) ──► home/signup.php, home/login.php ────────► users (password hashed)
   │                    │ session created                                        │
   │                    ▼                                                       │
   ├─ user/ Dashboard ──► add / toggle / edit / delete device (AJAX) ───────────► devices
   │                    │ polls fetch_devices.php every 5s                       │
   │                    ▼                                                       │
   ├─ api/ API Key page ──► generate / list / delete keys (session auth) ───────► api_keys
   │                                                                             │
   └─ ESP32 device ──► GET api/device/read-all.php?api_key=XXX (every 10s) ─────► devices
                        ──► sets relay HIGH/LOW based on status                   │
                        ──► OTA firmware from hardware/firmware/version.json      │
```

**Key design decision:** The ESP32 does **not** send commands — it **polls** the server and mirrors the DB status to its relays. The DB is the source of truth.

---

## 3. Directory Map

```
onlineswitch/
├── index.php                    Entry point — routes to setup or home based on installed.txt
├── installed.txt                Installation marker file
│
├── home/                        Public landing page + auth
│   ├── index.php                Landing page (hero, features, YouTube, login/signup forms)
│   ├── login.php                POST auth (username OR email + password) → session
│   ├── signup.php               POST register (unique username/email, hashed password)
│   ├── script.js                jQuery AJAX handlers (login/signup/username check)
│   └── style.css / test_users.php
│
├── user/                        Authenticated dashboard
│   ├── index.php                Device management page (add form + device cards)
│   ├── add_device.php           Create device
│   ├── toggle_device.php        Toggle on/off
│   ├── update_device.php        Rename device / change status
│   ├── delete_device.php        Delete device
│   ├── fetch_devices.php        List devices (polled every 5s by JS)
│   ├── see_all_devices.php      Server-rendered device cards
│   ├── profile.php              View/edit profile + change password
│   ├── update_profile.php       Save profile
│   └── script.js / style.css
│
├── api/                         JSON API + API key management
│   ├── index.php                Hybrid: JSON API docs + web UI for key management
│   ├── auth/generate-key.php    Generate API key (session required)
│   ├── fetch_api_keys.php       List user's keys (session required)
│   ├── delete_api_key.php       Delete a key (session required)
│   ├── delete_one_api_key.php   Older duplicate delete
│   ├── generate_api_key.php     Older duplicate generate (mixes HTML + logic)
│   ├── device/                  REST-style endpoints (api_key auth):
│   │   ├── read-all.php         GET  all devices
│   │   ├── read.php             GET  one device
│   │   ├── create.php           POST create device
│   │   ├── update.php           POST update status/name
│   │   ├── update-all.php       POST batch update
│   │   └── delete.php           POST delete
│   └── (flat legacy endpoints)  get_device_status.php, update_device_status.php,
│                                get_all_devices_status_using_api.php,
│                                get_all_devices_status_using_userid.php,
│                                update_all_devices_status.php
│
├── components/                  Shared partials
│   ├── navbar.php               Bootstrap navbar (unused by current pages)
│   ├── logout.php               Session destroy + redirect
│   └── check_username.php       Username availability check
│
├── require/
│   ├── db_connect.php           mysqli connection (hardcoded creds, db = "switch")
│   └── check_installation.php   installed.txt check (mostly unused)
│
├── setup/index.php              One-time installer — creates all 6 tables, touches installed.txt
│
├── database/switch.sql          phpMyAdmin dump of the schema
│
├── hardware/firmware/
│   ├── firmware.bin             ESP32 OTA binary
│   └── version.json             OTA version + URL (points to 192.168.0.100/onlineswitch/...)
│
├── examples/
│   ├── ESP32_IoT_Example.ino         Full ESP32 client (WiFi + JSON + relays)
│   ├── IoT_Device_Controller/        Simpler 4-relay firmware (online host)
│   ├── IoT_Device_Controller_Online/ Same, HTTPS variant
│   ├── python_client.py              Python client library
│   ├── nodejs_client.js              Node.js client library
│   └── api_examples.sh               cURL examples
│
└── *.md / README.html            Documentation hub (API docs, setup guide, file inventory…)
```

---

## 4. Database Schema (MySQL — `switch` database)

| Table | Columns | Purpose | Used in code? |
|---|---|---|---|
| `users` | id, username, email, password, created_at | Accounts | ✅ Fully used |
| `devices` | id, user_id, name, type (`bulb/fan/ac/tv/plug/custom`), status (`on/off`), custom_value, created_at, last_updated | Virtual devices | ✅ Fully used |
| `api_keys` | id, user_id, api_key (unique), created_at, expires_at | Device/API auth | ⚠️ Partially — `expires_at` never checked |
| `device_commands` | id, device_id, command, status (`pending`), created_at, executed_at | Command queue | ❌ Table exists, **no code writes/reads it** |
| `device_configurations` | id, device_id, config_name, config_value | Per-device config | ❌ Unused (only cleaned on delete) |
| `device_logs` | id, device_id, log_type, log_message, created_at | Activity log | ❌ Unused (only cleaned on delete) |

> **Important observation:** 3 tables (`device_commands`, `device_configurations`, `device_logs`) were designed for a smarter future (command queues, logs, configs) but **nothing implements them yet**. They are a gift for the rebuild.

---

## 5. API Surface (two parallel generations)

### 5a. Structured REST endpoints — `api/device/*` (newer, cleaner)
All authenticated via `api_key` (GET/POST param). Consistent `{success, error, data}` responses. Proper status codes. Prepared statements. This is the **good** API.

### 5b. Legacy flat endpoints — `api/*.php` (older, inconsistent)
- Different response shapes (`{error}` vs `{success:false,error}`)
- No HTTP status codes
- `update_device_status.php` accepts **any** status string (no `on/off` validation)
- `get_all_devices_status_using_userid.php` requires **no auth at all** — any `user_id` returns that user's devices 😱

### 5c. Documented-but-missing endpoints
`api/index.php` and `FILE_INVENTORY.md` document `/auth/get-keys.php` and `/auth/revoke-key.php` — **these files do not exist**. The real files are `fetch_api_keys.php` and `delete_api_key.php`. Docs are out of sync with code.

---

## 6. Strengths ✅

1. **SQL injection protection** — prepared statements used consistently (`bind_param`).
2. **Password security** — `password_hash()` / `password_verify()` everywhere.
3. **User isolation** — most device endpoints scope queries by `user_id` (ownership check).
4. **API-key model for devices** — clean separation between human sessions and machine access.
5. **Foresight in schema** — command/log/config tables already designed for the future.
6. **Good client ecosystem** — working Python, Node.js, bash, and ESP32 examples.
7. **OTA firmware infrastructure** — `version.json` + `.bin` already in place.
8. **Simple mental model** — DB-as-source-of-truth + polling works reliably.
9. **Device-type abstraction** — enum types (bulb/fan/ac/tv/plug/custom) make UI icons and logic extensible.
10. **AJAX dashboard** — no full page reloads for CRUD, auto-refresh every 5s.

---

## 7. Weaknesses & Bugs Found ⚠️

### 🔴 Security
| # | Issue | File |
|---|---|---|
| 1 | `toggle_device.php` updates device **by id only** — no ownership check; any logged-in user can toggle anyone's device | `user/toggle_device.php` |
| 2 | `get_all_devices_status_using_userid.php` returns any user's devices with **no auth at all** | `api/get_all_devices_status_using_userid.php` |
| 3 | Device names echoed into HTML **without escaping** → stored XSS risk | `user/see_all_devices.php` |
| 4 | No CSRF tokens on any session-based POST | all forms |
| 5 | CORS `Access-Control-Allow-Origin: *` on every API endpoint | `api/device/*` |
| 6 | API keys sent as **URL query params** (leak into logs/history) | examples + flat endpoints |
| 7 | Hardcoded DB credentials in source | `require/db_connect.php` |
| 8 | Password change has no "current password" verification | `user/profile.php` |
| 9 | API key `expires_at` never enforced | `api/device/*` |

### 🟡 Correctness / Consistency
| # | Issue | File |
|---|---|---|
| 10 | Setup SQL has a syntax error: `ENUM('bulb', 'fan', 'ac' 'custom')` (missing comma; also missing `tv`, `plug`) | `setup/index.php` |
| 11 | Two parallel API implementations with different response shapes | `api/` root vs `api/device/` |
| 12 | Docs reference endpoints that don't exist (`get-keys.php`, `revoke-key.php`) | `api/index.php`, `FILE_INVENTORY.md` |
| 13 | `generate_api_key.php` generates a key **on page load**, mixes HTML + logic, broken popup | `api/generate_api_key.php` |
| 14 | `update_device_status.php` accepts any status value (no validation) | `api/update_device_status.php` |
| 15 | Duplicate delete-key logic in two files | `api/delete_api_key.php`, `delete_one_api_key.php` |
| 16 | Hardcoded base URL `http://…/onlineswitch/api` in API docs JSON | `api/index.php` |
| 17 | Inconsistent error shape: sometimes `{error: ...}`, sometimes `{success:false, error:...}` | many files |
| 18 | Navbar/HTML/CSS duplicated across every page instead of a shared layout | `user/*`, `api/index.php` |
| 19 | `see_all_devices.php` mixes DB query + HTML generation (not reusable) | `user/see_all_devices.php` |
| 20 | No `last_updated` update on `toggle_device.php` | `user/toggle_device.php` |

### 🟢 Architectural Limitations
- No framework, no Composer, no autoloading → hard to test, extend, or scale
- No routing layer (each file = an endpoint, hardcoded paths)
- No environment/config management
- No migrations (schema lives in a setup script + a dump)
- No tests at all
- No logging beyond the unused `device_logs` table
- No rate limiting (docs claim "ready" — it isn't implemented)
- Polling-based (5s UI / 10s ESP32) → latency, and no push/realtime channel
- `installed.txt` file flag as an install check (works, but naive)

---

## 8. Feature Inventory — What's Actually Working

| Feature | Status |
|---|---|
| Sign up / login / logout (hashed passwords) | ✅ Working |
| Username availability check | ✅ Working |
| Add / rename / delete devices | ✅ Working |
| Toggle device on/off from dashboard | ✅ Working (with ownership bug #1) |
| Live-ish status (5s polling) | ✅ Working |
| Profile edit + password change | ✅ Working |
| API key generate / list / delete (session UI) | ✅ Working |
| REST API: read / read-all / create / update / update-all / delete | ✅ Working (api_key auth) |
| ESP32 relay control via polling | ✅ Working (examples provided) |
| OTA firmware update infra | 🟡 Started (`version.json` + `.bin`, no management UI) |
| Device commands / logs / configurations | ❌ Tables only — not implemented |
| Timers / schedules | ❌ Not present |
| Rooms / groups for devices | ❌ Not present |
| Notifications | ❌ Not present |
| Mobile app | ❌ Not present |
| AI assist mode | ❌ Not present |

---

## 9. Summary Verdict

**What it is:** a solid, working **proof-of-concept** of the full IoT loop (web dashboard ↔ MySQL ↔ API ↔ ESP32 hardware) with good hygiene in the basics (prepared statements, hashing, ownership checks in most places) — but built as a **monolithic, hard-to-extend PHP app** with duplicated code paths, a couple of real security holes, unused schema tables, and no testing or tooling.

**The good news for the rebuild:**
- The **database design is already a strong foundation** — it just needs to be *used* fully.
- The **API-key device model** and **polling architecture** are proven and simple to replicate.
- The **ESP32 firmware + OTA infra** carries straight over.
- All the *concepts* (devices, commands, logs, configs) map 1:1 onto a modern stack.

**Where the rebuild starts:** see [`ROADMAP.md`](./ROADMAP.md) — keep MySQL, move the frontend to React, the backend to a typed modern API, and build the unused tables into real features (commands, logs, timers, AI assist).
