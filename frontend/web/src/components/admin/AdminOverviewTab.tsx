import { useQuery } from "@tanstack/react-query";
import { getStats, getDeployInfo, getEspDevices, listAuditLogs, type DeployInfo } from "../../api/admin";
import { Card } from "../ui/Card";
import { CardHeader } from "../ui/CardHeader";
import { CardTitle } from "../ui/CardTitle";
import { CardContent } from "../ui/CardContent";
import { Badge } from "../ui/Badge";
import { Users, Home, Lightbulb, RadioTower, IndianRupee, ShoppingCart, AlertTriangle, Clock, GitBranch } from "lucide-react";

function CiStrip({ ci }: { ci: NonNullable<DeployInfo["ci"]> }) {
  const badge =
    ci.status === "pass" ? (
      <Badge variant="success">Pass</Badge>
    ) : ci.status === "fail" ? (
      <Badge variant="danger">Fail</Badge>
    ) : ci.status === "pending" ? (
      <Badge variant="warning">Running</Badge>
    ) : (
      <Badge variant="neutral">Unknown</Badge>
    );

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-3 text-xs">
      <span className="font-semibold uppercase tracking-wider text-text-muted">CI</span>
      {badge}
      {ci.workflow && <span className="text-text-muted">· {ci.workflow}</span>}
      {ci.runId && <span className="font-mono text-text-muted">· run #{ci.runId}</span>}
      {ci.updatedAt && (
        <span className="text-text-muted">
          · {new Date(ci.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
        </span>
      )}
      {ci.reason && <span className="text-amber-500 font-medium">· {ci.reason}</span>}
    </div>
  );
}

export function AdminOverviewTab() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: getStats, refetchInterval: 15_000 });
  const deployInfo = useQuery({ queryKey: ["admin-deploy-info"], queryFn: getDeployInfo, refetchInterval: 60_000 });
  const esp = useQuery({ queryKey: ["admin-esp", ""], queryFn: () => getEspDevices(), refetchInterval: 15_000 });
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: () => listAuditLogs(), refetchInterval: 15_000 });

  const s = stats.data?.success ? stats.data.data : null;

  const statCards = [
    {
      label: "Total Users",
      value: s ? s.users : "—",
      sub: s ? `${s.activeToday} active today · ${s.newUsers7d} new (7d)` : "Loading…",
      icon: <Users className="h-5 w-5 text-brand" />,
    },
    {
      label: "Homes",
      value: s ? s.homes : "—",
      sub: s ? `Platform-wide home count` : "Loading…",
      icon: <Home className="h-5 w-5 text-emerald-500" />,
    },
    {
      label: "Switches / Devices",
      value: s ? s.devices : "—",
      sub: s ? `${s.onlineDevices} online now` : "Loading…",
      icon: <Lightbulb className="h-5 w-5 text-amber-500" />,
    },
    {
      label: "ESP Boards Fleet",
      value: s ? `${s.espBoards - s.offlineBoards} / ${s.espBoards}` : "—",
      sub: s ? `${s.offlineBoards} offline` : "Loading…",
      icon: <RadioTower className="h-5 w-5 text-sky-500" />,
    },
    {
      label: "Store Revenue",
      value: s ? `₹${s.revenueTotal.toLocaleString("en-IN")}` : "—",
      sub: s ? `₹${s.revenueThisMonth.toLocaleString("en-IN")} this month` : "Loading…",
      icon: <IndianRupee className="h-5 w-5 text-emerald-600" />,
    },
    {
      label: "Total Orders",
      value: s ? s.orders : "—",
      sub: s ? `${s.pendingOrders} pending · ${s.ordersToday} today` : "Loading…",
      icon: <ShoppingCart className="h-5 w-5 text-purple-500" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Memory Leak Alert */}
      {stats.data?.success && stats.data.data.leak?.leaking && stats.data.data.leak.detail && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-rose-500">
              <AlertTriangle className="h-5 w-5" /> Memory Leak Warning Detected
            </h2>
            <Badge variant="danger">
              PID {stats.data.data.leak.detail.pid} · +{Math.round(stats.data.data.leak.detail.growthPct)}%
            </Badge>
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            RSS memory expanded by +{stats.data.data.leak.detail.growthPct.toFixed(0)}% across the last{" "}
            {stats.data.data.leak.detail.spanH.toFixed(1)}h ({stats.data.data.leak.detail.rssFirst.toFixed(0)}MB →{" "}
            {stats.data.data.leak.detail.rssLast.toFixed(0)}MB). Inspect the Logs tab for detailed leak monitor
            diagnostics.
          </p>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{c.label}</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-secondary">
                  {c.icon}
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold text-text-primary">{c.value}</div>
              <div className="mt-1 text-xs text-text-muted">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deployment Health & CI */}
      {(deployInfo.data?.success || deployInfo.isFetching) && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <GitBranch className="h-4 w-4" /> Production Deployment Status
              </p>
              {deployInfo.data?.success && deployInfo.data.data.deployedAt && (
                <span className="text-xs text-text-muted">
                  Last deployed: {new Date(deployInfo.data.data.deployedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                </span>
              )}
            </div>

            {deployInfo.data?.success && deployInfo.data.data.sync?.status === "lagging" && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                ⚠️ <b>Deploy Lagging:</b> Main branch has commit{" "}
                <span className="font-mono font-bold">{deployInfo.data.data.sync.latestCommit?.slice(0, 7)}</span> pushed{" "}
                {deployInfo.data.data.sync.ageMin !== null && `${deployInfo.data.data.sync.ageMin} min ago`}, but live server is running{" "}
                <span className="font-mono font-bold">{deployInfo.data.data.sync.deployedCommit?.slice(0, 7)}</span>.
              </div>
            )}

            {deployInfo.data?.success ? (
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Commit Hash</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-text-primary">
                    {(deployInfo.data.data.sync?.deployedCommit || deployInfo.data.data.git?.commit || deployInfo.data.data.latest?.commit || "—").slice(0, 12)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Active Branch</p>
                  <p className="mt-1 font-semibold text-text-primary">
                    {deployInfo.data.data.git?.branch || deployInfo.data.data.marker?.branch || deployInfo.data.data.latest?.branch || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">API Server Start</p>
                  <p className="mt-1 text-xs font-medium text-text-primary">
                    {deployInfo.data.data.startedAt
                      ? new Date(deployInfo.data.data.startedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Deploy State</p>
                  <p className="mt-1 font-semibold text-text-primary">
                    {deployInfo.data.data.deployedAt ? "✅ Synchronized" : "ℹ️ Local / Dev"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-text-muted">Querying deployment metadata…</p>
            )}

            {deployInfo.data?.success && deployInfo.data.data.ci && <CiStrip ci={deployInfo.data.data.ci} />}
          </CardContent>
        </Card>
      )}

      {/* 7-Day Trend Chart */}
      {s && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">7-Day Trajectory</CardTitle>
            <p className="text-xs text-text-muted">Daily breakdown of user registrations and store transactions</p>
          </CardHeader>
          <CardContent>
            {(() => {
              const days: Array<{ k: string; label: string }> = [];
              for (let i = 6; i >= 0; i--) {
                const d = new Date(Date.now() - i * 86_400_000);
                days.push({
                  k: d.toISOString().slice(0, 10),
                  label: d.toLocaleDateString([], { weekday: "short" }),
                });
              }
              const maxUsers = Math.max(1, ...days.map((d) => s.usersByDay[d.k] ?? 0));
              const maxOrders = Math.max(1, ...days.map((d) => s.ordersByDay[d.k] ?? 0));

              return (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">New Signups</p>
                    <div className="flex h-28 items-end gap-2 border-b border-border/60 pb-2">
                      {days.map((d) => (
                        <div key={d.k} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold text-text-muted">{s.usersByDay[d.k] ?? 0}</span>
                          <div
                            className="w-full rounded-t-md bg-brand transition-all hover:bg-brand-hover"
                            style={{ height: `${Math.max(4, ((s.usersByDay[d.k] ?? 0) / maxUsers) * 80)}px` }}
                          />
                          <span className="text-[10px] text-text-muted">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Daily Orders · ₹{(s.revenueByDay[days[6].k] ?? 0).toLocaleString("en-IN")} Today
                    </p>
                    <div className="flex h-28 items-end gap-2 border-b border-border/60 pb-2">
                      {days.map((d) => (
                        <div key={d.k} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold text-text-muted">{s.ordersByDay[d.k] ?? 0}</span>
                          <div
                            className="w-full rounded-t-md bg-amber-500 transition-all hover:bg-amber-600"
                            style={{ height: `${Math.max(4, ((s.ordersByDay[d.k] ?? 0) / maxOrders) * 80)}px` }}
                          />
                          <span className="text-[10px] text-text-muted">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Fleet-wide Offline Boards Alert */}
      {(() => {
        const twoMin = Date.now() - 120_000;
        const offline = (esp.data?.success ? esp.data.data.esps : []).filter(
          (e) => e.offline || (e.lastSeen ? new Date(e.lastSeen).getTime() < twoMin : true),
        );
        if (offline.length === 0) return null;

        return (
          <Card className="border-rose-500/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-rose-500 flex items-center gap-2">
                  <RadioTower className="h-4 w-4" /> {offline.length} Offline Board{offline.length === 1 ? "" : "s"}
                </CardTitle>
                <Badge variant="danger">{offline.length} Unreachable</Badge>
              </div>
              <p className="text-xs text-text-muted">Hardware boards that have not pinged the cloud in &gt; 2 minutes</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {offline.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-secondary/50 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">
                        {e.name ?? "ESP Board"}{" "}
                        {e.serialCode && <span className="font-mono text-[10px] text-text-muted">· {e.serialCode}</span>}
                      </p>
                      <p className="truncate text-[11px] text-text-muted">
                        {e.home?.name} · {e.home?.owner?.username}
                        {e.ipAddress ? ` · ${e.ipAddress}` : ""}
                      </p>
                    </div>
                    <Badge variant="danger" size="sm">Offline</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Recent System Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-text-muted" /> Recent Audit Activity
            </CardTitle>
            <Badge variant="neutral">System Trail</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(audit.data?.success ? audit.data.data.slice(0, 8) : []).map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface-secondary/30 px-4 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">{log.action}</Badge>
                  {log.entity && (
                    <span className="font-medium text-text-secondary">
                      {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                    </span>
                  )}
                </div>
                <span className="text-text-muted">
                  {log.actor ? log.actor.username : "system"} · {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
            {audit.data?.success && audit.data.data.length === 0 && (
              <p className="py-6 text-center text-xs text-text-muted">No audit events recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
