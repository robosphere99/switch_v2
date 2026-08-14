import { useEffect, useState } from "react";
import { getInstallStatus, runInstall, type InstallStatus } from "../api/install";

const inputCls =
  "w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-white outline-none focus:border-brand";

const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400";

/**
 * First-run installation wizard — jab DB/tables nahi hain to app ke bajaye
 * yeh page dikhta hai. User bas DB + admin details type karta hai, baaki
 * sab (tables, admin, installed flag) API khud karta hai.
 */
export function Install() {
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [dbHost, setDbHost] = useState("localhost");
  const [dbPort, setDbPort] = useState("3306");
  const [dbUser, setDbUser] = useState("root");
  const [dbPass, setDbPass] = useState("");
  const [dbName, setDbName] = useState("switch_v2");
  const [admUser, setAdmUser] = useState("admin");
  const [admEmail, setAdmEmail] = useState("");
  const [admPass, setAdmPass] = useState("");

  useEffect(() => {
    getInstallStatus()
      .then((s) => {
        setStatus(s);
        setDbHost(s.db.host);
        setDbPort(String(s.db.port));
        setDbUser(s.db.user);
        setDbName(s.db.name);
        setAdmUser(s.admin.username);
        setAdmEmail(s.admin.email);
        if (s.installed) setDone(true);
      })
      .catch(() => setError("Install status check nahi ho paya — API chalu hai?"));
  }, []);

  async function handleInstall(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await runInstall({
        db: {
          host: dbHost.trim(),
          port: Number(dbPort) || 3306,
          user: dbUser.trim(),
          pass: dbPass,
          name: dbName.trim(),
        },
        admin: {
          username: admUser.trim(),
          email: admEmail.trim(),
          password: admPass,
        },
      });
      setDone(true);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(anyErr.response?.data?.error?.message ?? "Installation fail ho gayi — details check karo");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-brand/20 bg-night-800 p-10 text-center shadow-2xl">
          <div className="mb-3 text-5xl">✅</div>
          <h1 className="mb-2 text-2xl font-bold">Installation Complete!</h1>
          <p className="text-sm text-gray-400">
            Database ready, admin ban gaya, installed flag lag gaya. Site ab normal chal raha hai —
            reload ho raha hai...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-brand/20 bg-night-800 p-10 shadow-2xl">
        <div className="mb-1 flex items-center gap-3">
          <span className="text-4xl">⚡</span>
          <h1 className="text-2xl font-bold">RoboSphere — Setup</h1>
        </div>
        <p className="mb-6 text-sm text-gray-400">
          Pehli baar chala rahe ho? Bas database aur admin details do — tables, admin account aur
          installed flag sab khud ban jayega.
        </p>

        {status && !status.dbReachable && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            ⚠️ Database server abhi reachable nahi hai ({status.db.host}:{status.db.port}) — sahi
            host / user / password check karo.
          </div>
        )}

        <form onSubmit={handleInstall} className="space-y-6">
          <div>
            <h2 className="mb-3 text-lg font-bold text-white">1 · Database</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Host</label>
                <input className={inputCls} value={dbHost} onChange={(e) => setDbHost(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Port</label>
                <input className={inputCls} value={dbPort} onChange={(e) => setDbPort(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Username</label>
                <input className={inputCls} value={dbUser} onChange={(e) => setDbUser(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input
                  className={inputCls}
                  type="password"
                  value={dbPass}
                  onChange={(e) => setDbPass(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Database name</label>
                <input className={inputCls} value={dbName} onChange={(e) => setDbName(e.target.value)} required />
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-white">2 · Admin Account</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Username</label>
                <input className={inputCls} value={admUser} onChange={(e) => setAdmUser(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={admEmail} onChange={(e) => setAdmEmail(e.target.value)} required />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Password</label>
                <input
                  className={inputCls}
                  type="password"
                  value={admPass}
                  onChange={(e) => setAdmPass(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand px-6 py-3 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Installing… (tables + admin + flag)" : "🚀 Install RoboSphere"}
          </button>
        </form>
      </div>
    </div>
  );
}
