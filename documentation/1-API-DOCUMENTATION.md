# 🌐 SwitchNest — REST API Documentation

> **Base URL (Local):** `http://localhost:4000/api`
> **Base URL (Production):** `https://onlineswitch.bhartitechnical.com/api`
> **Response format:** All endpoints return `{ success: boolean, data?: any, error?: { message: string, code: string } }`

---

## 🔒 Authentication

### JWT Auth (Web App / Mobile)
Include in request header:
```
Authorization: Bearer <access_token>
```

### API Key Auth (ESP32 / Devices)
Include in request header:
```
x-api-key: <api_key>
```

### Token Lifecycle
- **Access token**: short-lived (expires fast)
- **Refresh token**: long-lived, stored in httpOnly cookie
- Use `POST /api/auth/refresh` to get a new access token

---

## 📌 Public Endpoints

### `GET /api/health`
Server health check. No auth required.
```json
{ "status": "ok", "uptime": 12345, "ts": "2026-08-24T00:00:00Z" }
```

### `POST /api/auth/signup`
Register a new user. Auto-creates a Home for the user (they become the Owner).
```json
// Request body
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
// Response: { success, data: { user, accessToken, home } }
```

### `POST /api/auth/login`
Login with username or email.
```json
// Request body
{ "usernameEmail": "johndoe", "password": "SecurePass123!" }
// Response: { success, data: { user, accessToken } } + httpOnly refresh cookie
```

### `POST /api/auth/logout`
Invalidate refresh token and clear cookie.

### `POST /api/auth/refresh`
Exchange refresh cookie for a new access token.

### `POST /api/auth/request-reset`
Request a password reset email.

### `POST /api/auth/reset-password`
Reset password via token from email.

---

## 👤 User / Profile

All require JWT auth.

### `GET /api/auth/me`
Get current user's profile.

### `PUT /api/auth/me`
Update profile (username, email, display name, avatar URL, DOB, phone).

### `PUT /api/auth/me/password`
Change password (requires current password).

---

## 🏠 Homes

All require JWT auth.

### `GET /api/homes`
Get all homes the current user is a member of.

### `POST /api/homes`
Create a new home (user becomes Owner).
```json
{ "name": "My Smart Home" }
```

### `GET /api/homes/:homeId`
Get single home details.

### `PUT /api/homes/:homeId`
Rename a home. (Owner/Admin only)

### `DELETE /api/homes/:homeId`
Delete a home and all its devices. (Owner only)

### `POST /api/homes/:homeId/transfer`
Transfer ownership to another member. (Owner only)

### `GET /api/homes/:homeId/analytics/usage`
Get usage analytics for the home.
```
Query: ?days=7|30|90
```

---

## 👨‍👩‍👧‍👦 Members & Invitations

### `GET /api/homes/:homeId/members`
List all members of a home.

### `DELETE /api/homes/:homeId/members/:userId`
Remove a member from a home.

### `PATCH /api/homes/:homeId/members/:userId/role`
Change a member's role (owner/admin/member/viewer).

### `POST /api/homes/:homeId/invitations`
Invite someone to join a home (generates invite code).

### `GET /api/homes/:homeId/invitations`
List active invitations.

### `DELETE /api/homes/:homeId/invitations/:invitationId`
Cancel an invitation.

### `POST /api/claim`
Accept an invitation using an invite code.
```json
{ "code": "ROB7X2" }
```

---

## 💡 Devices (User-facing)

### `GET /api/homes/:homeId/devices`
List all devices in a home (including room, online status).

### `POST /api/homes/:homeId/devices`
Add a new virtual device.
```json
{ "name": "Living Room Light", "type": "bulb", "roomId": 1 }
```

### `PUT /api/homes/:homeId/devices/:deviceId`
Update device (name, room, type).

### `DELETE /api/homes/:homeId/devices/:deviceId`
Delete a device.

### `POST /api/homes/:homeId/devices/:deviceId/toggle`
Toggle device on or off (writes to `device_commands`).

### `GET /api/homes/:homeId/devices/:deviceId/logs`
Get device activity log.

---

## 🏷️ Rooms

### `GET /api/homes/:homeId/rooms`
List rooms in a home.

### `POST /api/homes/:homeId/rooms`
Create a room.

### `PUT /api/homes/:homeId/rooms/:roomId`
Update room name.

