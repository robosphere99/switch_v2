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
  const { data } = await api.get<{ data: InstallStatus }>("/install/status");
  return data.data;
}

export interface RunInstallInput {
  db?: { host?: string; port?: number; user?: string; pass?: string; name?: string };
  admin?: { username?: string; email?: string; password?: string };
}

export async function runInstall(input: RunInstallInput) {
  const { data } = await api.post<{ data: { installed: boolean; database: string; admin: string } }>(
    "/install",
    input,
  );
  return data.data;
}
