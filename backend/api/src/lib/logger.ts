import { env } from "../config/env";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Directory candidates for log files
const logDirCandidates = [
  path.resolve(process.cwd(), "logs"),          // backend/api/logs
  path.resolve(process.cwd(), "../logs"),       // site/logs
  path.resolve(process.cwd(), "../../logs"),    // root/logs
  path.join(os.tmpdir(), "switchnest-logs"),
];

let activeLogDir: string | null = null;
for (const dir of logDirCandidates) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    activeLogDir = dir;
    break;
  } catch {
    continue;
  }
}

export const logFilePath: string | null = activeLogDir ? path.join(activeLogDir, "app.log") : null;
export const crashFilePath: string | null = activeLogDir ? path.join(activeLogDir, "crash.log") : null;

/** Raw line file me likho (app.log). Fail ho to silent. */
export function fileLog(line: string): void {
  if (!logFilePath) return;
  try {
    const timestamped = /^\[\d{4}-\d{2}-\d{2}T/.test(line) ? line : `[${new Date().toISOString()}] ${line}`;
    fs.appendFileSync(logFilePath, timestamped.endsWith("\n") ? timestamped : timestamped + "\n");
  } catch {
    /* ignore */
  }
}

/** Dedicated Crash Logger — full diagnostic trace to crash.log */
export function recordCrash(title: string, err: unknown, context?: Record<string, unknown>): void {
  const now = new Date().toISOString();
  const stack = err instanceof Error ? err.stack || err.message : String(err);
  const mem = process.memoryUsage();
  const memMb = {
    rss: (mem.rss / 1024 / 1024).toFixed(1) + " MB",
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1) + " MB",
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1) + " MB",
  };

  const banner = [
    `\n================================================================================`,
    `💥 [${title}] at ${now}`,
    `Error: ${err instanceof Error ? err.message : String(err)}`,
    `Stack:\n${stack}`,
    `Memory: RSS=${memMb.rss} | HeapUsed=${memMb.heapUsed} | HeapTotal=${memMb.heapTotal}`,
    `Node: ${process.version} | Platform: ${process.platform} | Uptime: ${Math.floor(process.uptime())}s`,
    context ? `Context: ${JSON.stringify(context, null, 2)}` : "",
    `================================================================================\n`,
  ].filter(Boolean).join("\n");

  console.error(banner);
  fileLog(`[CRASH] ${title}: ${stack}`);

  if (crashFilePath) {
    try {
      fs.appendFileSync(crashFilePath, banner);
    } catch {
      /* ignore */
    }
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
  crash: (title: string, err: unknown, context?: Record<string, unknown>) => recordCrash(title, err, context),
};

export function getCrashLogs(tailLines = 100): string {
  if (!crashFilePath || !fs.existsSync(crashFilePath)) return "No crash logs recorded yet.";
  try {
    const content = fs.readFileSync(crashFilePath, "utf8");
    const lines = content.trim().split("\n");
    return lines.slice(-tailLines).join("\n");
  } catch (e: any) {
    return `Error reading crash logs: ${e?.message}`;
  }
}

export function getAppLogs(tailLines = 100): string {
  if (!logFilePath || !fs.existsSync(logFilePath)) return "No app logs recorded yet.";
  try {
    const content = fs.readFileSync(logFilePath, "utf8");
    const lines = content.trim().split("\n");
    return lines.slice(-tailLines).join("\n");
  } catch (e: any) {
    return `Error reading app logs: ${e?.message}`;
  }
}
