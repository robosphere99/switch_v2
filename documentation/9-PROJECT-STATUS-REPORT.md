# 📋 SwitchNest — Project Status Report

> **Date:** August 2026
> **Version:** v2.0 (Production)
> **Project:** SwitchNest Smart Home IoT Platform
> **Owner:** Robosphere99
> **Status:** ✅ Production-ready, actively shipping hardware

---

## 🎯 Executive Summary

SwitchNest is a **full-stack, production-deployed smart home IoT platform** combining a React/Node.js web app, React Native mobile app, ESP32 embedded firmware, and a complete factory-to-customer hardware delivery pipeline.

The platform started as a PHP proof-of-concept ("RoboSphere v1") and has been completely rebuilt from scratch over ~9 months as a modern multi-tenant TypeScript monorepo with real hardware (ESP32 relay boards) shipping to customers.

**As of August 2026**, all 9 planned phases have been completed, with the platform serving real users and actively shipping hardware orders.

---

## ✅ Completed Phases

| Phase | Name | Status | Key Deliverables |
|---|---|---|---|
| 0 | Foundation | ✅ Done | Monorepo, Prisma schema (21 tables), Docker, CI/CD |
| 1 | Core API | ✅ Done | Auth (JWT), Homes, Members, Devices, API Keys |
| 2 | Web App | ✅ Done | React SPA — dashboard, family, profile, device keys |
| 3 | Admin Panel | ✅ Done | Stats, user mgmt, audit log, device fleet |
| 4 | Realtime | ✅ Done | Socket.IO — <1s device updates |
| 5 | Timers | ✅ Done | Schedule engine (once/daily/weekly/cron) |
| 6 | Rooms/Notifications/Analytics | ✅ Done | Rooms, bulk control, email, offline alerts, analytics |
| 7 | AI Assist | ✅ Done | Rule-based + LLM (OpenAI/Gemini/Ollama), suggestions |
| 8 | Mobile App | ✅ Done | Expo React Native — all features |
| 9 | Voice Assistants | ✅ Done | Google Home + Alexa Smart Home integration |
| — | Hardware Security | ✅ Done | Zero-trust serial console, MQTT password rotation |
| — | MQTT Transport | ✅ Done | Primary MQTT channel, HTTP fallback, bandwidth optimization |
| — | E-Commerce | ✅ Done | Shop, cart, Razorpay, orders, factory pipeline |
| — | Observability | ✅ Done | Leak monitor, health checker, memory chart, deploy info |

---

## 🏗️ Architecture Overview

*   **📱 Frontend Clients:** 
    *   **Web App**: React 18, Vite, TailwindCSS (Port *:5173*)
    *   **Mobile App**: React Native, Expo, NativeWind (iOS/Android)
*   **⚙️ Backend Services:**
    *   **REST API**: Node.js, Express, Zod (Port *:4000*)
    *   **MQTT Broker**: Aedes (Embedded in Node.js on Port *:1883*)
*   **🗄️ Database:**
    *   **Primary DB**: MySQL 8, Prisma ORM (21 Tables, Full RBAC audit trail)
*   **🔌 ESP32 Firmware:**
    *   **Core**: C++, PlatformIO, Arduino, FreeRTOS
    *   **Connectivity**: MQTT (Primary) + HTTP Long-Polling (Fallback)
    *   **Highlights**: Local Web Dashboard, OTA Updates, Zero-Trust Serial Console

---

## 📊 Platform Metrics (As of August 2026)

| Metric | Value |
|---|---|
| Total lines of code | ~50,000+ TS/JS/C++ |
| Git commits | 280+ |
| Database tables | 21 |
| API endpoints | 120+ |
| ESP32 firmware managers | 15 subsystems |
| Screens (web) | 20+ pages |
| Screens (mobile) | 15+ screens |
| Admin panel tabs | 12 |
| Supported board models | 5 (1CH/2CH/4CH/6CH/8CH) |

---

## 🚀 Current Deployment State

| Component | Status | URL |
|---|---|---|
| Production API | ✅ Live | `onlineswitch.bhartitechnical.com/api` |
| Production Web | ✅ Live | `onlineswitch.bhartitechnical.com` |
| Mobile App | ✅ Built + testable | Expo / APK build |
| Local Dev | ✅ Running | API :4000, Web :5173 |
| MySQL DB | ✅ Live | `switchnest` database |
| MQTT Broker | ✅ Embedded in API | Port 1883 |
| ESP32 Fleet | ✅ One board live | COM8 / 192.168.1.36 |

---

## 🛡️ Security Posture

| Area | Implementation |
|---|---|
| User auth | JWT access + refresh rotation (httpOnly cookies) |
| Device auth | SHA-256 hashed API keys |
| Serial console | Zero-trust password lock (NVS-stored, MQTT-rotatable) |
| Permissions | RBAC (requireRole middleware) on every endpoint |
| Audit trail | audit_logs table — every admin action tracked |
| Rate limiting | Custom middleware on all endpoint groups |
| Input validation | Zod schemas at API edge (no raw DB writes) |
| Password hashing | bcrypt (cost factor configurable) |
| Secrets | .env gitignored; admin password auto-syncs |

---

## ⚡ Performance Highlights

