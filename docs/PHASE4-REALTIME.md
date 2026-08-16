# Phase 4 — Realtime (Socket.IO) Implementation Plan

> **Goal:** web app ko live banao — device toggle/status, offline/online, notifications,
> support chat push hote hi UI me aa jayein. Polling ko kill nahi, **fallback** bana do
> (reliability ke liye zyada zaroori hai).
>
> **Key decision:** ESP32 **polling 10s pe hi rakho** (firmware stable, deployed).
> Web app socket se live hoga; end-to-end toggle latency ESP32 ke poll interval se
> bound hai (~10s) — UI me instant "optimistic + pending" dikhega, `command:updated`
> se confirm hoga.

---

## 1. Current State (audit — codebase se)

### Backend — Socket.IO ALREADY scaffolded (90% wahi hai)
- `site/apps/api/src/lib/socket.ts` — server, **JWT auth middleware**, rooms:
  - `user:{userId}` — per-user (notifications, support)
  - `home:{homeId}` — per-home members; `system_admin` joins ALL homes
- Helpers: `emitToUser(userId, event, payload)`, `emitToHome(homeId, event, payload)`
- **Events already emitted** (sirf web sunta nahi!):
  | Event | Emitter | Payload |
  |---|---|---|
  | `device:updated` | device.service, deviceApi.service, familySafety.service, scheduler.service, offline.service | **inconsistent** — kabhi full device, kabhi sirf `{ id }` |
  | `esp:updated` | admin.routes, device.service, deviceApi.service, offline.service | `{ id, name?, offline?, ... }` |
  | `command:updated` | deviceApi.service | `{ id, status, executedAt }` |
  | `notification:new` | notification.service | full notification row |
  | `support:new` | support.routes | message |

### Web — socket client exists but KABHI connect nahi hota
- `site/apps/web/src/lib/socket.ts` — `getSocket()` / `disconnectSocket()` / `reconnectSocket()` defined, **kahin import nahi hota** (0 listeners).
- Dashboard polling (`pages/Dashboard.tsx`): devices `refetchInterval: 5_000`, homeDetail `10_000`, homes `30_000`, firmware `60_000`.
- Auth store (`stores/auth.ts`): access token only, refresh flow minimal — socket token-expiry reconnection wiring nahi hai.

---

## 2. Architecture Decisions

1. **Push → web app only.** ESP32 HTTP polling (10s) unchanged — no firmware churn, safest.
2. **One consistent envelope:** `device:updated` hamesha **full device row** (+ `online`, `lastSeen`, `updatedAt`) emit karo. Ek helper `emitDeviceUpdated(homeId, deviceId)` jo mutation ke baad device re-fetch karke uniform payload bheje. Stale-event guard ke liye payload me `updatedAt`.
3. **Cache invalidation-first, patch-second:**
   - v1: socket event → `queryClient.invalidateQueries([...])` (simple, always correct)
   - v1.1 (optional): `setQueryData` se instant patch + background invalidate
4. **Polling fallback hamesha:** devices 5s → **15-30s** (socket down pe bhi UI zinda), aur socket `reconnect` pe saare queries invalidate (catch-up — gap ke events recover).
5. **Event types shared package me:** `packages/shared` me `RealtimeEvents` map — api emit aur web listen dono type-checked.
6. **Auth expiry:** access token 15m → socket auth fail hote hi refresh + reconnect (existing `reconnectSocket()`).

---

## 3. Implementation Steps

### 3.1 Backend (api)

| # | Change | File |
|---|---|---|
| B1 | `emitDeviceUpdated(homeId, deviceId)` helper — device+esp re-fetch, uniform DTO, `updatedAt` | `lib/socket.ts` (extend) |
| B2 | Saare `device:updated` emits ko helper pe migrate karo (partial `{ id }` wale fix) | device.service, deviceApi.service, familySafety.service, scheduler.service, offline.service |
| B3 | Shared types: `RealtimeEvents` + `DeviceEventPayload` | `packages/shared/src/realtime.ts` |
| B4 | **Membership-change handling:** user ko home se remove/role-change pe uske sockets ko us home ke room se nikaalo ya disconnect (`home:access-revoked` emit + `socket.leave`) | member.service + socket.ts (add `leaveHomeRoom(userId, homeId)`) |
| B5 | Connection ack: connect pe `socket:ready` emit (web ko indicator ke liye) | socket.ts |

### 3.2 Web (web)

