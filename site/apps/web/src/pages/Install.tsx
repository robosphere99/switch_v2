import { useEffect, useState } from "react";
import {
  getInstallStatus,
  testInstallDb,
  createInstallSchema,
  completeInstallAdmin,
  type InstallStatus,
  type DbInput,
} from "../api/install";

const inputCls =
  "w-full rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-night-950 outline-none focus:border-brand";

const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500";

type Step = 1 | 2 | 3 | 4;

const STEPS: Array<{ n: Step; label: string }> = [
  { n: 1, label: "Database" },
  { n: 2, label: "Tables" },
  { n: 3, label: "Admin" },
  { n: 4, label: "Complete" },
];

/**
 * First-run installation wizard — jab DB/tables nahi hain to app ke bajaye
 * yeh page dikhta hai. .env khud se banane ki zaroorat NAHI — wizard DB
 * details leta hai, connect/test karta hai, tables banata hai, admin account
 * banata hai aur config ko .env me khud save kar deta hai (restart pe bhi
 * sahi DB chalti hai).
 */
export function Install() {
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // DB form
  const [dbHost, setDbHost] = useState("127.0.0.1");
  const [dbPort, setDbPort] = useState("3306");
  const [dbUser, setDbUser] = useState("switch_v2");
  const [dbPass, setDbPass] = useState("switchnest@1234567890");
  const [dbName, setDbName] = useState("switch_v2");
  const [dbTesting, setDbTesting] = useState(false);
  const [dbTested, setDbTested] = useState(false);
  const [serverVersion, setServerVersion] = useState("");

  // Tables step
  const [schemaBusy, setSchemaBusy] = useState(false);
  const [schemaDone, setSchemaDone] = useState(false);

  // Admin form
  const [admUsername, setAdmUsername] = useState("admin");
  const [admName, setAdmName] = useState("");
  const [admEmail, setAdmEmail] = useState("");
  const [admPass, setAdmPass] = useState("");
  const [admConfirm, setAdmConfirm] = useState("");
  const [admBusy, setAdmBusy] = useState(false);

  useEffect(() => {
    getInstallStatus()
      .then((s) => {
        setStatus(s);
        setDbHost(s.db.host);
        setDbPort(String(s.db.port));
        setDbUser(s.db.user);
        setDbName(s.db.name || "switchnest");
        setAdmUsername(s.admin.username || "admin");
        setAdmEmail(s.admin.email || "");
        if (s.installed) setDone(true);
      })
      .catch(() => setError("Install status check nahi ho paya — API chalu hai?"));
  }, []);

  function dbPayload(): DbInput {
    return {
      host: dbHost.trim(),
      port: Number(dbPort) || 3306,
      user: dbUser.trim(),
      pass: dbPass,
      name: dbName.trim() || "switchnest",
    };
  }

  async function handleTestDb(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDbTesting(true);
    setDbTested(false);
    try {
      const r = await testInstallDb(dbPayload());
      setServerVersion(r.serverVersion);
      setDbTested(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(anyErr.response?.data?.error?.message ?? "Database connect nahi ho paya — details check karo");
    } finally {
      setDbTesting(false);
    }
  }

  async function goToTables() {
    if (!dbTested) {
      setError("Pehle 'Test connection' dabao aur connect hone do.");
      return;
    }
    setError("");
    setStep(2);
    setSchemaBusy(true);
    try {
      await createInstallSchema(dbPayload());
      setSchemaDone(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(anyErr.response?.data?.error?.message ?? "Tables nahi ban payi — details check karo");
      setStep(1);
    } finally {
      setSchemaBusy(false);
    }
  }

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (admPass.length < 6) {
      setError("Password kam se kam 6 characters ka rakho.");
      return;
    }
    if (admPass !== admConfirm) {
      setError("Password aur confirm password match nahi kar rahe.");
      return;
    }
    setAdmBusy(true);
    try {
      await completeInstallAdmin(dbPayload(), {
        username: admUsername.trim(),
        name: admName.trim() || undefined,
        email: admEmail.trim(),
        password: admPass,
      });
      setStep(4);
      setDone(true);
      setTimeout(() => window.location.reload(), 2500);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(anyErr.response?.data?.error?.message ?? "Setup complete nahi ho paya — details check karo");
    } finally {
      setAdmBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-brand/20 bg-night-800 p-10 text-center shadow-2xl">
          <div className="mb-3 text-5xl">🎉</div>
          <h1 className="mb-2 text-2xl font-bold">SwitchNest Ready!</h1>
          <p className="text-sm text-gray-500">
            Database connected, tables ban gayi, admin account ready. Config save ho gaya —
            ab site load ho raha hai...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl border border-brand/20 bg-night-800 p-8 shadow-2xl">
        <div className="mb-1 flex items-center gap-3">
          <span className="text-4xl">⚡</span>
          <h1 className="text-2xl font-bold">SwitchNest — Setup</h1>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Bas 3 cheezein chahiye: database, tables, admin account. Baaki sab khud ho jayega —
          koi .env file banane ki zaroorat nahi.
        </p>

        {/* Step indicator */}
        <ol className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const active = step === s.n;
            const passed = s.n < step;
            return (
              <li key={s.n} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-6 bg-gray-700" />}
                <span
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    active
                      ? "bg-brand text-white"
                      : passed
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-night-900 text-gray-500"
                  }`}
                >
                  <span>{passed ? "✓" : s.n}</span>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            ⚠️ {error}
          </div>
        )}
        {status && !status.dbReachable && step === 1 && (
          <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
            ℹ️ Abhi configured DB ({status.db.host}:{status.db.port}) reachable nahi hai — neeche
            sahi details daalo aur test karo.
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleTestDb} className="space-y-5">
            <div>
              <h2 className="mb-3 text-lg font-bold text-night-950">1 · Database Connection</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Host</label>
                  <input className={inputCls} value={dbHost} onChange={(e) => setDbHost(e.target.value)} placeholder="localhost" required />
                </div>
                <div>
                  <label className={labelCls}>Port</label>
                  <input className={inputCls} value={dbPort} onChange={(e) => setDbPort(e.target.value)} placeholder="3306" required />
                </div>
                <div>
                  <label className={labelCls}>Username</label>
                  <input className={inputCls} value={dbUser} onChange={(e) => setDbUser(e.target.value)} placeholder="root" required />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={dbPass}
                    onChange={(e) => setDbPass(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Database name (naya nahi hai to ban jayega)</label>
                  <input className={inputCls} value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="switchnest" required />
                </div>
              </div>
            </div>

            {dbTested && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
                ✅ Connected — {serverVersion} · database <b>{dbName}</b> ready
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={dbTesting}
                className="rounded-lg border border-gray-600 px-5 py-2 text-sm font-semibold text-gray-400 transition hover:border-brand hover:text-brand disabled:opacity-40"
              >
                {dbTesting ? "Connecting…" : dbTested ? "Re-test connection" : "Test connection"}
              </button>
              <button
                type="button"
                onClick={goToTables}
                disabled={!dbTested}
                className="rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Next → Tables
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-night-950">2 · Tables</h2>
            {schemaBusy ? (
              <div className="flex items-center gap-3 rounded-lg border border-brand/20 bg-night-900 px-4 py-4 text-sm text-gray-400">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                Tables ban rahi hain ({dbName})… kuch seconds lagega
              </div>
            ) : schemaDone ? (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-500">
                ✅ Saari tables ban gayi (users, homes, devices, schedules, orders, support…)
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-gray-600 px-5 py-2 text-sm font-semibold text-gray-400 transition hover:border-brand hover:text-brand"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!schemaDone}
                className="rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Next → Admin
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleAdminSubmit} className="space-y-5">
            <div>
              <h2 className="mb-3 text-lg font-bold text-night-950">3 · Admin Account</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Username</label>
                  <input className={inputCls} value={admUsername} onChange={(e) => setAdmUsername(e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls}>Name (optional)</label>
                  <input className={inputCls} value={admName} onChange={(e) => setAdmName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Email</label>
                  <input className={inputCls} type="email" value={admEmail} onChange={(e) => setAdmEmail(e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={admPass}
                    onChange={(e) => setAdmPass(e.target.value)}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Confirm password</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={admConfirm}
                    onChange={(e) => setAdmConfirm(e.target.value)}
                    placeholder="Same password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-gray-600 px-5 py-2 text-sm font-semibold text-gray-400 transition hover:border-brand hover:text-brand"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={admBusy}
                className="rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {admBusy ? "Completing setup…" : "🚀 Complete setup"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