| Feature | Benchmark |
|---|---|
| Device toggle latency | < 1 second (MQTT) |
| HTTP fallback polling | ~10 second cycle |
| Socket.IO disconnect recovery | Auto-reconnect + query invalidation |
| MQTT telemetry | Sent only at boot/reconnect (bandwidth optimized) |
| API heartbeat | 10-second tick with ts/uptime/rss/heap |
| Health check | 30-second full-chain probe |
| Polling relaxed | From 5s → 15-20s (90% reduction in HTTP noise) |

---

## 🐛 Known Issues / Technical Debt

| Issue | Severity | Notes |
|---|---|---|
| iOS App not yet on App Store | Medium | Android is primary; iOS build ready but needs Apple dev account |
| Courier tracking is placeholder | Low | Shiprocket integration plan ready (COURIER-TRACKING-PLAN.md) |
| MQTT name cache lost on power cycle | Low | Server repushes on reconnect; acceptable |
| ESP32 NVS relay names not persisted | Low | Intentional — avoids write wear |
| IISNode ESM/CJS tension | Fixed | Resolved via CJS bootstrap alias |
| Leak monitor needed PID dedup | Fixed | File-level dedup + boot adoption guard implemented |
| Duplicate API instances risk | Mitigated | fix-api-instances.bat + startup guard in start-api.bat |

---

## 🗺️ Roadmap (What Comes Next)

### Immediate (Next Milestone)
- [ ] iOS App Store submission
- [ ] Courier live tracking (Shiprocket AWB + webhook)

### Short-term
- [ ] Push notifications via Expo Push Service (native — not just in-app)
- [ ] Biometric login (fingerprint / FaceID)
- [ ] Offline mode with cached device states

### Medium-term
- [ ] Home screen widgets for quick device control
- [ ] Custom automation rules (if-then logic, not just schedules)
- [ ] Multi-board device binding (one logical device → multiple relays)
- [ ] Data migration from PHP v1 (existing users)

### Long-term
- [ ] Energy monitoring integration (smart plugs with power sensing)
- [ ] Community-contributed device types
- [ ] White-label / OEM customization mode
- [ ] International expansion (multi-currency, multi-language)

---

## 📁 Repository Structure

```
SwitchNest/
├── site/                      Monorepo (web + api + mobile + shared)
│   ├── apps/api/             Express + TypeScript backend
│   │   ├── src/routes/       23 route files (120+ endpoints)
│   │   ├── src/services/     Business logic services
│   │   ├── src/lib/          Logger, socket, MQTT, health, leak monitor
│   │   └── prisma/           Schema (21 tables) + migrations
│   ├── apps/web/             React 18 + Vite frontend
│   │   ├── src/pages/        20+ pages (Dashboard, Admin, Family...)
│   │   ├── src/components/   Reusable UI components
│   │   └── src/api/          API client layer
│   ├── apps/mobile/          Expo React Native app
│   │   ├── App.tsx           Root navigation + auth guard
│   │   └── src/              API, components, stores, hooks
│   └── packages/shared/      Shared TypeScript types
├── hardware/
│   ├── Robosphere-Dev/       PlatformIO ESP32 firmware
│   │   ├── src/              Main + 15 manager subsystems
│   │   └── include/          Header files
│   └── firmware/             Built .bin files (served by API)
├── tools/
│   ├── flasher/              Factory provisioning tool
│   │   └── flasher_gui.py    Tkinter GUI app
│   └── fix-api-instances.ps1 Duplicate process cleanup
├── docs/                     Project documentation
│   ├── SwitchNest-Project-Context.md
│   ├── FACTORY-FLOW-V2.md
│   ├── ADMIN-GUIDE.md
│   └── ...
├── documentation/            THIS FOLDER — Comprehensive docs for publicity
│   ├── 1-API-DOCUMENTATION.md
│   ├── 2-HARDWARE-DOCUMENTATION.md
│   ├── 3-MOBILE-APP-DOCUMENTATION.md
│   ├── 4-GIT-LOG-HISTORY.md
│   ├── 5-FLASHER-GUI-DOCUMENTATION.md
│   ├── 6-ADMIN-FEATURES-DOCUMENTATION.md
│   ├── 7-USER-FEATURES-DOCUMENTATION.md
│   ├── 8-FEATURES-PROMOTION.md
│   ├── 9-PROJECT-STATUS-REPORT.md
│   └── README.md             Documentation index
├── README.md                 Project quick-start guide
├── ROADMAP.md                Phase plan
└── START_GUIDE.md            Full local setup guide
```

---

## 🔄 Development Workflow

```
1. Local dev (localhost:4000 + localhost:5173 + XAMPP MySQL)
2. Test thoroughly on local + physical hardware (ESP32)
3. git commit → push to dev → CI checks (lint + typecheck + tests)
4. merge dev → main → push → Plesk webhook auto-deploys production
5. Monitor: Admin → Logs tab → health checker + memory trend
```

### Key Rules
- **dist/ is committed** (Plesk can't build — pre-build locally)
- **One API process** only (`nodeProcessCountPerApplication=1`)
- **No schema changes** to production without review
- **Firmware bin** → commit to `hardware/firmware/` for API to serve
- **Secrets in .env** — never committed

---

## 👥 Team

| Role | Description |
|---|---|
| Owner / Full-Stack Developer | System architecture, all coding |
| Factory Operator | Uses Flasher GUI for provisioning |
| (Future) Hardware Technician | Assembly + quality check |

---

*Report generated: August 2026 | SwitchNest v2 | Ready for public launch.*
