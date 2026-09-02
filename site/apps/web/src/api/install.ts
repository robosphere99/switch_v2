import { api } from "./client";

export interface InstallStatus {
  installed: boolean;
  dbReachable: boolean;
  tablesReady: boolean;
  dbConfigured: boolean;
  db: { host: string; port: number; user: string; name: string };
  admin: { username: string; email: string; passwordSet: boolean };
}

export async function getInstallStatus(): Promise<InstallStatus> {
  try {
    const { data } = await api.get<{ data: InstallStatus }>("/install/status");
    if (data?.data) return data.data;
  } catch (_err) {
    /* ignore and use optimistic installed fallback below */
  }
  return {
    installed: false,
    dbReachable: false,
    tablesReady: false,
    dbConfigured: false,
    db: { host: "127.0.0.1", port: 3306, user: "switch_v2", name: "switch_v2" },
    admin: { username: "admin", email: "admin@switchnest.in", passwordSet: false },
  };
}

export interface DbInput {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  name?: string;
}

export interface AdminInput {
  username?: string;
  name?: string;
  email?: string;
  password?: string;
}

/** Step 1 — DB connection test + database create. */
export async function testInstallDb(db: DbInput) {
  const { data } = await api.post<{
    data: { connected: boolean; serverVersion: string; database: string; dbCreated: boolean; tablesReady: boolean };
  }>("/install/connect", { db });
  return data.data;
}

/** Step 2 — tables banao. */
export async function createInstallSchema(db: DbInput) {
  const { data } = await api.post<{
    data: { tablesReady: boolean; installed: boolean; database: string; message: string };
  }>("/install/schema", { db });
  return data.data;
}

/** Step 3 — admin account + setup complete. */
export async function completeInstallAdmin(db: DbInput, admin: AdminInput) {
  const { data } = await api.post<{
    data: { installed: boolean; database: string; admin: string; configPersisted: boolean; configPath: string };
  }>("/install/admin", { db, admin });
  return data.data;
}

/** Backward-compatible single-shot install. */
export async function runInstall(input: { db?: DbInput; admin?: AdminInput }) {
  const { data } = await api.post<{ data: { installed: boolean; database: string; admin: string } }>(
    "/install",
    input,
  );
  return data.data;
}
