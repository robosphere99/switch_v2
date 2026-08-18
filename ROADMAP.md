# 🗺️ RoboSphere — Rebuild Roadmap (v2)

> **Goal:** Rebuild RoboSphere from scratch as a **scalable, modular, multi-tenant** platform — moving from PHP to a modern **React + TypeScript** stack, **keeping MySQL** as the database. New code lives in a **separate folder + separate GitHub repo**, built fresh, with the PHP version kept as the reference/legacy.
>
> **Vision v2 (the big picture):** Real-life smart home platform —
> - 🏠 **One "Home" (ghar) per family.** Devices are bought/registered **in the home's name**, not an individual's.
> - 👨‍👩‍👧‍👦 **Family members** (wife, kids, parents) join the same home with **different roles/permissions**.
> - 🛡️ **Admin panel** to manage the whole platform (users, homes, devices, firmware).
> - 🔓 **Everyone controls the same devices**, but who can do *what* depends on their role.

---

## 1. Recommended Stack (proposal — confirm before building)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript** | User confirmed React; Vite = fast dev/build |
| UI | **Tailwind CSS** (or shadcn/ui components) | Rapid, consistent UI |
| State / data | **TanStack Query** + Zustand | Server state vs client state, clean separation |
| Routing | **React Router v6** | Standard |
| Backend | **Node.js + Express** (TypeScript) | Simple, typed; or **NestJS** if you want heavier structure later |
| Validation | **Zod** | One schema for API input *and* TypeScript types |
| Database | **MySQL 8** (kept!) | Your requirement |
| DB access | **Prisma** (or Knex) | Migrations + type-safe queries (Prisma's MySQL support is mature) |
| Realtime | **Socket.IO** (later phase) | Push device status instead of 5s/10s polling |
| Scheduler | **node-cron** (later phase) | Timers / schedules worker |
| Auth | **JWT access + refresh** for users, **API keys** for machines/ESP32 | Keeps the proven device-key model |
| Config | **dotenv + .env** | No more hardcoded credentials |
| Containers | **Docker Compose** (mysql + api + web) | One-command setup, same as XAMPP comfort |
| Tests | **Vitest** (unit) + **Supertest** (API) | From phase 1 |
| Lint/format | ESLint + Prettier | Code hygiene from day 1 |

---

## 2. The Multi-Tenant Model (the core of v2)

### 2.1 Who is who

```
┌────────────────────────────── SYSTEM LEVEL ──────────────────────────────┐
│  System Admin — platform operator. Manages users, homes, devices,       │
│  firmware, sees everything. (Admin Panel)                                │
└──────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────── HOME LEVEL ────────────────────────────────┐
│  🏠 Home (ghar) — the tenant. One per family. Owns the devices.          │
│                                                                          │
│  Owner  — person who bought/registered the home (creates it)             │
│   │      can do everything: manage members, transfer ownership,          │
│   │      delete home                                                      │
│   ├── Admin   — manage devices + members (no owner-only actions)         │
│   ├── Member  — control devices, make timers, add devices                │
│   └── Viewer  — can only see status, cannot control                      │
└──────────────────────────────────────────────────────────────────────────┘

Every device belongs to a Home. Family members control the home's devices
according to their role. A user can belong to MULTIPLE homes
(e.g., their own home + their parents' home).
```

### 2.2 Permission Matrix

| Action | System Admin | Owner | Home Admin | Member | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| Platform: users / homes / devices / firmware | ✅ | — | — | — | — |
| Create / delete home | — | ✅ | — | — | — |
| Transfer ownership | — | ✅ | — | — | — |
| Invite / remove members, assign roles | — | ✅ | ✅ | — | — |
| Add / remove devices, pair hardware | — | ✅ | ✅ | ✅ | — |
| Control devices (on/off) | — | ✅ | ✅ | ✅ | — |
| Create / edit timers | — | ✅ | ✅ | ✅ | — |
| View status / logs | ✅ | ✅ | ✅ | ✅ | ✅ |

> The **permission check lives in the backend** (middleware), never just in the UI. One shared function: `requireRole(homeId, ['owner','admin','member'])`.

### 2.3 Key Flows (real-life)

- **Sign up → create Home** → you become the **Owner**.
- **Invite family:** owner/admin sends an email invite (link) **or** shares a short **invite code** (e.g. `ROB7X2`, expires in 48h). Member joins with a chosen role.
- **Join request:** someone requests to join a home → owner approves.
- **Device purchase:** device has a unique **serial number** (e.g., ESP32 chip ID/MAC). It is registered **in the home's name** — `devices.home_id`.
- **Pairing:** new device shows a pairing code → owner enters it in the app → device binds to the home + room.
- **Moving house:** device can be **transferred** from one home to another.
- **Left the family?** Owner removes a member → their access is gone instantly.

---

## 3. New Repository Structure (modular monorepo)

```
robosphere-v2/                     ← NEW folder + NEW GitHub repo
├── apps/
│   ├── web/                       React + Vite + TS frontend
│   │   ├── src/
│   │   │   ├── pages/             Landing, Login, Signup, Dashboard, Home,
│   │   │   │                      Members, Invites, Profile, ApiKeys, Admin/*, …
│   │   │   ├── components/        Reusable UI (DeviceCard, Navbar, RoleBadge, …)
│   │   │   ├── features/          Feature modules (auth, homes, members,
│   │   │   │                      devices, timers, ai, logs, admin)
│   │   │   ├── api/               Typed API client (axios/fetch + react-query hooks)
│   │   │   ├── stores/            Zustand stores (current home, user, permissions)
│   │   │   └── types/             Shared TS types
│   │   └── ...
│   └── api/                       Node.js + Express + TS backend
│       ├── src/
│       │   ├── routes/            REST route definitions (thin)
│       │   ├── controllers/       Request handling, validation, responses
│       │   ├── services/          Business logic (auth, home, member, device,
│       │   │                      schedule, ai, admin)
│       │   ├── repositories/      DB access layer (Prisma)
│       │   ├── middleware/        auth, apiKey, requireRole, rateLimit, error, cors
│       │   ├── lib/               config, logger, db client, constants
│       │   └── jobs/              Cron workers (timers, OTA checks)
│       └── prisma/
│           ├── schema.prisma      Single source of truth for MySQL schema
│           └── migrations/        Versioned migrations
├── packages/
│   ├── shared/                    Shared TS types (User, Home, Role, Device, …)
│   └── iot-client/                Device SDK (what ESP32/Python clients call)
├── hardware/
│   └── firmware/                  ESP32 firmware + version.json + OTA .bin
├── docker-compose.yml             mysql + api + web
├── .env.example
├── README.md
└── docs/                          Roadmap, API docs (OpenAPI), setup guide
```

**Why monorepo:** one repo, one PR flow, shared types between API and web, easy to split later.

---

## 4. Architecture Principles

1. **Layered backend** — `routes → controllers → services → repositories`. Never touch SQL from a route.
2. **API-first** — everything the web app does is also available via the public API with API-key auth (devices, timers, logs, AI). ESP32 + future mobile apps use the same surface.
3. **Multi-tenant by design** — every query is scoped `WHERE home_id = ? AND user is a member`, enforced in the service layer, not forgotten.
4. **Permissions in the backend** — one `requireRole()` middleware; UI just hides buttons.
5. **One response envelope** — `{ success, data, error }` + proper HTTP status codes, everywhere.
6. **Validation at the edge** — Zod validates every request.
7. **Config via env** — no hardcoded host/creds/URLs.
8. **Migrations, not setup scripts** — schema changes are versioned Prisma migrations.
9. **Structured logging + audit** — `device_logs` + new `audit_logs` (who did what, when).
10. **Rate limiting + CORS whitelist** — real implementations.

---

## 5. Database Plan (MySQL — evolve, don't replace)

### Existing tables (upgraded)
| Table | Changes for v2 |
|---|---|
| `users` | + `role` (`user` / `system_admin`), + `status` (`active` / `suspended`), + `last_login_at` |
| `devices` | + `home_id` (device belongs to a **home**, not a person), + `serial_number` (pairing), + `created_by`, + `firmware_version`, + `last_seen`, + `room_id` |
| `api_keys` | Hash keys in DB (SHA-256), enforce `expires_at`, track `last_used_at`, scope to `user_id + home_id` |
| `device_commands` | Finally **used** — command queue: `pending → executed/failed`, + `actor_id` |
| `device_logs` | Finally **used** — every toggle/command/error, + `actor_id` (which family member did it) |
| `device_configurations` | Finally **used** — per-device settings (relay pin, pairing info, …) |

### New tables
| Table | Purpose |
|---|---|
| `homes` | The tenant: id, name, owner_id, status, max_devices, max_members, created_at |
| `home_members` | home_id + user_id + role (`owner/admin/member/viewer`) + joined_at — **unique (home_id, user_id)** |
| `invitations` | Pending invites: home_id, email, invite_code, role, status (`pending/accepted/expired`), expires_at |
| `rooms` | Grouping inside a home (Living Room, Bedroom, Kitchen, …) |
| `schedules` | Timers: device_id, action (on/off), type (`once/daily/weekly/cron`), run_at/cron, enabled, next_run, last_run, created_by |
| `notifications` | In-app alerts (device offline, schedule fired, invite received, …) |
| `refresh_tokens` / `sessions` | Secure JWT refresh rotation |
| `audit_logs` | Admin/platform-level audit trail (separate from device logs) |
| `assistant_chats` | AI assist conversations |
| `firmware_versions` | Track OTA versions (version, .bin url, release notes, current flag) |

> **Key change vs v1:** devices no longer belong to a user — they belong to a **Home**. Users get access through `home_members`.

---

## 6. Build Phases (in order — each phase = working, testable milestone)

### Phase 0 — Foundation
- Create `robosphere-v2` repo, Docker Compose (MySQL 8), ESLint/Prettier, CI (GitHub Actions: lint + typecheck + test)
- **Prisma schema from day 1 includes the full multi-tenant model** (homes, home_members, invitations, rooms + all existing tables upgraded) — even if the UI comes later
- `.env` config, structured logger, error handler, response envelope
- **Done when:** `docker compose up` → API boots, migrations run, health check passes.

### Phase 1 — Core API + Multi-Tenancy
- Auth: signup → auto-create Home (user becomes Owner), login/logout/refresh (JWT), profile + password change
- Homes: create/rename, get my homes, transfer ownership, delete home
- Members: invite (email link + invite code), join, approve join request, change role, remove member
- Devices: CRUD + toggle, **scoped to home + permission-checked everywhere** (fixes PHP bugs #1–#3)
- API keys: generate (hashed), list, revoke, expiry enforcement, home-scoped
- Public REST endpoints — **same paths/shape as PHP v1** so existing ESP32 firmware works with just a base-URL change
- `requireRole` middleware, rate limiting, CORS whitelist, validation, unit + API tests
- **Done when:** two family members can join a home, control its devices, and a viewer cannot toggle. All verified by tests.

### Phase 2 — React Web App
- Landing page (keep the dark theme + YouTube/Arduino sections), login/signup (create home), dashboard (device cards), members & invites page, profile, API key manager
- Home switcher (if a user belongs to multiple homes)
- TanStack Query caching, optimistic toggles
- **Done when:** web app does everything the PHP dashboard did **plus** family/member management.

### Phase 3 — Admin Panel (platform level)
- Admin-only routes + middleware (`users.role = system_admin`)
- **Overview:** platform stats (users, homes, devices, active today)
- **Users:** list/search, view detail, suspend/unsuspend, promote/demote admin
- **Homes:** list all homes, members, devices; suspend a home; view usage
- **Devices:** all devices across homes, firmware version, force OTA update
- **Firmware:** upload new `.bin`, set current version, release notes
- **Audit:** platform-wide logs viewer
- **Settings:** platform limits (max devices/members per home — the pricing hook later)
- **Done when:** an admin can run the whole platform without touching the DB.

### Phase 4 — Realtime + Command Pipeline
- WebSocket (Socket.IO) pushes device status → kill the 5s polling
- ESP32 keeps polling `read-all` (safe default) **or** moves to command queue (`device_commands` consumed via worker endpoint) — your call
- `device_commands` + `device_logs` now real: history UI, "who toggled it" via `actor_id`
- **Done when:** toggling updates the device in <1s, every action is logged with the actor.

### Phase 5 — Timers & Scheduling ⏰
- Create/edit/enable/disable schedules from UI + API (permission: member+)
- `node-cron` worker runs schedules → writes `device_commands` → updates `next_run`
- Types: once, daily, weekly, custom cron
- **Done when:** "Turn on living room bulb at 7am daily" works and survives restarts.

### Phase 6 — Rooms, Notifications & Analytics
- Rooms: assign devices, bulk on/off per room
- Device `last_seen` + offline detection → `notifications` (in-app; email later)
- Basic analytics from `device_logs` (on-time per device, toggles per day, per member)
- **Done when:** dashboard shows rooms, offline status, usage history.

### Phase 7 — AI Assist Mode 🤖 (design early, build here)
- Natural-language control: "turn off all fans" → parsed to actions (confirm → execute)
- Suggested automations from usage history ("you turn the light on at 7pm daily — create a schedule?")
- **Modular `ai` service** — one interface, swappable providers (OpenAI / Gemini / local via Ollama)
- Assistant chat history in `assistant_chats`
- **Done when:** a user chats with the platform and it actually controls devices (with confirmation).

### Phase 8 (optional) — Mobile App
- React Native / Expo app reusing the same API + shared types
- Push notifications for schedules/offline alerts

---

## 7. Migration Strategy (old → new)

1. **Run both in parallel** — PHP stays live until v2 reaches Phase 2/3 parity.
2. **Data migration:** export `switch` DB → import to v2; Prisma migration preserves rows; existing users become **owners of a new Home** (their devices move into it).
3. **Firmware:** existing ESP32 code needs only the base URL changed (`/onlineswitch/api` → new API URL) because v1 endpoint paths are kept identical.
4. **Cutover:** when web + API + hardware all work on v2, archive the PHP repo (read-only reference).

---

## 8. Quick Wins Carried Over From PHP

- ✅ Proven device-type enum (`bulb/fan/ac/tv/plug/custom`)
- ✅ API-key-per-user model (hash the keys this time, scope to home)
- ✅ Polling design for ESP32 as the safe default
- ✅ Dark blue gradient theme as the v2 design seed
- ✅ YouTube/Arduino-course marketing sections on the new landing page
- ✅ Python/Node client examples, updated to the new API

---

## 9. Open Questions for You (answer before Phase 0/1)

1. **Backend:** plain Express (simple) or NestJS (structured)? — suggestion: **Express**.
2. **Roles:** keep 4 (owner/admin/member/viewer) or drop viewer? — suggestion: keep 4, viewer is useful for kids/guests.
3. **Member + devices:** can regular members add devices, or only owner/admin? — suggestion: owner/admin only, members control.
4. **Invites:** email invite + invite code, or code only (simpler)? — suggestion: both.
5. **Device serial:** use ESP32 chip ID/MAC as the serial for pairing? — suggestion: yes.
6. **ESP32 comms:** keep polling or command queue? — suggestion: polling first, queue in Phase 4.
7. **AI provider:** OpenAI / Gemini / local (Ollama)? — decide at Phase 7, adapter interface designed now.
8. **Repo name:** `robosphere-v2` or something fresh?

---

## 10. Status

- [x] Analysis of current project → `PROJECT_ANALYSIS.md`
- [x] Rebuild roadmap drafted, **multi-tenant (homes + family + admin) model added** (this file)
- [x] **Phase 0 + Phase 1 scaffold DONE** (this repo):
  - Monorepo `site/` (apps/api + apps/web + packages/shared), Docker Compose, CI
  - Prisma multi-tenant schema migrated to MySQL (`switch_v2`) — 16 tables
  - Auth (signup → auto home + owner, login, refresh rotation, logout) ✅ verified
  - Homes, members, invitations (invite codes), `requireRole` permissions ✅ verified
  - Devices CRUD + status (writes `device_commands` + `device_logs`) ✅ verified
  - API keys (hashed, scoped) + admin routes scaffold
  - Web app scaffold (Vite + React + TS + Tailwind): landing, login, signup, dashboard, family page
- [x] **Phase 2 — Web app DONE** — Dashboard (devices CRUD + rooms + ONLINE badges + logs + filters), Family (invite codes, roles, join), Device Keys (create/copy/revoke), Homes (create/rename/transfer), Profile, admin links; verified in browser
- [x] **Phase 3 — Admin panel DONE** — stats, users (role/delete), homes (suspend/delete), all devices (online status), api-keys, audit logs viewer; `audit_logs` ab actually write hote hain har action pe
- [x] **Phase 5 — Timers & Scheduler DONE** ⏰ — Schedule CRUD API (`once/daily/weekly/cron` + custom 5-field cron), background worker (10s tick) fires due schedules → writes `device_commands` → ESP32 executes → audit log; UI on Dashboard verified (create → next-run compute → list → enable/disable → delete)
- [x] **Phase 4 — Realtime DONE** 🔌 — Socket.IO (auth, rooms, `socket:ready` ack), uniform `device:updated` DTO (shared types), web `useRealtime` hook (invalidate/access-revoked/reconnect), polling relaxed (15s/20s), live <2s updates verified
- [x] **Phase 6 — Analytics + Email DONE** — Rooms ✅ · offline → notifications ✅ · usage analytics ✅ (API + Dashboard) · **email channel ✅** (order placed/paid/shipped/delivered, warranty submit/status, device/board offline+online — SMTP configured ho to, nahi to silent skip)
- [x] **Phase 7 — AI Assist DONE (hybrid)** — rule-based intent parser (EN/HI) ✅ (pehle se) · **real LLM adapter ✅** (OpenAI-compatible: OpenAI/Gemini/Ollama — `AI_PROVIDER/AI_API_KEY/AI_BASE_URL/AI_MODEL` env se; conversational replies LLM se, device control hamesha confirm-gated) · **automation suggestions ✅** (usage patterns → daily schedule suggestions, API `GET /api/homes/:homeId/automations/suggestions` + Assistant page pe ek-click create) · suggested automations from usage history ✅
- [ ] Phase 8 (mobile app)

> **Current state:** `site/` runs locally — API on :4000, web on :5173 (XAMPP MySQL, db `switch_v2`). ESP32 (COM8, `192.168.1.36`) v2 firmware pe live connected — web toggle → command queue → physical relay loop verified.

> **Next action:** Phase 7 me AI ko asli provider se hook karo (site/.env me `AI_PROVIDER` + `AI_API_KEY` + `AI_MODEL` set karo) — bina config ke rule-based chalta hai. Uske baad: Phase 8 (mobile app), second ESP32 setup, OTA infra.
