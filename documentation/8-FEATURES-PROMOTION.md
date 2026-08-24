# 🚀 SwitchNest — Features for Publicity & Promotion

> **Version:** SwitchNest v2 (Production-ready)
> **Live:** `https://onlineswitch.bhartitechnical.com`
> **Tagline:** *The smart home platform that actually ships hardware.*

---

## 🌟 What Makes SwitchNest Different

SwitchNest isn't a tutorial project — it's a **production smart home platform** with real customers, real hardware, and a full commercial pipeline from order → factory → delivery → activation.

---

## ✅ Completed Features (Ready to Ship)

### 🏠 Smart Home Control Platform
- **Multi-tenant architecture** — each family gets their own isolated Home
- **Real-time device control** — toggle relays in under 1 second via MQTT
- **Socket.IO live updates** — web and mobile dashboards update instantly
- **Room organization** — group devices (Living Room, Kitchen, Bedroom...)
- **Bulk room control** — turn off an entire room with one tap
- **Device types** — Bulb 💡, Fan 🌀, AC ❄️, TV 📺, Plug 🔌, Custom

### 📱 Cross-Platform Apps
- **React Web App** (React 18 + Vite + TypeScript) — fully responsive
- **React Native Mobile App** (Expo) — Android (iOS ready)
- **ESP32 Local Web Dashboard** — works even without internet (LAN-only mode)

### 👨‍👩‍👧‍👦 Family & Role Management
- **4-tier role system**: Owner → Admin → Member → Viewer
- **Invite codes** — share a code to add family members
- **Per-home permissions** — secure RBAC on every action
- **Multi-home support** — belong to multiple homes simultaneously

### ⏰ Smart Scheduling
- **4 schedule types**: Once, Daily, Weekly, Custom Cron
- **Background worker** — reliable 10-second tick engine
- **Schedule suggestions** by AI based on usage history

### 🤖 AI Assistant
- **Natural language device control**: "Turn off all fans in the living room"
- **Dual provider support**: OpenAI, Gemini, or local Ollama
- **Hinglish support**: works in English, Hindi, and Hinglish mix
- **Confirmation-first**: prevents accidental device changes
- **Auto-suggestions**: creates schedule recommendations from usage patterns

### 🔔 Smart Notifications
- **In-app bell** 🔔 with real-time badge updates
- **Email notifications** (SMTP): orders, shipping, device alerts, warranty
- **Power-cut batching**: 2+ devices offline → single summary notification (not spam)
- **Order lifecycle**: payment → factory test → shipped → delivered (all notified)

### 📊 Usage Analytics
- **Toggle frequency** chart (7/30/90 days)
- **Per-device on-time** tracking (ON→OFF event pairing)
- **Per-member activity** breakdown
- Div-based bar chart (zero new dependencies)

### 🛒 Complete E-Commerce Pipeline
- **Product catalog** — managed by admin (model, price, relay count, stock)
- **Shopping cart** — persistent across sessions
- **COD + UPI/Card** payment (Razorpay integrated)
- **Order management** — pending → paid → processing → shipped → delivered
- **Serial key distribution** — keys included in shipping notification
- **QR code stickers** — printed per device, with activation link

### 🔌 Voice Assistant Integration
- **Google Home** — Cloud-to-Cloud Smart Home (SYNC/QUERY/EXECUTE)
- **Alexa** — Smart Home Skill (Discovery, TurnOn/TurnOff, State Report)
- **Custom OAuth** — secure account linking flow

### 🔒 Security
- **JWT auth** with refresh token rotation (httpOnly cookies)
- **Hashed API keys** (SHA-256) for device access
- **Zero-trust serial console** — ESP32 serial port locked by password
- **RBAC** on every endpoint (requireRole middleware)
- **Audit log** — every admin action is tracked
- **Rate limiting** on all API endpoints
- **Zod validation** at the edge (no raw DB writes)

---

## 🔧 Hardware Platform

### ESP32 SwitchNest Boards
- **Models**: 1CH to 8CH relay (your choice of load control)
- **Dual connectivity**: MQTT (primary, <1s response) + HTTP (fallback)
- **Local web interface**: dashboard, WiFi config, OTA — works without internet
- **Voice-activated via Google/Alexa**
- **Built-in self-test**: each relay verified before leaving factory

