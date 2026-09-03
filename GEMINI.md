# AGENT STRICT RULES & STABILITY GUIDELINES

## CRITICAL DEPLOYMENT RULES (PLESK / IIS)

### 🚨 RULE #1: NEVER TOUCH `web.config`
- **DO NOT** create, edit, modify, add, or commit any `web.config` file anywhere in the repository (`/web.config`, `site/web.config`, `site/apps/api/web.config`).
- **REASON**: Plesk's IIS extension auto-generates its own native `web.config` on the server. Adding custom `web.config` files into Git causes duplicate key conflicts (`iisnode`), HTTP 500 crashes, and URL rewrite loop failures (404).
- **ENFORCEMENT**: `web.config` is added to `site/.gitignore`. Git must NEVER track `web.config`.

### 🚨 RULE #2: NO TRIAL-AND-ERROR CONFIGURATION CHANGES
- **DO NOT** make speculative changes to server configs or Express route wrappers without verifying against full empirical stack traces.
- If a route returns 404/500, trace the exact path in `app.ts` and inspect Plesk stderr logs (`devErrorsEnabled` / `app.log`) before making any code modifications.

### 🚨 RULE #3: STABLE DEPLOYMENT WORKFLOW
1. Build code locally (`npm run build:prod` in `site/apps/api`).
2. Verify with `tsc --noEmit` to ensure 0 type errors.
3. Commit prebuilt artifacts (`dist/index.mjs`, `dist/index.cjs`, `index.html`, `assets`) and push to `origin/main`.
4. Plesk pulls changes via Webhook automatically.

---

## COMPREHENSIVE ERROR REGISTRY & RESOLUTION LOG

| ID | Error Message / Symptom | File & Line | Root Cause | Verified Resolution | Preventive Rule |
|---|---|---|---|---|---|
| **E001** | `Cannot find module 'vitest'` during `npm run build` | [tsconfig.json](file:///c:/Users/robos/OneDrive/Documents/SwitchNest/site/apps/api/tsconfig.json#L14-L16) | `tsc` checked `.test.ts` files which required `vitest` (devDependency not on prod). | Added `"exclude": ["**/*.test.ts", "src/tests"]` and `@robosphere/shared` path alias in `tsconfig.json`. | Exclude test files from production type-checking. |
| **E002** | `SecurityError: Failed to read 'localStorage'` | [safeStorage.ts](file:///c:/Users/robos/OneDrive/Documents/SwitchNest/site/apps/web/src/lib/safeStorage.ts) | Modern browsers (Brave Shields / 3rd-party cookie block) throw `SecurityError` on `localStorage`. | Created `safeStorage` in-memory `Map` fallback across Zustand stores (`auth`, `cart`) and theme. | Use `safeStorage` for all browser storage access. |
| **E003** | `HTTP 500.19 Duplicate handler key 'iisnode'` | `web.config` | Adding `<handlers><add name="iisnode".../></handlers>` conflicted with Plesk master IIS config. | Removed `web.config` from Git and added `web.config` to `site/.gitignore`. | Never commit `web.config` into Git repository. |
| **E004** | `TypeError: Missing parameter name at index 6: /api/*` | [app.ts](file:///c:/Users/robos/OneDrive/Documents/SwitchNest/site/apps/api/src/app.ts#L125) | Express 5 (`v5.1.0`) `path-to-regexp` throws on un-named `*` wildcards in string routes. | Replaced `app.use(["/api", "/api/*"], ...)` with standard `app.use("/api", ...)`. | Use `app.use("/prefix", ...)` without `*` wildcards in Express 5. |
| **E005** | `ReferenceError: publicRouter is not defined` | [app.ts](file:///c:/Users/robos/OneDrive/Documents/SwitchNest/site/apps/api/src/app.ts#L12) | `publicRouter` was referenced in middleware but missing from top-level imports. | Added `import { publicRouter } from "./routes/public.routes";` at top of `app.ts`. | Verify all referenced symbols are imported at top of file. |
| **E006** | `ReferenceError: require is not defined in ES module scope` | [package.json](file:///c:/Users/robos/OneDrive/Documents/SwitchNest/site/apps/api/package.json#L17) | `package.json` has `"type": "module"`, so Node.js treated `dist/index.js` (CJS) as ESM where `require` is invalid. | Added `esbuild` target for `dist/index.cjs` (explicit CommonJS extension). | CommonJS bundles must use `.cjs` extension when `"type": "module"`. |
| **E007** | `TypeError: Missing parameter name at index 11: /dashboard*` | [app.ts](file:///c:/Users/robos/OneDrive/Documents/SwitchNest/site/apps/api/src/app.ts#L198) | Wildcard string routes like `/dashboard*` fail in Express 5 `path-to-regexp`. | Replaced with `app.use(["/dashboard", "/admin", "/shop"], sendSpaHtml)`. | Use `app.use` prefix matching for sub-path SPA handlers. |
