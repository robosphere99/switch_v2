#!/bin/bash
# ============================================================
#  SwitchNest — PM2 One-Time Server Setup
#  Plesk Terminal ya SSH se run karo (root / admin):
#    bash deploy-setup.sh
# ============================================================
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "📁 App dir: $APP_DIR"

# ── 1. Install PM2 globally (skip if already installed) ──
if ! command -v pm2 &>/dev/null; then
  echo "📦 Installing PM2..."
  npm install -g pm2
else
  echo "✅ PM2 already installed: $(pm2 -v)"
fi

# ── 2. Create logs dir ──
mkdir -p logs

# ── 3. Stop old processes (if any) ──
pm2 delete switchnest-api 2>/dev/null || true

# ── 4. Install deps (if needed) ──
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm ci --production
fi

# ── 5. Generate Prisma client ──
echo "🔧 Generating Prisma client..."
npx prisma generate --schema=apps/api/prisma/schema.prisma

# ── 6. Start with PM2 ──
echo "🚀 Starting app with PM2..."
pm2 start ecosystem.config.cjs

# ── 7. Save PM2 process list + auto-start on boot ──
echo "💾 Saving PM2 process list..."
pm2 save

# ── 8. Setup startup script (auto-start on server reboot) ──
echo "⚡ Setting up PM2 startup (auto-start on reboot)..."
pm2 startup 2>/dev/null || {
  echo "⚠️  pm2 startup needs sudo. Run manually:"
  echo "   sudo pm2 startup systemd -u $(whoami) --hp $(echo ~)"
}

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ SwitchNest API running under PM2"
echo ""
echo "  📊 Status:      pm2 status"
echo "  📜 Logs:        pm2 logs switchnest-api"
echo "  🔄 Restart:     pm2 restart switchnest-api"
echo "  🛑 Stop:        pm2 stop switchnest-api"
echo ""
echo "  Auto-restart ON — crash hone pe 3s me wapas start"
echo "  Memory limit: 512MB — leak hone pe restart"
echo "  Exponential backoff — baar baar crash pe delay badhta hai"
echo "═══════════════════════════════════════════════════"
