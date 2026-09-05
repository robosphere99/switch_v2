# SwitchNest Backend Architecture

## Directory Structure

```
backend/api/src/
├── app.ts                  # Express app setup, middleware stack, route mounting
├── server.ts               # HTTP server entry point (port binding)
│
├── routes/                 # Route definitions ONLY — no business logic
│   ├── index.ts            # Aggregates all routers, exports apiRouter
│   ├── auth.routes.ts
│   ├── admin.routes.ts
│   ├── alexa.routes.ts
│   ├── apiKey.routes.ts
│   ├── assistant.routes.ts
│   ├── claim.routes.ts
│   ├── device.routes.ts
│   ├── deviceApi.routes.ts
│   ├── docs.routes.ts
│   ├── firmware.routes.ts
│   ├── google.routes.ts
│   ├── home.routes.ts
│   ├── install.routes.ts
│   ├── member.routes.ts
│   ├── notification.routes.ts
│   ├── oauth.routes.ts
│   ├── public.routes.ts
│   ├── room.routes.ts
│   ├── schedule.routes.ts
│   ├── shop.routes.ts
│   ├── support.routes.ts
│   ├── warranty.routes.ts
│   └── webhook.routes.ts
│
├── controllers/            # Request handlers — parse req, call service, send res
│   ├── admin.controller.ts
│   ├── alexa.controller.ts
│   ├── apiKey.controller.ts
│   ├── assistant.controller.ts
│   ├── auth.controller.ts
│   ├── call.controller.ts
│   ├── claim.controller.ts
│   ├── device.controller.ts
│   ├── deviceApi.controller.ts
│   ├── docs.controller.ts
│   ├── firmware.controller.ts
│   ├── google.controller.ts
│   ├── home.controller.ts
│   ├── install.controller.ts
│   ├── member.controller.ts
│   ├── notification.controller.ts
│   ├── oauth.controller.ts
│   ├── public.controller.ts
│   ├── room.controller.ts
│   ├── schedule.controller.ts
│   ├── shop.controller.ts
│   ├── support.controller.ts
│   ├── warranty.controller.ts
│   └── webhook.controller.ts
│
├── services/               # Business logic — DB queries, external API calls
│   ├── analytics.service.ts
│   ├── audit.service.ts
│   ├── auth.service.ts
│   ├── automation.service.ts
│   ├── device.service.ts
│   ├── deviceApi.service.ts
│   ├── firmware.service.ts
│   ├── notification.service.ts
│   ├── shop.service.ts
│   ├── siteSettings.service.ts
│   └── ...
│
├── middleware/             # Reusable Express middleware
│   ├── apiKey.ts           # requireApiKey — device-facing API auth
│   ├── auth.ts             # requireAuth — JWT verification
│   ├── errorHandler.ts     # Global error handler
│   ├── rateLimit.ts        # Per-route rate limiting
│   ├── requireRole.ts      # requireHomeMember role check
│   └── validate.ts         # validateBody / validateParams / validateQuery
│
├── models/                 # Prisma schema + generated client (see prisma/)
│
├── lib/                    # Shared utilities and singletons
│   ├── ai.ts
│   ├── billVerify.ts
│   ├── cloudinary.ts
│   ├── crypto.ts
│   ├── dbState.ts
│   ├── email.service.ts
│   ├── healthMonitor.ts
│   ├── lanIp.ts
│   ├── leakMonitor.ts
│   ├── logger.ts
│   ├── openapi.ts
│   ├── paths.ts
│   ├── prisma.ts
│   ├── requestTracker.ts
│   ├── response.ts         # ok() helper + AppError class
│   └── socket.ts
│
└── config/
    └── ...
```

## Architecture Rules

### Routes (`routes/*.routes.ts`)
Routes files MUST only:
1. Import and mount controllers
2. Define Zod validation schemas
3. Apply middleware in order (`requireAuth`, `validateBody`, etc.)
4. Call the appropriate controller function as the final handler

Routes files MUST NOT contain:
- Database queries (`prisma.*`)
- Business logic
- `async (req, res) =>` inline handlers (extract to controller)

**Good example:**
```ts
router.post("/login", loginLimiter, validateBody(loginSchema), authController.login);
router.get("/profile", requireAuth, authController.getProfile);
```

### Controllers (`controllers/*.controller.ts`)
Controllers MUST only:
1. Extract data from `req` (params, body, query, user)
2. Call service functions
3. Send the response via `ok(res, data)` or `res.json()`

Controllers MUST NOT:
- Contain complex business logic
- Make multiple unrelated DB queries (delegate to service)

### Services (`services/*.service.ts`)
Services contain all business logic:
- Prisma DB queries
- External API calls
- Complex transformations
- Event emissions (`emitToHome`, push notifications, audit logs)

### Middleware (`middleware/`)
| File | Purpose |
|---|---|
| `auth.ts` | JWT auth — attaches `req.user` |
| `apiKey.ts` | Hardware API key auth — attaches `req.apiKey` |
| `requireRole.ts` | Home role check (viewer / member / admin) |
| `validate.ts` | Zod schema validation for body/params/query |
| `rateLimit.ts` | Per-route sliding window rate limiter |
| `errorHandler.ts` | Global error → structured JSON response |

## Device API (ESP32 Hardware)

ESP32 boards authenticate using an **API key** (not JWT). The API key is scoped to a specific user's home. Flow:

```
ESP32 → GET /api/device/read-all?api_key=xxx  → deviceApiRouter
                                               → requireApiKey middleware
                                               → deviceApi.controller.ts
                                               → deviceApi.service.ts (business logic)
```

Long-poll for commands (v2 firmware):
```
ESP32 → GET /api/device/commands?api_key=xxx&long=1&hold=20
       → server holds response up to 20s until a command arrives
       → ok(res, { commands: [...] })
```

## Auth Flow

```
POST /api/auth/login → auth.routes.ts → auth.controller.ts → auth.service.ts
                                                            ↓
                                                    Returns { accessToken, refreshToken }

POST /api/auth/refresh → exchanges refreshToken for new accessToken
POST /api/auth/logout  → invalidates refreshToken + pushToken
```

## Deployment Notes

> [!CAUTION]
> **NEVER commit `web.config`** — Plesk IIS auto-generates it. See `site/.gitignore`.

> [!IMPORTANT]
> Build process: `npm run build:prod` → `tsc --noEmit` (0 errors) → commit `dist/` → Plesk pulls via webhook.
