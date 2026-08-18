#!/bin/bash
# ============================================================
#  SwitchNest — Webhook Deploy Script
#  Webhook trigger pe git pull + restart.
#  Plesk webhook command me set karo:
#    bash /path/to/site/deploy-restart.sh
# ============================================================
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 Deploy triggered"

# ── 1. Git pull ──
echo "📥 Pulling latest code..."
git pull origin main

# ── 2. Install deps (if lockfile changed) ──
if [ -f "package-lock.json" ]; then
  echo "📦 Installing dependencies..."
  npm ci --production 2>/dev/null || npm install --production
fi

# ── 3. Generate Prisma client ──
echo "🔧 Prisma generate..."
npx prisma generate --schema=apps/api/prisma/schema.prisma 2>/dev/null || true

# ── 4. Copy web build to api dist (for serving frontend) ──
if [ -d "apps/web/dist" ]; then
  echo "📋 Syncing web build..."
  cp -r apps/web/dist/* apps/api/public/ 2>/dev/null || true
fi

# ── 5. Restart via PM2 ──
if command -v pm2 &>/dev/null; then
  echo "🚀 Restarting via PM2..."
  pm2 restart switchnest-api --update-env
  echo "✅ PM2 restart done"
else
  echo "⚠️  PM2 not found — manual restart needed"
  echo "   Run: bash deploy-setup.sh"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Deploy complete"
