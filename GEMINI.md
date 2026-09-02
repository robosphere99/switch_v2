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
3. Commit prebuilt artifacts (`dist/index.mjs`) and push to `origin/main`.
4. Plesk pulls changes via Webhook automatically.