### `DELETE /api/homes/:homeId/rooms/:roomId`
Delete a room (devices move to unassigned).

### `POST /api/homes/:homeId/rooms/:roomId/devices/bulk-toggle`
Bulk on/off for all devices in a room.

---

## ⏰ Schedules (Timers)

### `GET /api/homes/:homeId/schedules`
List all schedules.

### `POST /api/homes/:homeId/schedules`
Create a schedule.
```json
{
  "deviceId": 1,
  "name": "Morning Routine",
  "action": "on",
  "type": "daily",
  "runAt": "07:00"
}
```
Types: `once`, `daily`, `weekly`, `cron`

### `PUT /api/homes/:homeId/schedules/:scheduleId`
Update a schedule.

### `DELETE /api/homes/:homeId/schedules/:scheduleId`
Delete a schedule.

### `PATCH /api/homes/:homeId/schedules/:scheduleId/toggle`
Enable or disable a schedule.

---

## 🔔 Notifications

### `GET /api/notifications`
Get current user's notifications.

### `PATCH /api/notifications/:notificationId/read`
Mark a notification as read.

### `PATCH /api/notifications/read-all`
Mark all notifications as read.

---

## 🔑 API Keys (Device Keys)

### `GET /api/api-keys`
List the user's API keys.

### `POST /api/api-keys`
Generate a new API key.
```json
{ "label": "ESP32 Living Room Board" }
```

### `DELETE /api/api-keys/:keyId`
Revoke an API key.

---

## 🤖 AI Assistant

### `POST /api/homes/:homeId/assistant`
Chat with the AI assistant (natural-language device control).
```json
{ "message": "Turn off all fans in the living room" }
```

### `GET /api/homes/:homeId/automations/suggestions`
Get automation suggestions based on usage patterns.

### `POST /api/homes/:homeId/automations/suggestions/:suggestionId/create`
Create a schedule from a suggestion.

---

## 🛒 Shop / E-Commerce (User-facing)

### `GET /api/shop/products`
List available products.

### `POST /api/shop/cart`
Add item to cart.

### `GET /api/shop/cart`
Get current cart.

### `POST /api/shop/orders`
Place an order (COD or UPI/Razorpay).

### `GET /api/shop/orders`
Get user's order history.

### `GET /api/shop/orders/:orderId`
Get order details.

### `POST /api/shop/checkout/razorpay`
Initialize Razorpay payment for an order.

### `POST /api/webhook/razorpay`
Razorpay webhook (signature-verified payment confirmation).

---

## 📱 Device API (ESP32 Hardware)

All use `x-api-key` header.

### `GET /api/read-all`
Get all device statuses (what the ESP32 polls every ~10s).
```json
{
  "devices": [
    { "id": 1, "status": "on", "channel": 1 },
    { "id": 2, "status": "off", "channel": 2 }
  ]
}
```

### `POST /api/heartbeat`
ESP32 sends heartbeat (IP, firmware version, online status).
```json
{
  "mac": "AABBCCDDEEFF",
  "ip": "192.168.1.36",
  "firmware": "v2.1.0",
  "rssi": -65
}
```

### `POST /api/device/update`
ESP32 reports when a relay state changes (physical switch press).
```json
{ "deviceId": 1, "status": "on" }
```

---

## 🛡️ Admin API (System Admin Only)

All require JWT + `role === "system_admin"`.

### Overview & Stats
| Endpoint | Description |
|---|---|
| `GET /api/admin/stats` | Platform stats (users, homes, devices, revenue, online boards) |
| `GET /api/admin/logs` | System logs (last 300 lines of app.log) |
| `GET /api/admin/diagnostics` | Boot diagnostics, process info, memory trend |

### User Management
| Endpoint | Description |
|---|---|
| `GET /api/admin/users` | List all users |
| `PATCH /api/admin/users/:id/role` | Promote/demote to system_admin |
| `PATCH /api/admin/users/:id/status` | Suspend/activate user |
| `DELETE /api/admin/users/:id` | Delete user (full data remove) |
| `POST /api/admin/users/:id/message` | Send admin message to user |

### Home Management
| Endpoint | Description |
|---|---|
| `GET /api/admin/homes` | List all homes |
| `PATCH /api/admin/homes/:id/status` | Suspend/activate a home |
| `DELETE /api/admin/homes/:id` | Delete a home |

