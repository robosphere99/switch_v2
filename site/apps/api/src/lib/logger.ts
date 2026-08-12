import { env } from "../config/env";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level: Level, msg: string, meta?: unknown) {
  if (ORDER[level] < ORDER[env.LOG_LEVEL]) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
  if (meta !== undefined) {
    const suffix = typeof meta === "string" ? meta : JSON.stringify(meta);
    if (level === "error") console.error(line, suffix);
    else console.log(line, suffix);
  } else if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
};