| # | Change | File |
|---|---|---|
| W1 | `useRealtime()` hook — mount pe connect, events map karo: `device:updated`/`esp:updated` → invalidate `["devices", homeId]`, `["homeDetail", homeId]`; `notification:new` → invalidate `["notifications"]` + unread; `support:new` → invalidate support queries; `command:updated` → invalidate devices (pending badge); `reconnect` → saare queries invalidate | `lib/realtime.ts` (new) |
| W2 | Hook ko **app root** pe mount (notification bell global) + logout pe `disconnectSocket()` | `main.tsx` / `App.tsx` |
| W3 | Dashboard polling relax: devices `5_000 → 15_000`, homeDetail `10_000 → 20_000`, homes `30_000` keep; socket connected ho to aur bhi lazy (30s) | `pages/Dashboard.tsx` |
| W4 | Toggle flow: optimistic status + "pending" UI, `command:updated` pe confirm (v1.1) | `pages/Dashboard.tsx` + device api client |
| W5 | NotificationBell: `notification:new` listener (global hook se callback) | `components/NotificationBell.tsx` |
| W6 | Auth refresh + `reconnectSocket()` wiring — token expiry pe socket dobara auth | `lib/realtime.ts` + `stores/auth.ts` |

### 3.3 Tests + Docs

- API: emitDeviceUpdated payload shape test (vitest).
- Web: useRealtime mapping test (fake socket client).
- `TESTING.md` me Phase 4 checklist add — **2 browsers/2 tabs test** (ek me toggle, doosre me <1s update), **server-restart test** (socket down → polling fallback → reconnect catch-up).

---

## 4. Event Flow (target state)

```
Web toggle ──REST──▶ device.service.setStatus
                        ├─ device_commands (pending) ──▶ ESP poll (10s) ──▶ executes
                        ├─ emitToHome("device:updated", {device...})   ──▶ all home members' UIs
                        └─ ESP POSTs result ──▶ deviceApi.service
                              ├─ device_commands → executed
                              └─ emitToHome("command:updated", {...}) ──▶ UI pending→done
Notification ──▶ emitToUser("notification:new") ──▶ bell + badge live
Offline detect ──▶ emitToHome("device:updated", {offline:true}) ──▶ dashboard grey
Support msg ──▶ emitToUser("support:new") ──▶ chat modal live
```

---

## 5. Edge Cases (yahi pe asli kaam hai)

1. **Server restart / socket down** — events gap ho jate hain → **polling fallback must stay** + `reconnect` pe full invalidate. Yehi #1 rule hai.
2. **Token expiry (15m)** — socket auth fail → refresh → reconnect → rooms re-join.
3. **Member removed / role changed mid-session** — socket abhi bhi home room me hai → `home:access-revoked` + `socket.leave()` (B4). Warna removed member ko devices dikhte rehte hain.
4. **Multi-tab** — har tab apna socket; broadcast semantics; koi special handling nahi.
5. **Races (double toggle)** — optimistic + server truth; payload `updatedAt` se stale event ignore karo (client-side check).
6. **ESP poll latency** — end-to-end ~10s max; UI instantly "pending" dikhata hai, isliye user ko lagega responsive. (Future: ESP poll 2-3s karne se <1s ho jayega bina firmware architecture change kiye.)
7. **Background tabs (iOS/browser throttle)** — websocket stall ho sakta hai; polling fallback + visibilitychange pe refetch.
8. **Admin panel** — admin ke sockets saare home rooms me hain (already); admin page pe bhi devices live update (v1.1: admin tab listen).

---

## 6. Rollout Order

1. B1–B3 (backend normalize + shared types) → typecheck
2. W1–W2 (useRealtime + app wiring) → dashboard live ho jata hai
3. W3 (polling relax) + W5 (notification bell)
4. B4, W6 (edge cases: membership, token refresh)
5. v1.1: W4 optimistic toggle + admin live
6. Tests + TESTING.md + live verify (2 tabs, server restart)

**Estimated scope:** ~8-10 files touched, no schema change, no firmware change.

---

## 7. Open Questions for Owner

- ESP32 poll interval: 10s rakhein (recommended) ya 2-3s karein (web lag <1s, ESP battery/bandwidth thoda zyada)?
- Optimistic toggle v1 me hi (instant UI, thoda race-handling) ya v1.1 me (safer)?
- Realtime indicator (navbar me "live" dot) chahiye?