### Device & ESP Management
| Endpoint | Description |
|---|---|
| `GET /api/admin/devices` | All devices across all homes |
| `GET /api/admin/esp` | ESP board fleet |
| `POST /api/admin/esp/:id/push-ota` | Push OTA to a single board |
| `POST /api/admin/esp/push-ota-all` | Push OTA to all boards |
| `POST /api/admin/esp/:id/issue-key` | Issue new API key for a board |
| `GET /api/admin/esp/:id/probe` | HTTP probe the board's web server |
| `PATCH /api/admin/esp/:mac/rotate-console-password` | Rotate the serial console password |

### Orders & Factory
| Endpoint | Description |
|---|---|
| `GET /api/admin/orders` | All orders |
| `PATCH /api/admin/orders/:id/status` | Change order status |
| `GET /api/admin/orders/:id/provision` | Get provision data for Flasher |
| `POST /api/admin/orders/:id/serials/generate` | Generate serial codes |
| `POST /api/admin/orders/:id/process` | Trigger order processing (COD) |
| `GET /api/admin/orders/:id` | Full order details (for bill print) |
| `POST /api/admin/serials/:id/mark-tested` | Mark serial as factory tested |
| `GET /api/admin/serials` | All serial codes |

### Firmware
| Endpoint | Description |
|---|---|
| `GET /api/admin/firmware` | List firmware versions |
| `POST /api/admin/firmware` | Upload new firmware .bin (multipart) |
| `POST /api/admin/firmware/:id/activate` | Set firmware as current |
| `GET /firmware/:filename` | Download firmware binary (served statically) |

### API Keys
| Endpoint | Description |
|---|---|
| `GET /api/admin/api-keys` | List all device API keys |
| `POST /api/admin/api-keys` | Create API key for a user |
| `DELETE /api/admin/api-keys/:id` | Delete an API key |

### Audit & Support
| Endpoint | Description |
|---|---|
| `GET /api/admin/audit` | Audit log (all admin actions) |
| `GET /api/admin/support` | All support messages |
| `POST /api/admin/support/:id/reply` | Reply to a support message |
| `PATCH /api/admin/support/:id/status` | Mark resolved |

### Settings
| Endpoint | Description |
|---|---|
| `GET /api/admin/settings` | Get platform settings |
| `PUT /api/admin/settings` | Update site name, SMTP, AI config |
| `POST /api/admin/settings/test-email` | Send a test email |
| `POST /api/admin/settings/test-ai` | Test AI provider connection |

---

## 🔌 Realtime (Socket.IO)

Connect to: `wss://localhost:4000` (or production domain)

**Auth:** Send `Authorization` header on connection.

| Event | Direction | Description |
|---|---|---|
| `socket:ready` | Server → Client | Connection acknowledgment |
| `device:updated` | Server → Client | Device state/status change |
| `notification:new` | Server → Client | New in-app notification |
| `home:member-added` | Server → Client | Member joined/role changed |
| `home:member-removed` | Server → Client | Member left/removed |
| `access:revoked` | Server → Client | User's access removed — force logout |

---

## 🗄️ Database Schema Overview (MySQL via Prisma)

| Table | Purpose |
|---|---|
| `users` | User accounts (JWT auth, profile) |
| `homes` | Multi-tenant home containers |
| `home_members` | User↔Home membership + role |
| `invitations` | Invite codes (48h expiry) |
| `devices` | Virtual devices (bulb, fan, etc.) |
| `rooms` | Device groupings within a home |
| `device_commands` | Command queue (pending → executed) |
| `device_logs` | Activity log for every device action |
| `api_keys` | Hashed device API keys |
| `schedules` | Timers (once/daily/weekly/cron) |
| `notifications` | In-app user notifications |
| `refresh_tokens` | JWT refresh token rotation |
| `audit_logs` | Platform-level admin audit trail |
| `assistant_chats` | AI conversation history |
| `firmware_versions` | OTA firmware version tracking |
| `esp_devices` | ESP32 board registry (MAC, IP, serial) |
| `serial_registry` | Factory serial codes |
| `orders` | E-commerce orders |
| `order_items` | Items within orders |
| `products` | Product catalog |
| `support_messages` | User support/contact threads |
| `warranty_claims` | Warranty submissions |

---

*Last updated: 2026-08-25 | SwitchNest v2 — `onlineswitch.bhartitechnical.com`*
