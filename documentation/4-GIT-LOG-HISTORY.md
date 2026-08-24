# 📜 SwitchNest — Git Commit Log & Project History

> **Repository:** `robosphere99/switch_v2` (private)
> **Branch strategy:** `dev` (development) → `main` (production auto-deploy)
> **Total commits:** 280+ | **Started:** Early 2026 | **Stack:** React + Node.js + ESP32

---

## 🏛️ Project Timeline (Phase by Phase)

### Phase 0 — Foundation (Early 2026)
| Commit | Description |
|---|---|
| Initial | PHP v1 analyzed → PROJECT_ANALYSIS.md |
| Scaffold | Monorepo setup (site/apps/api + web + shared) |
| Schema | Prisma multi-tenant schema (16 tables) |
| Docker | Docker Compose (MySQL 8 + api + web) |
| CI | GitHub Actions (lint + typecheck + test) |

### Phase 1 — Core API (Early 2026)
| Area | What was built |
|---|---|
| Auth | Signup → auto-create Home + Owner, login/refresh/logout |
| Homes | CRUD + transfer ownership |
| Members | Invite codes, role management, requireRole middleware |
| Devices | CRUD + toggle (writes to device_commands + device_logs) |
| API Keys | Hashed device keys (SHA-256), scoped |

### Phase 2 — Web App (2026)
| Area | What was built |
|---|---|
| Landing | Dark theme landing page (YouTube + Arduino course sections) |
| Dashboard | Device cards, rooms, ONLINE badges, logs, filters |
| Family | Invite codes, roles, join flow |
| Profile | Edit profile, change password |
| API Keys | Create/copy/revoke from UI |

### Phase 3 — Admin Panel (2026)
| Area | What was built |
|---|---|
| Stats | Platform metrics (users, homes, revenue, boards online) |
| Users | List, suspend, promote/demote, delete |
| Homes | List all, suspend, delete |
| Devices | Platform-wide view, clear commands, OTA push |
| Audit | audit_logs written on every action |

### Phase 4 — Realtime (2026)
| Commit area | What was built |
|---|---|
| Socket.IO | Auth, per-home rooms, socket:ready ack |
| Events | Uniform device:updated DTO (12 emit points migrated) |
| Web hook | useRealtime hook (invalidate/access-revoked/reconnect) |
| Polling | Relaxed to 15s/20s (was 5s), <2s live updates verified |

### Phase 5 — Timers (2026)
| Area | What was built |
|---|---|
| Schedule API | CRUD — once/daily/weekly/cron + custom 5-field cron |
| Worker | 10s background tick fires due schedules → device_commands |
| UI | Dashboard schedule modal (create/list/enable/disable) |

### Phase 6 — Rooms, Notifications, Analytics (2026)
| Area | What was built |
|---|---|
| Rooms | Grouping + bulk on/off per room |
| Notifications | In-app bell 🔔 + realtime notification:new |
| Offline detection | Boards 2+ min offline → notification + email |
| Analytics | Usage API (toggles/day, per-device on-time, per-member) |
| Email | SMTP email for orders, warranty, device alerts (silent skip if unconfigured) |
| Offline batching | Power-cut summary (2+ devices offline → 1 summary notification) |

### Phase 7 — AI Assist (2026)
| Area | What was built |
|---|---|
| Rule-based | Intent parser (EN/HI) — device control without LLM |
| LLM adapter | OpenAI/Gemini/Ollama swappable (AI_PROVIDER env) |
| Confirmations | All device control requires user confirmation |
| Suggestions | Usage pattern → daily schedule suggestions |
| Chat history | assistant_chats table |

### Phase 8 — Mobile App (Aug 2026)
| Area | What was built |
|---|---|
| Expo scaffold | React Native + NativeWind + Zustand + Axios |
| Auth | Login/signup/token refresh |
| Dashboard | Device cards + real-time toggle |
| Family | Members + invite codes |
| Shop | Products, cart, checkout |
| Razorpay | WebView-based payment (native SDK → web redirect) |
| Profile | Full profile edit (avatar, DOB, phone) |
| Notifications | Push notification setup |
| Orders | Order history + detail + tracking placeholder |

### Phase 9 — Voice Assistants (2026)
| Area | What was built |
|---|---|
| OAuth 2.0 | Custom auth-code flow for external account linking |
| Google Home | Cloud-to-cloud Smart Home (SYNC/QUERY/EXECUTE/Report State) |
| Alexa | Smart Home Skill (Discovery, TurnOn/TurnOff, State Report) |
| DB | integration_connections table |
| Frontend | Settings UI for linking accounts |

---

## 🛡️ Zero-Trust Security & Hardware Optimization (Aug 2026)

| Commit | Date | Description |
|---|---|---|
| feat: IoT Transport Modernization | 2026-08-24 | MQTT primary channel, HTTP fallback, rate limiting, vertical grid UI |
| feat: Zero-Trust serial security | 2026-08-24 | Console password lock, rotate_console_pass via MQTT |
| feat: MQTT bandwidth optimization | 2026-08-24 | Heavy telemetry at boot only, relay states on change |
| feat: info serial command | 2026-08-24 | Quick diagnostic dump without network round-trip |
| feat: Dynamic device name mapping | 2026-08-24 | Backend pushes device names to ESP32 via MQTT |
| fix: BoardManager relay count | 2026-08-24 | Fixed 4CH boards showing wrong relay count |
| fix: ApiManager MQTT priority | 2026-08-24 | MQTT not blocked by HTTP backoff |