### Factory-Proven Hardware Pipeline
1. **Flash firmware** → auto-download from server
2. **Provision** → WiFi, server, serial, model via serial commands
3. **Quality gate** → hotspot name/password verified vs sticker
4. **Relay self-test** → every channel verified
5. **Web server check** → confirms board is network-reachable
6. **Mark tested** → customer gets instant notification

### Over-the-Air Updates
- Admin pushes firmware to any board (single or full fleet at once)
- Automatic version check at boot
- Manual OTA via local web dashboard or Arduino OTA

### Zero-Trust Serial Security
- All serial commands require unlock password
- Password stored encrypted in NVS (flash storage)
- Remotely rotatable via MQTT from admin panel
- Prevents unauthorized physical access to the board

---

## 📈 Platform Observability

### In-App Health Monitor
- **30-second health checks** — API → DB → Socket → Scheduler → Firmware
- **Incident history** — timestamped outage log
- **Self-healing** — DB reconnect retry loop on connection loss

### Memory Leak Detection
- **Per-process RSS growth detection** — alert if RSS grows >20% in 4h
- **Memory trend chart** — 1h/6h/24h range with drag-zoom
- **False-positive safe** — only real heartbeat timestamps participate

### Structured Logging
- `app.log` — full structured application log
- `health-check.jsonl` — machine-readable health history
- `leak-incidents.jsonl` — documented leak events
- Admin Logs tab — live 300-line tail with CRASH/ERROR highlighting

### Deployment Observability
- Per-deployment commit tracking
- GitHub CI badge live in admin dashboard
- `synced / pending / lagging` deploy status card

---

## 🚀 What's Coming (Roadmap)

| Feature | Phase | Status |
|---|---|---|
| iOS App (App Store) | Phase 8b | Building |
| Courier live tracking (Shiprocket) | Phase 9 | Plan ready |
| Biometric login (fingerprint/FaceID) | Phase 10 | Planned |
| Offline mode (cached device states) | Phase 10 | Planned |
| Quick widgets (home screen) | Phase 10 | Planned |
| Push notifications (native) | Phase 10 | Planned |
| Multi-board linking (one device = multi-relay) | Phase 11 | Specced |
| Custom automation rules | Phase 11 | Planned |
| Energy monitoring integration | Future | Research |

---

## 📐 Technical Excellence

| Area | Detail |
|---|---|
| Backend | Node.js + Express + TypeScript — statically typed throughout |
| ORM | Prisma + MySQL 8 — full type-safe queries |
| Frontend | React 18 + Vite + TypeScript + Zustand |
| Mobile | Expo (React Native) + NativeWind |
| Firmware | ESP32 + PlatformIO + Arduino framework |
| Auth | JWT access + refresh rotation + httpOnly cookies |
| Realtime | Socket.IO with per-home isolated rooms |
| Validation | Zod everywhere (edge + DB layer) |
| Testing | Vitest unit tests (API + web) |
| CI/CD | GitHub Actions → Plesk webhook auto-deploy |
| Deploy target | IISNode (Plesk shared hosting) — unusual, battle-tested |
| Logging | Winston structured logging + audit trail |

---

## 💬 Testimonials / Use Cases

*[Placeholder — add real user quotes here as customers grow]*

- **Home automation**: Control all appliances from one app — web or mobile
- **Office automation**: Multiple admins, role-based access, scheduled shutdown
- **Rental properties**: Give guests temporary member access; revoke on checkout
- **Family home**: Kids = members, parents = owners; set rules via schedules

---

## 🔗 Links

| Resource | URL |
|---|---|
| Live App | `https://onlineswitch.bhartitechnical.com` |
| API Base | `https://onlineswitch.bhartitechnical.com/api` |
| Admin Panel | `https://onlineswitch.bhartitechnical.com/admin` |
| API Health | `/api/health` |
| Repo | `github.com/robosphere99/switch_v2` (private) |

---

*SwitchNest v2 — Built for real-world smart home deployment. Made in India. 🇮🇳*
