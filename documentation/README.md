# 📚 SwitchNest — Documentation Index

Welcome to the comprehensive documentation for the **SwitchNest v2** smart home IoT platform.

> **Project:** SwitchNest (formerly RoboSphere)
> **Live:** [onlineswitch.bhartitechnical.com](https://onlineswitch.bhartitechnical.com)
> **Stack:** React + Node.js + ESP32 + MySQL + Prisma

---

## 📖 Document List

| # | Document | Description |
|---|---|---|
| 1 | [API Documentation](./1-API-DOCUMENTATION.md) | Full REST API reference — all 120+ endpoints, auth, realtime, DB schema |
| 2 | [Hardware Documentation](./2-HARDWARE-DOCUMENTATION.md) | ESP32 firmware architecture, pin layout, MQTT, serial commands, OTA |
| 3 | [Mobile App Documentation](./3-MOBILE-APP-DOCUMENTATION.md) | React Native app — screens, navigation, realtime, e-commerce, setup |
| 4 | [Git Log & History](./4-GIT-LOG-HISTORY.md) | Commit history, phase timeline, branching strategy, CI/CD |
| 5 | [Flasher GUI Documentation](./5-FLASHER-GUI-DOCUMENTATION.md) | Factory provisioning tool — complete step-by-step guide |
| 6 | [Admin Features](./6-ADMIN-FEATURES-DOCUMENTATION.md) | Admin panel — all 12 tabs, order flow, monitoring, troubleshooting |
| 7 | [User Features](./7-USER-FEATURES-DOCUMENTATION.md) | End-user guide — devices, schedules, family, shop, AI assistant |
| 8 | [Features for Promotion](./8-FEATURES-PROMOTION.md) | Publicity document — all completed features, tech stack, roadmap |
| 9 | [Project Status Report](./9-PROJECT-STATUS-REPORT.md) | Executive summary, phase completion, metrics, architecture diagram |

---

## 🌐 Quick Reference

| Component | Tech | Location |
|---|---|---|
| Backend API | Express + TypeScript | `site/apps/api/` |
| Web App | React 18 + Vite | `site/apps/web/` |
| Mobile App | Expo + React Native | `site/apps/mobile/` |
| ESP32 Firmware | PlatformIO + C++ | `hardware/Robosphere-Dev/` |
| Factory Tool | Python + Tkinter | `tools/flasher/flasher_gui.py` |
| Database | MySQL 8 via Prisma | `site/apps/api/prisma/schema.prisma` |

---

## 📡 Key Endpoints

| Resource | URL |
|---|---|
| Health check | `GET /api/health` |
| Login | `POST /api/auth/login` |
| All devices | `GET /api/homes/:homeId/devices` |
| Toggle device | `POST /api/homes/:homeId/devices/:id/toggle` |
| Admin stats | `GET /api/admin/stats` |
| ESP32 state | `MQTT sn/{MAC}/state` |
| ESP32 commands | `MQTT sn/{MAC}/cmd` |

---

## ⚡ Local Dev Quick Start

```bash
cd site
npm install
npm run db:generate
npm run db:migrate
npm run dev:api          # Terminal 1 → API :4000
npm run dev:web          # Terminal 2 → Web :5173
```

---

*Generated: August 2026 | SwitchNest v2 | All phases complete*