---

## 🏭 E-Commerce & Factory Flow (Aug 2026)

| Commit | Date | Description |
|---|---|---|
| feat: Factory provisioning flow | 2026-08-18 | Order→flash→sticker→delivery factory pipeline |
| feat: Bill print | 2026-08-18 | PrintBill.tsx — invoice with serial codes |
| feat: Hotspot verify | 2026-08-18 | AP SSID/pass quality gate in Flasher |
| feat: Relay self-test | 2026-08-18 | Each relay verified before marking tested |
| feat: Web server check | 2026-08-18 | Flasher HTTP-pings board's LAN IP |
| feat: Serial monitor | 2026-08-18 | Real-time boot log viewer in Flasher GUI |
| feat: Order fulfilment decoupling | 2026-08-21 | COD orders — process ≠ pay |
| feat: Courier tracking UI | 2026-08-21 | My Orders detail panel + placeholder tracking |
| feat: Razorpay integration | 2026-08-22 | UPI/card payment for web + mobile |

---

## 🐛 Production Fixes & Observability (Aug 2026)

| Commit | Date | Description |
|---|---|---|
| fix: leak monitor false positive | 2026-08-23 | Fixed +27% RSS alert bug (stale PID timestamps) |
| fix: Admin password ↔ .env sync | 2026-08-23 | Password change auto-updates ADMIN_PASSWORD in .env |
| fix: duplicate API instances | 2026-08-23 | fix-api-instances.bat — keeps exactly 1 API process |
| fix: 503 crash loop | 2026-08-24 | nodeProcessCountPerApplication=1 + DB probe retry |
| fix: ESM/CJS Plesk crash | 2026-08-24 | IISNode CJS/ESM bootstrap collision resolved |
| build: prebuilt dist committed | Ongoing | Plesk can't run esbuild — dist/ is committed to git |

---

## 📅 Recent Commits (Last 20)

| Hash | Date | Summary |
|---|---|---|
| `d4973eb` | 2026-08-24 | fix(api): drop type module to appease iisnode legacy parsing |
| `14ed77c` | 2026-08-24 | fix(api): use cjs extension for IISProxy alias |
| `5c17b88` | 2026-08-24 | chore: save final state |
| `19e8fbd` | 2026-08-24 | fix(ci): disable tests — unblock critical production hotfix |
| `591d28a` | 2026-08-24 | fix(api): Force iisnode route to app.js Alias |
| `c493fe3` | 2026-08-24 | fix(api): brutal string replace bypass for plesk ESM collision |
| `08510ed` | 2026-08-24 | fix(api): expose patch script for plesk GUI |
| `b7826f8` | 2026-08-24 | fix(api): bypass plesk .bootstrap.cjs ESM crash loop |
| `444929f` | 2026-08-24 | build: dump web.config in diag array |
| `9251945` | 2026-08-24 | fix(api): alias entrypoints for plesk IISNode fallbacks |
| `1a235cb` | 2026-08-24 | fix(api): allow string named pipes for IISNode in zod schema |
| `41b7a41` | 2026-08-24 | fix(api): inject ESM createRequire polyfill for aedes |
| `f72139f` | 2026-08-24 | build: add active boot invocation to diag script |
| `2ac5bce` | 2026-08-24 | build: instrument diag script with iisnode crash log extraction |
| `ae667fd` | 2026-08-24 | build: compile plesk artifacts for MQTT + UI enhancements |
| `13cfca1` | 2026-08-24 | feat: IoT Transport Modernization, Vertical Grid UI, Rate-Limiting |
| `b5a65dd` | 2026-08-22 | fix(mobile): babel syntax error with template literals in profile |
| `d4a63d6` | 2026-08-22 | feat(profile): User profile expansion with avatar, dob, mobile edit modal |
| `0813bb0` | 2026-08-22 | feat: Mobile device management, room creation, edit device modals |
| `e7415c8` | 2026-08-22 | feat(commerce): integrate Razorpay checkout for Web and Mobile |

---

## 🌿 Branch Strategy

```
main  ←── (auto-deploy to Plesk production via GitHub webhook)
  ↑ merge
dev   ←── (active development, CI only — lint + typecheck + tests)
```

**Rules:**
- All development happens on `dev`
- `git push origin dev` → CI checks (no deploy)
- `git merge dev main && git push origin main` → Plesk auto-deploys production
- `dist/` folders are **pre-built and committed** (Plesk can't run esbuild/vite)

---

## 🔁 CI/CD (GitHub Actions)

| Workflow | Triggers | Steps |
|---|---|---|
| CI | Push to `dev` | Lint + TypeCheck + Vitest tests |
| CD | Push to `main` | Merge only — Plesk webhook deploys |

**GitHub Actions badge:** In Admin → Overview → Deploy Info card.

---

## 🗄️ Database Migrations

All DB changes use **Prisma migrations** (`prisma/migrations/`).

```bash
# Generate Prisma client after schema change
npm run db:generate

# Apply pending migrations
npm run db:migrate

# View current schema
npx prisma studio
```

> ⚠️ Never apply schema changes directly to production DB without review.
> Production DB changes: local verify → migration file commit → deploy → `prisma migrate deploy` on server.

---

*Last updated: 2026-08-25 | Total commits: 280+ | Active branch: main*
