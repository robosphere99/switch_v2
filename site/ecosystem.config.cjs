// PM2 Ecosystem Config — auto-restart on crash + memory limit
// Usage: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "switchnest-api",
      script: "tsx",
      args: "src/index.ts",
      cwd: __dirname + "/apps/api",
      interpreter: "node",

      // ── Auto-restart on crash ──
      autorestart: true,              // restart on exit/crash
      watch: false,
      max_restarts: 50,               // max restarts in window
      min_uptime: "5s",               // app must run 5s to be "started"
      restart_delay: 3000,            // 3s delay between restarts
      exp_backoff_restart_delay: 100, // exponential backoff: 100ms → 200ms → 400ms → ...

      // ── Memory — restart if leak ──
      max_memory_restart: "512M",

      // ── Env ──
      env: {
        NODE_ENV: "production",
      },

      // ── Logs ──
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/api-error.log",
      out_file: "logs/api-out.log",
      merge_logs: true,

      // ── Graceful restart ──
      kill_timeout: 5000,
      listen_timeout: 10000,

      // ── Stability ──
      increment_restart: true,        // backoff on repeated crashes
    },
  ],
};
