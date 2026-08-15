import { env } from "../config/env";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// App khud apna log file likhta hai — Plesk pe cwd = site/apps/api hota hai,
// aur site/apps/logs (iisnode ka log folder) writable prove ho chuka hai.
// Pehli writable jagah me app.log banta hai — koi bhi jagah permission na
// mile to sirf console pe log hota hai (crash nahi).
export const logFilePath: string | null = (() => {
  const candidates = [
    path.resolve(process.cwd(), "../logs"), // site/apps/logs — iisnode yahi likhta hai (writable)
    path.resolve(process.cwd(), "logs"),    // site/apps/api/logs
    path.join(os.tmpdir(), "switchnest-logs"),
  ];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return path.join(dir, "app.log");
    } catch {
      continue; // permission nahi — agla candidate
    }
  }
  return null;
})();

/** Raw line file me likho (boot/crashguard ke liye). Fail ho to silent. */
export function fileLog(line: string): void {
  if (!logFilePath) return;
  try {
    fs.appendFileSync(logFilePath, line.endsWith("\n") ? line : line + "\n");
  } catch {
    /* ignore */
  }
}
type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level: Level, msg: string, meta?: unknown) {
  if (ORDER[level] < ORDER[env.LOG_LEVEL]) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
  if (meta !== undefined) {
    const suffix = typeof meta === "string" ? meta : JSON.stringify(meta);
    fileLog(`${line} ${suffix}`);
    if (level === "error") console.error(line, suffix);
    else console.log(line, suffix);
  } else {
    fileLog(line);
    if (level === "error") console.error(line);
    else console.log(line);
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
};
