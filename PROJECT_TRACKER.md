# SwitchNest Project Tracker

## 1. Project Overview
**Purpose:** SwitchNest is a multi-tenant smart home IoT platform (Switch_v2).
**Frontend:** React (Web), React Native Expo (Mobile).
**Backend:** Node.js, Express, Prisma (MySQL).
**Database:** MySQL.
**Important Integrations:** Cloudinary (Media), Jitsi (WebRTC Support Calls).

## 2. Current Architecture
```
switch_v2/
├── frontend/
│   ├── web/
│   └── mobile/
├── backend/
│   └── api/
│       ├── src/
│       │   ├── app/
│       │   ├── config/
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── services/
│       │   ├── models/
│       │   ├── middleware/
│       │   ├── validators/
│       │   ├── utils/
│       │   └── types/
│       └── uploads/
├── packages/
│   └── shared/
├── scripts/
├── tools/
├── documentation/
├── hardware/
├── mobile-app/
└── PROJECT_TRACKER.md
```

## 3. Architecture Rules
- Frontend belongs under `frontend/`
- Backend belongs under `backend/`
- Backend follows MVC. Routes define endpoints, Controllers handle request/response coordination, Services contain business logic, Models represent persistent data, Middleware handles request-level concerns, Configuration belongs in `config/`.
- Scripts belong in `scripts/`
- Tools belong in `tools/`
- Documentation belongs in `documentation/`
- Runtime uploads are not source code and stay in `backend/api/uploads/`.
- Secrets must never be committed.

## 4. Current Tasks
- `[~]` Restructure monolithic `site/` folder into isolated frontend/backend.
- `[ ]` Update `package.json` workspaces.
- `[ ]` Test build and imports.

## 5. Completed Work

*(No completed architectural restructuring yet)*

## 6. Architecture Decisions
- **ADR-001 — Simple MVC Backend:** Backend uses a simple MVC-oriented architecture inside `backend/api/src/` to make the backend easier to understand and maintain.

## 7. Known Issues
*(None logged yet)*

## 8. Technical Debt
*(None logged yet)*

## 9. Deployment
**Build:** `npm run build` from root.
**Plesk Configuration:** Requires deploying `deploy.cmd` inside `scripts/`, updating Plesk deployment hooks to point to `scripts/deploy.cmd` and `backend/api/` as root.
**Environment Variable NAMES:**
`DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `JITSI_DOMAIN`, `JITSI_APP_ID`, `JITSI_API_KEY`, `JITSI_PRIVATE_KEY`.

## 10. Environment Variables
- `DATABASE_URL`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASS`
- `DB_NAME`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `JITSI_DOMAIN`
- `JITSI_APP_ID`
- `JITSI_API_KEY`
- `JITSI_PRIVATE_KEY`

## 11. Important Commands
- `npm run dev`
- `npm run build`
- `npm run typecheck`

## 12. Change Log
- 2026-09-04: Created PROJECT_TRACKER.md.
