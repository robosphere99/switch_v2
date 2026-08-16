import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Home, KeyRound, LayoutDashboard, Lightbulb, MessageSquare, RadioTower, ScrollText, Settings, ShoppingCart, Users, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getStats,
  globalSearch,
  listUsers,
  setUserStatus,
  setUserRole,
  deleteUser,
  listAllHomes,
  getHomeDetail,
  setHomeStatus,
  deleteHome,
  listAllDevices,
  listAllApiKeys,
  deleteApiKey,
  listAuditLogs,
  getEspDevices,
  getFirmwareList,
  uploadFirmware,
  activateFirmware,
  pushOta,
  pushOtaAll,
  probeEsp,
  renameEsp,
  issueEspKey,
  type AdminHomeDetail,
  type EspBoard,
  getAdminLogs,
  getAdminDiagnostics,
  getDeviceSupport,
  adminSetDeviceStatus,
  clearDeviceCommands,
  getEspHistory,
  findAnything,
} from "../api/admin";
import { Modal } from "../components/Modal";
import { AdminShop } from "../components/AdminShop";
import { AdminSupport } from "../components/AdminSupport";
import { AdminSettings } from "../components/AdminSettings";
import { SupportChatModal } from "../components/SupportChatModal";
import { getSocket } from "../lib/socket";

type Tab = "overview" | "users" | "homes" | "devices" | "ota" | "shop" | "keys" | "audit" | "logs" | "support" | "settings";

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  // Support inbox admin ka #1 kaam hai — Overview ke turant baad prominent position pe
  { id: "support", label: "Support", icon: MessageSquare },
  { id: "users", label: "Users", icon: Users },
  { id: "homes", label: "Homes", icon: Home },
  { id: "devices", label: "Devices", icon: Lightbulb },
  { id: "ota", label: "OTA / ESP", icon: RadioTower },
  { id: "shop", label: "Shop / Orders", icon: ShoppingCart },
  { id: "keys", label: "API Keys", icon: KeyRound },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "logs", label: "Logs", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>
      {children}
    </span>
  );
}

function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s2 = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s2}s`;
  return `${s2}s`;
}

export function Admin() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [q, setQ] = useState("");
  const [gsQ, setGsQ] = useState("");
  const [gsOpen, setGsOpen] = useState(false);
  const [gsIdx, setGsIdx] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState("");
  const [findIdx, setFindIdx] = useState(0);
  const [chatUser, setChatUser] = useState<{ id: number; username: string } | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Support inbox — notification deep-link se khulta hai (/admin?tab=support&user=<id>)
  const [supportUserId, setSupportUserId] = useState<number | null>(() => {
    const n = Number(searchParams.get("user"));
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  useEffect(() => {
    if (searchParams.get("tab") === "support") setTab("support");
    const n = Number(searchParams.get("user"));
    setSupportUserId(Number.isInteger(n) && n > 0 ? n : null);
  }, [searchParams]);
  const selectSupportUser = (id: number | null) => {
    setSupportUserId(id);
    navigate(id != null ? `/admin?tab=support&user=${id}` : "/admin?tab=support", { replace: true });
  };
  const [gsDebounced, setGsDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setGsDebounced(gsQ.trim()), 250);
    return () => clearTimeout(t);
  }, [gsQ]);
  const global = useQuery({
    queryKey: ["admin-search", gsDebounced],
    queryFn: () => globalSearch(gsDebounced),
    enabled: gsOpen && gsDebounced.length >= 2,
  });

  // Flat list of all search results (sections + items) — keyboard navigation ke liye.
  const flatResults = useMemo(() => {
    if (!global.data?.success) return [];
    const r = global.data.data;
    const sections: Array<{ label: string; icon: string; items: unknown[]; tab: Tab }> = [
      { label: "Users", icon: "👤", items: r.users, tab: "users" },
      { label: "Homes", icon: "🏠", items: r.homes, tab: "homes" },
      { label: "Devices", icon: "💡", items: r.devices, tab: "devices" },
      { label: "ESP Boards", icon: "🛰️", items: r.esps, tab: "ota" },
      { label: "Orders", icon: "🛒", items: r.orders, tab: "shop" },
      { label: "Serials", icon: "🔑", items: r.serials, tab: "shop" },
    ];
    return sections.flatMap((sec) =>
      sec.items.map((item) => ({ label: sec.label, icon: sec.icon, tab: sec.tab, item })),
    );
  }, [global.data]);

  // Query/close hone pe selection reset
  useEffect(() => setGsIdx(0), [gsDebounced, gsOpen]);

  const findRes = useQuery({
    queryKey: ["admin-find", findQ],
    queryFn: () => findAnything(findQ),
    enabled: findOpen && findQ.trim().length >= 2,
  });

  // Support lookup flat results — keyboard navigation ke liye.
  const flatFind = useMemo(() => {
    if (!findRes.data?.success) return [];
    const r = findRes.data.data;
    const sections: Array<{ label: string; icon: string; items: unknown[]; tab: Tab }> = [
      { label: "Users", icon: "👤", items: r.users, tab: "users" },
      { label: "Orders", icon: "🛒", items: r.orders, tab: "shop" },
      { label: "Serials", icon: "🔑", items: r.serials, tab: "shop" },
      { label: "ESP Boards", icon: "🛰️", items: r.boards, tab: "ota" },
      { label: "Devices", icon: "💡", items: r.devices, tab: "devices" },
      { label: "Support msgs", icon: "✉️", items: r.messages, tab: "logs" },
      { label: "Warranty claims", icon: "🛡️", items: r.claims, tab: "shop" },
    ];
    return sections.flatMap((sec) =>
      sec.items.map((item) => ({ label: sec.label, icon: sec.icon, tab: sec.tab, item })),
    );
  }, [findRes.data]);

  useEffect(() => setFindIdx(0), [findQ, findOpen]);
  const [copied, setCopied] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [viewHome, setViewHome] = useState<AdminHomeDetail | null>(null);
  const [fwFile, setFwFile] = useState<File | null>(null);
  const [fwVersion, setFwVersion] = useState("");
  const [fwModel, setFwModel] = useState("");
  const [fwNotes, setFwNotes] = useState("");
  const [otaMsg, setOtaMsg] = useState<string | null>(null);
  const [histFor, setHistFor] = useState<number | null>(null);

  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: getStats, refetchInterval: 15_000 });
  const users = useQuery({ queryKey: ["admin-users", q], queryFn: () => listUsers(q || undefined), refetchInterval: 15_000 });
  const homes = useQuery({ queryKey: ["admin-homes", q], queryFn: () => listAllHomes(q || undefined), refetchInterval: 15_000 });
  const logs = useQuery({
    queryKey: ["admin-logs"],
    queryFn: getAdminLogs,
    enabled: tab === "logs",
    refetchInterval: tab === "logs" ? 10_000 : false,
  });
  const diag = useQuery({
    queryKey: ["admin-diag"],
    queryFn: getAdminDiagnostics,
    enabled: tab === "logs",
    refetchInterval: tab === "logs" ? 10_000 : false,
  });
  const devices = useQuery({ queryKey: ["admin-devices", q], queryFn: () => listAllDevices(q || undefined), refetchInterval: 10_000 });
  const keys = useQuery({ queryKey: ["admin-keys"], queryFn: listAllApiKeys, refetchInterval: 30_000 });
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: () => listAuditLogs(), refetchInterval: 15_000 });
  const esp = useQuery({ queryKey: ["admin-esp", q], queryFn: () => getEspDevices(q || undefined), refetchInterval: 10_000 });
  const fw = useQuery({ queryKey: ["admin-firmware"], queryFn: getFirmwareList, refetchInterval: 30_000 });
  const espHist = useQuery({
    queryKey: ["esp-hist", histFor],
    queryFn: () => getEspHistory(histFor!),
    enabled: histFor !== null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-"] });
  };

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "active" | "suspended" }) => setUserStatus(id, status),
    onSuccess: invalidate,
  });
  const role = useMutation({
    mutationFn: ({ id, r }: { id: number; r: "user" | "system_admin" }) => setUserRole(id, r),
    onSuccess: invalidate,
  });
  const delUser = useMutation({
    mutationFn: deleteUser,
    onSuccess: invalidate,
  });
  const setHomeStatusM = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "active" | "suspended" }) => setHomeStatus(id, status),
    onSuccess: invalidate,
  });
  const delHome = useMutation({
    mutationFn: deleteHome,
    onSuccess: invalidate,
  });
  const delKey = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: invalidate,
  });
  const publishFw = useMutation({
    mutationFn: uploadFirmware,
    onSuccess: invalidate,
  });
  const activateFw = useMutation({
    mutationFn: activateFirmware,
    onSuccess: invalidate,
  });
  const pushOtaM = useMutation({
    mutationFn: pushOta,
    onSuccess: invalidate,
  });
  const pushAllM = useMutation({
    mutationFn: pushOtaAll,
    onSuccess: invalidate,
  });
  const renameM = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameEsp(id, name),
    onSuccess: invalidate,
  });
  const issueKeyM = useMutation({
    mutationFn: (espId: number) => issueEspKey(espId),
    onSuccess: (r) => {
      invalidate();
      if (!r.success) return;
      const key = r.data.apiKey ?? "";
      navigator.clipboard?.writeText(key).then(() => true).catch(() => false);
      const nl = String.fromCharCode(10);
      window.prompt(
        ["Naya API key (copy kar ke user ko de do):", key, "", "Sirf is baar dikhega — hash store hota hai."].join(nl),
        key,
      );
    },
  });

  // ESP reachability probe — IP click se pehle quick HTTP check.
  const PROBE_TTL_MS = 60_000;
  const [probes, setProbes] = useState<Record<number, { state: "probing" | "ok" | "fail"; at: number; latencyMs?: number }>>({});

  // Live OTA progress — ESP report karta hai (Update.onProgress -> server), socket se UI me.
  const [liveOta, setLiveOta] = useState<Record<number, { progress: number; status: string }>>({});

  useEffect(() => {
    const socket = getSocket();
    const handler = (d: { id: number; otaProgress?: number | null; otaStatus?: string | null }) => {
      if (d && typeof d.id === "number" && d.otaStatus) {
        const status: string = d.otaStatus;
        setLiveOta((prev) => ({ ...prev, [d.id]: { progress: d.otaProgress ?? 0, status } }));
      } else if (d && typeof d.id === "number") {
        setLiveOta((prev) => {
          const next = { ...prev };
          delete next[d.id];
          return next;
        });
      }
    };
    socket.on("esp:updated", handler);
    return () => {
      socket.off("device:updated", handler);
    };
  }, []);

  const handleIpClick = async (e: React.MouseEvent<HTMLAnchorElement>, d: EspBoard) => {
    const ip = d.ipAddress;
    if (!ip) return;
    e.preventDefault();
    const existing = probes[d.id];
    if (existing?.state === "probing") return;
    if (existing && Date.now() - existing.at < PROBE_TTL_MS) {
      if (existing.state === "ok") window.open(`http://${ip}`, "_blank", "noopener,noreferrer");
      return;
    }
    setProbes((p) => ({ ...p, [d.id]: { state: "probing", at: Date.now() } }));
    const started = Date.now();
    const r = await probeEsp(d.id);
    const ok = r.success && r.data.reachable;
    setProbes((p) => ({
      ...p,
      [d.id]: {
        state: ok ? "ok" : "fail",
        at: Date.now(),
        latencyMs: r.success ? r.data.latencyMs : Date.now() - started,
      },
    }));
    if (ok) window.open(`http://${ip}`, "_blank", "noopener,noreferrer");
  };

  const s = stats.data?.success ? stats.data.data : null;
  const statCards = s
    ? [
        { label: "Total Users", value: s.users, icon: "👤", sub: `${s.activeToday} active today · ${s.newUsers7d} new (7d)` },
        { label: "Revenue", value: `₹${s.revenueTotal.toLocaleString("en-IN")}`, icon: "💰", sub: `₹${s.revenueThisMonth.toLocaleString("en-IN")} this month` },
        { label: "Orders", value: s.orders, icon: "🛒", sub: `${s.pendingOrders} pending · ${s.ordersToday} today` },
        { label: "Homes", value: s.homes, icon: "🏠", sub: "platform-wide" },
        { label: "Devices", value: s.devices, icon: "💡", sub: `${s.onlineDevices} online now` },
        { label: "ESP Boards", value: `${s.espBoards - s.offlineBoards}/${s.espBoards}`, icon: "📡", sub: `${s.offlineBoards} offline` },
        { label: "API Requests (24h)", value: s.requests.last24h.toLocaleString("en-IN"), icon: "📨", sub: `${s.requests.today.toLocaleString("en-IN")} today · ${s.requests.total.toLocaleString("en-IN")} all-time` },
        { label: "Support Messages", value: s.supportMessages, icon: "🛠️", sub: `${s.contactMessages} contact msgs` },
        { label: "Pending Commands", value: s.pendingCommands, icon: "⚡", sub: "awaiting ESP32" },
        { label: "API Keys", value: s.apiKeys, icon: "🔑", sub: "device access" },
        { label: "Audit Events", value: s.auditCount, icon: "📜", sub: "tracked actions" },
        { label: "ESP Logs (24h)", value: s.deviceLogs24h.toLocaleString("en-IN"), icon: "🗄️", sub: "device activity" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-3xl font-bold">🛡️ Admin Panel</h1>
          <p className="text-sm text-gray-500">Platform-wide management (system admin only).</p>
        </div>
        <button
          onClick={() => {
            setFindOpen(true);
            setFindQ("");
            setFindIdx(0);
          }}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-500/20"
          title="Customer support: phone / order / serial / MAC se turant user context"
        >
          🆘 Find anything
        </button>
        <div className="relative">
          <input
            value={gsQ}
            onChange={(e) => {
              setGsQ(e.target.value);
              setGsOpen(true);
            }}
            onFocus={() => setGsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!gsOpen) {
                  setGsOpen(true);
                } else if (flatResults.length > 0) {
                  setGsIdx((i) => Math.min(i + 1, flatResults.length - 1));
                }
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (flatResults.length > 0) setGsIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (flatResults.length > 0) {
                  const row = flatResults[Math.min(gsIdx, flatResults.length - 1)];
                  setTab(row.tab);
                  setQ(gsDebounced);
                }
                setGsOpen(false);
              } else if (e.key === "Escape") {
                setGsOpen(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="🔍 Global search… (users / homes / devices / ESPs / orders / serials)"
            className="w-72 rounded-lg border border-brand/20 bg-night-800 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          {gsOpen && gsDebounced.length >= 2 && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setGsOpen(false)} />
              <div className="absolute right-0 z-40 mt-2 max-h-[28rem] w-96 overflow-y-auto rounded-xl border border-gray-200 bg-night-900 shadow-2xl">
                {global.isLoading && <p className="px-4 py-6 text-center text-sm text-gray-500">Searching…</p>}
                {!global.isLoading && global.data?.success && (() => {
                  const r = global.data.data;
                  const sections: Array<{ label: string; icon: string; count: number; items: unknown[]; tab: Tab }> = [
                    { label: "Users", icon: "👤", count: r.users.length, items: r.users, tab: "users" },
                    { label: "Homes", icon: "🏠", count: r.homes.length, items: r.homes, tab: "homes" },
                    { label: "Devices", icon: "💡", count: r.devices.length, items: r.devices, tab: "devices" },
                    { label: "ESP Boards", icon: "🛰️", count: r.esps.length, items: r.esps, tab: "ota" },
                    { label: "Orders", icon: "🛒", count: r.orders.length, items: r.orders, tab: "shop" },
                    { label: "Serials", icon: "🔑", count: r.serials.length, items: r.serials, tab: "shop" },
                  ];
                  const total = sections.reduce((a, x) => a + x.count, 0);
                  const jump = (tab: Tab) => {
                    setTab(tab);
                    setQ(gsDebounced);
                    setGsOpen(false);
                  };
                  let offset = 0;
                  return (
                    <>
                      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 text-xs text-gray-500">
                        <span>
                          "{gsDebounced}" — {total} result{total === 1 ? "" : "s"}
                        </span>
                        <span className="hidden text-[10px] text-gray-600 sm:inline">
                          ↑↓ select · ↵ open · esc close
                        </span>
                      </div>
                      {total === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-gray-500">Kuch nahi mila. 😕</p>
                      )}
                      {sections.map((sec) =>
                        sec.items.length === 0 ? null : (
                          <div key={sec.label} className="border-b border-gray-200 px-2 py-2">
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                              {sec.icon} {sec.label} ({sec.count})
                            </div>
                            {sec.items.map((item) => {
                              const idx = offset++;
                              const active = gsIdx === idx;
                              return (
                                <button
                                  key={String((item as { id: number }).id)}
                                  onMouseEnter={() => setGsIdx(idx)}
                                  onClick={() => jump(sec.tab)}
                                  ref={active ? (el) => { if (el) el.scrollIntoView({ block: "nearest" }); } : undefined}
                                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                                    active
                                      ? "bg-brand/20 text-brand"
                                      : "text-gray-700 hover:bg-night-800 hover:text-brand"
                                  }`}
                                >
                                  <span className="truncate font-medium">
                                    {(item as { name?: string; username?: string; orderNumber?: string; serialCode?: string }).name ??
                                      (item as { username?: string }).username ??
                                      (item as { orderNumber?: string }).orderNumber ??
                                      (item as { serialCode?: string }).serialCode}
                                  </span>
                                  <span className="ml-auto truncate text-[10px] text-gray-500">
                                    {subtitleFor(sec.label, item)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ),
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "border-brand bg-brand/20 text-brand"
                : "border-gray-200 bg-night-800 text-gray-600 hover:border-gray-500"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statCards.map((c) => (
              <div key={c.label} className="rounded-xl border border-gray-200 bg-night-800 p-6">
                <div className="text-3xl">{c.icon}</div>
                <div className="mt-3 text-3xl font-bold">{c.value}</div>
                <div className="text-sm font-medium text-gray-700">{c.label}</div>
                <div className="text-xs text-gray-500">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* 7-day trend — signups, orders, revenue */}
          {(() => {
            if (!s) return null;
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
              <div className="mb-8 rounded-xl border border-gray-200 bg-night-800 p-5">
                <h2 className="font-semibold">📈 Last 7 days — signups, orders & revenue</h2>
                <p className="mb-4 text-xs text-gray-500">Business trend — daily growth dekhne ke liye</p>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">New signups</p>
                    <div className="flex h-28 items-end gap-2">
                      {days.map((d) => (
                        <div key={d.k} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold text-gray-500">{s.usersByDay[d.k] ?? 0}</span>
                          <div
                            className="w-full rounded-t-md bg-brand/70"
                            style={{ height: `${((s.usersByDay[d.k] ?? 0) / maxUsers) * 84}px` }}
                          />
                          <span className="text-[10px] text-gray-500">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                      Orders · ₹{(s.revenueByDay[days[6].k] ?? 0).toLocaleString("en-IN")} today
                    </p>
                    <div className="flex h-28 items-end gap-2">
                      {days.map((d) => (
                        <div key={d.k} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold text-gray-500">
                            {s.ordersByDay[d.k] ?? 0}
                          </span>
                          <div
                            className="w-full rounded-t-md bg-amber-500/70"
                            style={{ height: `${((s.ordersByDay[d.k] ?? 0) / maxOrders) * 84}px` }}
                          />
                          <span className="text-[10px] text-gray-500">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Fleet-wide offline boards */}
          {(() => {
            const twoMin = Date.now() - 120_000;
            const offline = (esp.data?.success ? esp.data.data.esps : []).filter(
              (e) => e.offline || (e.lastSeen ? new Date(e.lastSeen).getTime() < twoMin : true),
            );
            if (offline.length === 0) return null;
            return (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
                <h2 className="mb-1 font-semibold text-red-400">
                  📡 {offline.length} board{offline.length === 1 ? "" : "s"} offline{" "}
                  <span className="text-xs font-normal text-gray-500">
                    — 2+ min se sync nahi kiya (fleet-wide)
                  </span>
                </h2>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {offline.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-night-900 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-700">
                          {e.name ?? "ESP"} {e.serialCode ? <span className="font-mono text-[10px] text-gray-500">· {e.serialCode}</span> : null}
                        </p>
                        <p className="truncate text-[11px] text-gray-500">
                          🏠 {e.home.name} · {e.home.owner?.username}
                          {e.ipAddress ? ` · ${e.ipAddress}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold uppercase text-red-400">offline</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Recent audit activity */}
          <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
            <h2 className="mb-4 font-semibold">🕒 Recent activity</h2>
            <div className="space-y-2">
              {(audit.data?.success ? audit.data.data.slice(0, 8) : []).map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-night-900 px-4 py-2 text-sm">
                  <div>
                    <Badge color="border-brand/40 text-brand">{log.action}</Badge>
                    {log.entity && (
                      <span className="ml-2 text-xs text-gray-500">
                        {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {log.actor ? log.actor.username : "system"} · {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
              {audit.data?.success && audit.data.data.length === 0 && (
                <p className="text-sm text-gray-500">No audit events yet — actions will be tracked here.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">
            Users <span className="text-sm font-normal text-gray-500">({users.data?.success ? users.data.data.length : "…"})</span>
          </h2>
          <div className="space-y-2">
            {users.data?.success &&
              users.data.data.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-night-900 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-semibold">{u.username}</span>
                    <span className="ml-2 text-xs text-gray-500">{u.email}</span>
                    <span className="ml-2 text-xs text-gray-600">
                      {u._count.ownedHomes} homes · {u._count.memberships} memberships
                    </span>
                    <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      u.role === "system_admin" ? "border-purple-500/40 text-purple-400" : "border-gray-300 text-gray-500"
                    }`}>
                      {u.role}
                    </span>
                    <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      u.status === "active" ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"
                    }`}>
                      {u.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => selectSupportUser(u.id)}
                      className="rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand transition hover:bg-brand/20"
                      title={`${u.username} se seedha support chat kholo (feedback / contact support)`}
                    >
                      💬 Message
                    </button>
                    <span className="text-[11px] text-gray-500">
                      joined {new Date(u.createdAt).toLocaleDateString()}
                      {u.lastLoginAt ? ` · last ${new Date(u.lastLoginAt).toLocaleDateString()}` : ""}
                    </span>
                    <button
                      onClick={() => role.mutate({ id: u.id, r: u.role === "system_admin" ? "user" : "system_admin" })}
                      className="text-xs font-semibold text-purple-400 hover:text-purple-300"
                      title="Toggle admin role"
                    >
                      {u.role === "system_admin" ? "Demote" : "Make admin"}
                    </button>
                    <button
                      onClick={() => setStatus.mutate({ id: u.id, status: u.status === "active" ? "suspended" : "active" })}
                      className={`text-xs font-semibold ${
                        u.status === "active" ? "text-amber-600 hover:text-amber-600" : "text-emerald-400 hover:text-emerald-300"
                      }`}
                    >
                      {u.status === "active" ? "Suspend" : "Activate"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete user "${u.username}"? All their data will be removed.`)) delUser.mutate(u.id);
                      }}
                      className="text-xs font-semibold text-red-400 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            {users.data?.success && users.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No users match the search.</p>
            )}
          </div>
        </div>
      )}

      {tab === "homes" && (
        <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">
            Homes <span className="text-sm font-normal text-gray-500">({homes.data?.success ? homes.data.data.length : "…"})</span>
          </h2>
          <div className="space-y-2">
            {homes.data?.success &&
              homes.data.data.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-night-900 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-semibold">🏠 {h.name}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      owner: {h.owner.username} · {h._count.devices} devices · {h._count.members} members · {h._count.rooms} rooms
                    </span>
                    <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      h.status === "active" ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"
                    }`}>
                      {h.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500">created {new Date(h.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={() => getHomeDetail(h.id).then((r) => r.success && setViewHome(r.data))}
                      className="text-xs font-semibold text-brand hover:text-brand"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setHomeStatusM.mutate({ id: h.id, status: h.status === "active" ? "suspended" : "active" })}
                      className={`text-xs font-semibold ${
                        h.status === "active" ? "text-amber-600 hover:text-amber-600" : "text-emerald-400 hover:text-emerald-300"
                      }`}
                    >
                      {h.status === "active" ? "Suspend" : "Activate"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete home "${h.name}"? All devices, members and data will be removed.`)) delHome.mutate(h.id);
                      }}
                      className="text-xs font-semibold text-red-400 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            {homes.data?.success && homes.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No homes match the search.</p>
            )}
          </div>
        </div>
      )}

      {tab === "devices" && (
        <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">
            Devices <span className="text-sm font-normal text-gray-500">({devices.data?.success ? devices.data.data.length : "…"})</span>
          </h2>
          <div className="space-y-2">
            {devices.data?.success &&
              devices.data.data.map((d) => (
                <div key={d.id} className="overflow-hidden rounded-lg border border-gray-200 bg-night-900">
                  <button
                    type="button"
                    onClick={() => setSelectedDevice(selectedDevice === d.id ? null : d.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-night-800"
                  >
                    <div>
                      <span className="font-semibold">{d.name}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        #{d.id} · {d.type}
                        {d.room ? ` · ${d.room.name}` : ""} · home: {d.home.name} ({d.home.owner.username})
                      </span>
                      <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        d.status === "on" ? "border-emerald-500/40 text-emerald-400" : "border-gray-300 text-gray-500"
                      }`}>
                        {d.status}
                      </span>
                      {d.serialNumber && <span className="ml-2 text-[10px] text-gray-600">S/N {d.serialNumber}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge color={d.online ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>
                        {d.online ? "ONLINE" : "OFFLINE"}
                      </Badge>
                      <span className="text-[11px] text-gray-500">
                        {d._count.commands} cmds · {d._count.logs} logs
                        {d.lastSeen ? ` · ${new Date(d.lastSeen).toLocaleString()}` : ""}
                      </span>
                      <span className="text-xs text-gray-500">{selectedDevice === d.id ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {selectedDevice === d.id && <DeviceSupportPanel deviceId={d.id} />}
                </div>
              ))}
            {devices.data?.success && devices.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No devices match the search.</p>
            )}
          </div>
        </div>
      )}

      {tab === "keys" && (
        <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">
            API Keys <span className="text-sm font-normal text-gray-500">({keys.data?.success ? keys.data.data.length : "…"})</span>
          </h2>
          <div className="space-y-2">
            {keys.data?.success &&
              keys.data.data.map((k) => (
                <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-night-900 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-mono text-xs font-semibold text-brand">{k.keyPrefix}…</span>
                    {k.label && <span className="ml-2 text-xs text-gray-500">{k.label}</span>}
                    <span className="ml-2 text-xs text-gray-500">
                      by {k.user.username} · {k.home ? `home: ${k.home.name}` : "global"}
                    </span>
                    {k.expiresAt && new Date(k.expiresAt).getTime() < Date.now() && (
                      <Badge color="border-red-500/40 text-red-400">expired</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500">
                      created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt ? ` · used ${new Date(k.lastUsedAt).toLocaleString()}` : ""}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm("Revoke this API key? Devices using it will lose access.")) delKey.mutate(k.id);
                      }}
                      className="text-xs font-semibold text-red-400 hover:text-red-600"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            {keys.data?.success && keys.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No API keys yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">
            Audit Log <span className="text-sm font-normal text-gray-500">({audit.data?.success ? audit.data.data.length : "…"})</span>
          </h2>
          <div className="space-y-2">
            {audit.data?.success &&
              audit.data.data.map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-200 bg-night-900 px-4 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge color="border-brand/40 text-brand">{log.action}</Badge>
                    {log.entity && (
                      <span className="text-xs text-gray-500">
                        {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500">
                      {log.actor ? log.actor.username : "system"} · {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {!!log.meta && typeof log.meta === "object" && (
                    <pre className="mt-1 overflow-x-auto text-[10px] text-gray-500">
                      {String(JSON.stringify(log.meta, null, 1) ?? "")}
                    </pre>
                  )}
                </div>
              ))}
            {audit.data?.success && audit.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No audit events yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === "ota" && (
        <div className="space-y-6">
          {otaMsg && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              ✅ {otaMsg}
            </div>
          )}

          {/* Firmware manager */}
          <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">📦 Firmware</h2>
              {fw.data?.success && fw.data.data.current ? (
                <Badge color="border-brand/40 text-brand">current: {fw.data.data.current.version}</Badge>
              ) : (
                <Badge color="border-amber-500/40 text-amber-600">no firmware published</Badge>
              )}
            </div>

            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!fwFile || !fwVersion.trim()) {
                  alert("Select a .bin file and enter a version (e.g. 1.0.1).");
                  return;
                }
                if (!fwFile.name.toLowerCase().endsWith(".bin")) {
                  alert("Only .bin files are accepted.");
                  return;
                }
                const form = new FormData();
                form.append("firmware", fwFile);
                form.append("version", fwVersion.trim());
                form.append("model", fwModel);
                form.append("release_notes", fwNotes);
                publishFw.mutate(form, {
                  onSuccess: (r) => {
                    if (r.success) {
                      setOtaMsg(`Firmware ${r.data.version} published — push it to your ESPs below.`);
                      setFwFile(null);
                      setFwVersion("");
                      setFwModel("");
                      setFwNotes("");
                      (e.target as HTMLFormElement).reset();
                    } else {
                      alert(r.error.message);
                    }
                  },
                });
              }}
            >
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Firmware .bin</span>
                <input
                  type="file"
                  accept=".bin"
                  onChange={(ev) => setFwFile(ev.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-gray-200 bg-night-900 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Version</span>
                <input
                  value={fwVersion}
                  onChange={(ev) => setFwVersion(ev.target.value)}
                  placeholder="e.g. 1.0.1"
                  className="w-full rounded-lg border border-gray-200 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Board model</span>
                <select
                  value={fwModel}
                  onChange={(ev) => setFwModel(ev.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
                >
                  <option value="">🌐 Universal (sab models)</option>
                  <option value="2CH">2CH</option>
                  <option value="4CH">4CH</option>
                  <option value="5CH">5CH</option>
                  <option value="6CH">6CH</option>
                  <option value="8CH">8CH</option>
                  <option value="4CH-IR">4CH-IR</option>
                  <option value="FAN-DIM">FAN-DIM</option>
                  <option value="DIM-3S">DIM-3S (3-step dimmer)</option>
                  <option value="DIM-4S">DIM-4S (4-step dimmer)</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Release notes (optional)</span>
                <input
                  value={fwNotes}
                  onChange={(ev) => setFwNotes(ev.target.value)}
                  placeholder="What changed in this update?"
                  className="w-full rounded-lg border border-gray-200 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={publishFw.isPending}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {publishFw.isPending ? "Uploading…" : "📤 Publish Firmware"}
                </button>
              </div>
            </form>

            {fw.data?.success && fw.data.data.versions.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Version history</p>
                <div className="space-y-2">
                  {fw.data.data.versions.map((v) => (
                    <div
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-night-900 px-4 py-2 text-sm"
                    >
                      <div>
                        <span className="font-mono font-semibold">{v.version}</span>
                        <span
                          className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                            v.isCurrent ? "border-emerald-500/40 text-emerald-400" : "border-gray-300 text-gray-500"
                          }`}
                        >
                          {v.isCurrent ? "current" : "old"}
                        </span>
                        {v.modelCode && (
                          <span className="ml-2 rounded bg-brand/20 px-2 py-0.5 text-[10px] font-bold text-brand">
                            {v.modelCode}
                          </span>
                        )}
                        {v.releaseNotes && <span className="ml-2 text-xs text-gray-500">{v.releaseNotes}</span>}
                      </div>
                      {!v.isCurrent && (
                        <button
                          onClick={() => activateFw.mutate(v.id)}
                          className="text-xs font-semibold text-brand hover:text-brand"
                        >
                          Set current
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ESP boards — ek row per physical board */}
          <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">
                🛰️ ESP Boards{" "}
                <span className="text-sm font-normal text-gray-500">
                  ({esp.data?.success ? esp.data.data.esps.length : "…"})
                </span>
              </h2>
              <button
                onClick={() => {
                  const cur = fw.data?.success ? fw.data.data.current?.version : null;
                  if (!cur) {
                    alert("No firmware published yet — upload a .bin first.");
                    return;
                  }
                  if (confirm(`Push firmware ${cur} to ALL boards?`)) {
                    pushAllM.mutate(undefined, {
                      onSuccess: (r) => r.success && setOtaMsg(`Pushed ${r.data.version} to ${r.data.count} device(s).`),
                    });
                  }
                }}
                className="rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
              >
                📤 Push to All
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <th className="py-2 pr-3">ESP Board</th>
                    <th className="py-2 pr-3">Home</th>
                    <th className="py-2 pr-3">Devices</th>
                    <th className="py-2 pr-3">IP</th>
                    <th className="py-2 pr-3">Firmware</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Last seen</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {esp.data?.success &&
                    esp.data.data.esps.map((espRow) => (
                      <>
                      <tr key={espRow.id} className="border-b border-gray-200 align-top">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2 font-medium">
                            {espRow.name ?? "ESP"}
                            <button
                              title="Board ka naam badlo"
                              onClick={() => {
                                const cur = espRow.name ?? "ESP";
                                const next = window.prompt("ESP board ka naam:", cur);
                                if (next && next.trim() && next.trim() !== cur) {
                                  renameM.mutate({ id: espRow.id, name: next.trim() }, {
                                    onSuccess: (r) => r.success && setOtaMsg(`Board renamed → ${r.data.name}`),
                                  });
                                }
                              }}
                              className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-500 hover:border-brand/40 hover:text-brand"
                            >
                              ✏️
                            </button>
                          </div>
                          <div className="font-mono text-[10px] text-gray-500">{espRow.macAddress}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                            <span>📶</span>
                            <span>{espRow.ssid ?? "—"}</span>
                          </div>
                          {espRow.serialCode && (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="rounded bg-brand/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand">
                                {espRow.serialCode}
                              </span>
                              {espRow.modelCode && (
                                <span className="rounded bg-night-700 px-1.5 py-0.5 text-[10px] text-gray-500">
                                  {espRow.modelCode}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="text-gray-600">{espRow.home.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-gray-500" title="API key prefix (full key sirf issue ke waqt dikhta hai)">
                              🔑 {espRow.home.apiKeys?.[0]?.keyPrefix ?? "no key"}
                            </span>
                            <button
                              onClick={() => issueKeyM.mutate(espRow.id)}
                              disabled={issueKeyM.isPending}
                              title="Fresh API key issue — user ko support ke liye de sakte ho"
                              className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-500 hover:border-brand/40 hover:text-brand disabled:opacity-50"
                            >
                              {issueKeyM.isPending ? "…" : "🔑 New"}
                            </button>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {espRow.devices.length === 0 && (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                            {espRow.devices.map((dev) => (
                              <span
                                key={dev.id}
                                title={`${dev.room?.name ?? ""} · ${dev.status.toUpperCase()}`}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                                  dev.status === "on"
                                    ? "border-emerald-500/40 text-emerald-400"
                                    : "border-gray-300 text-gray-500"
                                }`}
                              >
                                <span
                                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                                    dev.status === "on" ? "bg-emerald-400" : "bg-gray-600"
                                  }`}
                                />
                                {dev.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          {espRow.ipAddress ? (
                            <span className="inline-flex items-center gap-1.5">
                              <a
                                href={`http://${espRow.ipAddress}`}
                                onClick={(e) => handleIpClick(e, espRow)}
                                title={`Open ${espRow.ipAddress} (ESP web panel)`}
                                className="font-mono text-xs text-brand underline decoration-dotted underline-offset-2 hover:text-brand"
                              >
                                {espRow.ipAddress}
                              </a>
                              {probes[espRow.id]?.state === "probing" && (
                                <span
                                  title="Checking reachability…"
                                  className="inline-block h-3 w-3 animate-spin rounded-full border border-brand/40 border-t-brand"
                                />
                              )}
                              {probes[espRow.id]?.state === "ok" && (
                                <span
                                  title={`Reachable (${probes[espRow.id].latencyMs}ms)`}
                                  className="text-[10px] text-emerald-400"
                                >
                                  ●
                                </span>
                              )}
                              {probes[espRow.id]?.state === "fail" && (
                                <Badge color="border-red-500/40 text-red-400">ESP offline</Badge>
                              )}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-brand">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {espRow.firmwareVersion ?? "—"}
                          {espRow.otaPendingVersion && (
                            <Badge color="border-amber-500/40 text-amber-600">⏳ v{espRow.otaPendingVersion}</Badge>
                          )}
                          {(() => {
                            const ota =
                              liveOta[espRow.id] ??
                              (espRow.otaStatus ? { progress: espRow.otaProgress ?? 0, status: espRow.otaStatus } : null);
                            if (!ota || ota.status === "complete") {
                              return ota?.status === "complete" ? (
                                <div className="mt-1 text-[10px] text-amber-600">✓ Flashed — rebooting…</div>
                              ) : null;
                            }
                            if (ota.status === "failed") {
                              return <Badge color="border-red-500/40 text-red-400">OTA failed</Badge>;
                            }
                            return (
                              <div className="mt-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                                    <div
                                      className="h-full rounded-full bg-brand transition-all"
                                      style={{ width: `${ota.progress}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-brand">{ota.progress}%</span>
                                </div>
                                <span className="text-[10px] text-gray-500">
                                  {ota.status === "downloading" ? "Downloading…" : "Flashing…"}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            color={!espRow.offline ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}
                          >
                            {!espRow.offline ? "ONLINE" : "OFFLINE"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs text-gray-500">
                          {espRow.lastSeen ? new Date(espRow.lastSeen).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setHistFor(histFor === espRow.id ? null : espRow.id)}
                              title="Rename history dekho"
                              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-brand/40 hover:text-brand"
                            >
                              🕓
                            </button>
                            <button
                              onClick={() => {
                                const cur = fw.data?.success ? fw.data.data.current?.version : null;
                                if (!cur) {
                                  alert("No firmware published yet — upload a .bin first.");
                                  return;
                                }
                                if (espRow.devices.length === 0) {
                                  alert("This board has no linked devices yet — waiting for its first heartbeat.");
                                  return;
                                }
                                if (confirm(`Push firmware ${cur} to "${espRow.name ?? espRow.macAddress}"?`)) {
                                  pushOtaM.mutate(espRow.devices[0].id, {
                                    onSuccess: (r) => r.success && setOtaMsg(r.data.message),
                                  });
                                }
                              }}
                              disabled={pushOtaM.isPending}
                              className="rounded border border-brand/40 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/10 disabled:opacity-50"
                            >
                              📤 Push
                            </button>
                          </div>
                        </td>
                      </tr>
                      {histFor === espRow.id && (
                        <tr className="border-b border-gray-200 bg-night-900/60">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                🕓 Rename history — {espRow.name ?? espRow.macAddress}
                              </span>
                              <button
                                onClick={() => setHistFor(null)}
                                className="text-[10px] text-gray-500 hover:text-gray-600"
                              >
                                ✕ close
                              </button>
                            </div>
                            {espHist.isLoading && <p className="text-xs text-gray-500">Loading…</p>}
                            {espHist.data?.success && espHist.data.data.length === 0 && (
                              <p className="text-xs text-gray-500">Koi rename nahi hua abhi tak.</p>
                            )}
                            {espHist.data?.success && espHist.data.data.length > 0 && (
                              <div className="flex flex-col gap-2">
                                {espHist.data.data.map((ev) => (
                                  <div
                                    key={ev.id}
                                    className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-night-800 px-3 py-2 text-xs"
                                  >
                                    <span
                                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                        ev.action === "admin.esp.rename"
                                          ? "bg-amber-500/15 text-amber-600"
                                          : "bg-brand/15 text-brand"
                                      }`}
                                    >
                                      {ev.action === "admin.esp.rename" ? "ADMIN" : "USER"}
                                    </span>
                                    <span className="text-gray-600">
                                      <span className="text-gray-500 line-through decoration-gray-600">
                                        {ev.meta?.from ?? "—"}
                                      </span>
                                      {" → "}
                                      <span className="font-semibold text-night-950">{ev.meta?.to ?? "—"}</span>
                                    </span>
                                    <span className="text-gray-500">
                                      by {ev.actor?.username ?? "system"}
                                    </span>
                                    <span className="ml-auto font-mono text-[10px] text-gray-500">
                                      {new Date(ev.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </>
                    ))}
                  {esp.data?.success && esp.data.data.esps.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-sm text-gray-500">
                        No ESP boards yet — boards appear here when an ESP reports its heartbeat (MAC + WiFi + IP).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {esp.data?.success && esp.data.data.unlinked.length > 0 && (
              <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-night-900/50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                  Devices without an ESP ({esp.data.data.unlinked.length}) — koi board report nahi kar raha
                </p>
                <div className="flex flex-wrap gap-2">
                  {esp.data.data.unlinked.map((d) => (
                    <span key={d.id} className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] text-gray-500">
                      {d.name} · {d.home.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Home detail modal */}
      {viewHome && (
        <Modal title={`🏠 ${viewHome.name} — Details`} onClose={() => setViewHome(null)}>
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-gray-200 bg-night-900 p-3">
              <div className="text-xl font-bold">{viewHome._count.devices}</div>
              <div className="text-xs text-gray-500">Devices</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-night-900 p-3">
              <div className="text-xl font-bold">{viewHome._count.members}</div>
              <div className="text-xs text-gray-500">Members</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-night-900 p-3">
              <div className="text-xl font-bold">{viewHome._count.rooms}</div>
              <div className="text-xs text-gray-500">Rooms</div>
            </div>
          </div>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Owner</p>
          <p className="mb-4 text-sm">{viewHome.owner.username} · {viewHome.owner.email}</p>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Members</p>
          <div className="mb-4 space-y-1">
            {viewHome.members.map((m) => (
              <div key={m.id} className="flex justify-between rounded border border-gray-200 bg-night-900 px-3 py-1.5 text-sm">
                <span>{m.user.username}</span>
                <span className="text-xs text-gray-500">{m.role}</span>
              </div>
            ))}
          </div>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Devices</p>
          <div className="space-y-1">
            {viewHome.devices.map((d) => (
              <div key={d.id} className="flex justify-between rounded border border-gray-200 bg-night-900 px-3 py-1.5 text-sm">
                <span>{d.name} <span className="text-xs text-gray-500">#{d.id} · {d.type}</span></span>
                <span className={`text-xs font-bold uppercase ${d.status === "on" ? "text-emerald-400" : "text-gray-500"}`}>
                  {d.status}
                </span>
              </div>
            ))}
            {viewHome.devices.length === 0 && <p className="text-sm text-gray-500">No devices.</p>}
          </div>
        </Modal>
      )}

      {tab === "logs" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                🔬 Startup Diagnostics{" "}
                <span className="text-sm font-normal text-gray-500">
                  {diag.data?.success ? `PID ${diag.data.data.process.pid} · up ${fmtUptime(diag.data.data.process.uptimeSec)}` : "…"}
                </span>
              </h2>
              {diag.data?.success && diag.data.data.error && (
                <span className="text-xs text-red-400">⚠️ {diag.data.data.error}</span>
              )}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "PID", value: diag.data?.success ? String(diag.data.data.process.pid) : "—" },
                { label: "Uptime", value: diag.data?.success ? fmtUptime(diag.data.data.process.uptimeSec) : "—" },
                { label: "RSS", value: diag.data?.success ? `${diag.data.data.process.rssMB} MB` : "—" },
                { label: "Heap", value: diag.data?.success ? `${diag.data.data.process.heapMB} MB` : "—" },
                { label: "Node", value: diag.data?.success ? diag.data.data.process.node : "—" },
                {
                  label: "Requests (tail)",
                  value: diag.data?.success ? diag.data.data.stats.reqEnd.toLocaleString("en-IN") : "—",
                },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-gray-200 bg-night-900 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{c.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-night-950">{c.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-night-900 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">
                  ⏻ Exits / Restarts (tail: {diag.data?.success ? diag.data.data.stats.exitsInTail : "?"})
                </p>
                {diag.data?.success && diag.data.data.exits.length > 0 ? (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-amber-400">
                    {diag.data.data.exits.join("\n")}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-600">No exits recorded — process stable ✅</p>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 bg-night-900 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-red-500">
                  🧨 Crashes / Fatal ({diag.data?.success ? diag.data.data.crashes.length : "?"})
                </p>
                {diag.data?.success && diag.data.data.crashes.length > 0 ? (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-red-400">
                    {diag.data.data.crashes.join("\n")}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-600">No crashguard/fatal lines — clean ✅</p>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-gray-200 bg-night-900 p-3">
              <p className="mb-2 text-xs font-bold uppercase text-emerald-500">
                🚀 Boot history (last {diag.data?.success ? diag.data.data.boot.length : "?"})
              </p>
              {diag.data?.success && diag.data.data.boot.length > 0 ? (
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-emerald-300/80">
                  {diag.data.data.boot.join("\n")}
                </pre>
              ) : (
                <p className="text-xs text-gray-600">No boot lines found</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              🪵 System Logs{" "}
              <span className="text-sm font-normal text-gray-500">
                {logs.data?.success ? `${logs.data.data.totalLines} lines` : "…"}
              </span>
            </h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {logs.data?.success && logs.data.data.path && (
                <span className="max-w-[420px] truncate" title={logs.data.data.path}>
                  {logs.data.data.path}
                </span>
              )}
              <button
                onClick={async () => {
                  if (!logs.data?.success) return;
                  try {
                    await navigator.clipboard.writeText(
                      logs.data.data.lines.join(String.fromCharCode(10)),
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* clipboard blocked — ignore */
                  }
                }}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold hover:bg-gray-100"
              >
                {copied ? "✅ Copied" : "📋 Copy"}
              </button>
              <button
                onClick={() => {
                  if (!logs.data?.success) return;
                  const blob = new Blob([logs.data.data.lines.join(String.fromCharCode(10))], {
                    type: "text/plain",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "switchnest-app.log.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold hover:bg-gray-100"
              >
                ⬇️ .txt
              </button>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-logs"] })}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold hover:bg-gray-100"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {logs.data?.success && logs.data.data.crashes.length > 0 && (
            <div className="mb-3 rounded-lg border border-red-500/40 bg-red-950/40 p-3">
              <p className="mb-1 text-xs font-bold uppercase text-red-400">
                ⚠️ Crash / Error lines ({logs.data.data.crashes.length} unique)
              </p>
              <div className="max-h-40 space-y-1 overflow-auto">
                {logs.data.data.crashes.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 rounded bg-black/40 px-2 py-1">
                    <span
                      className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        c.count > 1 ? "bg-red-500/25 text-red-300" : "bg-gray-500/25 text-gray-400"
                      }`}
                      title={`${c.count} baar repeat hua`}
                    >
                      ×{c.count}
                    </span>
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-red-400">{c.line}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {logs.data?.success && logs.data.data.iisnodeLogs.length > 0 && (
            <div className="mb-3 space-y-2">
              <p className="text-xs font-bold uppercase text-amber-600">
                🧩 iisnode logs — native crash dump yahan milta hai ({logs.data.data.iisnodeLogs.length})
              </p>
              {logs.data.data.iisnodeLogs.map((f) => (
                <div key={f.path} className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2">
                  <p className="mb-1 text-[11px] text-amber-600">
                    {f.name} · {(f.size / 1024).toFixed(1)} KB
                  </p>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-amber-200/80">
                    {f.lines.join(String.fromCharCode(10))}
                  </pre>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-black/60 p-3">
            <pre className="h-[60vh] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-emerald-300">
              {logs.data?.success ? logs.data.data.lines.join(String.fromCharCode(10)) : "Loading…"}
            </pre>
          </div>
          {logs.isError && (
            <p className="mt-2 text-sm text-red-400">
              Log load failed: {logs.error instanceof Error ? logs.error.message : String(logs.error)}
            </p>
          )}
        </div>
        </div>
      )}

      {tab === "shop" && <AdminShop />}

      {findOpen && (
        <Modal title="🆘 Support lookup — find by anything" onClose={() => setFindOpen(false)}>
          <input
            autoFocus
            value={findQ}
            onChange={(e) => setFindQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (flatFind.length > 0) setFindIdx((i) => Math.min(i + 1, flatFind.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (flatFind.length > 0) setFindIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (flatFind.length > 0) {
                  const row = flatFind[Math.min(findIdx, flatFind.length - 1)];
                  setTab(row.tab);
                  setQ(findQ.trim());
                }
                setFindOpen(false);
              } else if (e.key === "Escape") {
                setFindOpen(false);
              }
            }}
            placeholder="📞 Phone / 🛒 order ID / 🔑 serial / 🖥️ MAC / naam / email…"
            className="mb-2 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <p className="mb-3 text-[11px] text-gray-500">
            Phone (orders + support msgs), order ID, serial, MAC — kuch bhi type karo, user/device context turant khulega. ↑↓ select · ↵ open · esc close
          </p>
          {findRes.isLoading && <p className="text-sm text-gray-500">Searching…</p>}
          {findRes.isError && <p className="text-sm text-red-400">Kuch galat hua — dobara try karo.</p>}
          {findRes.data?.success && flatFind.length === 0 && (
            <p className="text-sm text-gray-500">Kuch nahi mila. 😕</p>
          )}
          {findRes.data?.success && flatFind.length > 0 && (
            <div className="flex max-h-[55vh] flex-col gap-1 overflow-y-auto pr-1">
              {flatFind.map((row, i) => {
                const prev = i > 0 ? flatFind[i - 1] : null;
                const showHeader = !prev || prev.label !== row.label;
                const count = flatFind.filter((x) => x.label === row.label).length;
                const item = row.item as Record<string, unknown>;
                const active = findIdx === i;
                return (
                  <div key={`${row.label}-${String(item.id)}`}>
                    {showHeader && (
                      <div className="px-1 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        {row.icon} {row.label} ({count})
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onMouseEnter={() => setFindIdx(i)}
                        onClick={() => {
                          setTab(row.tab);
                          setQ(findQ.trim());
                          setFindOpen(false);
                        }}
                        ref={active ? (el) => { if (el) el.scrollIntoView({ block: "nearest" }); } : undefined}
                        className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                          active
                            ? "bg-brand/20 text-brand"
                            : "text-gray-700 hover:bg-night-800 hover:text-brand"
                        }`}
                      >
                        <span className="truncate font-medium">{findTitle(row.label, item)}</span>
                        <span className="ml-auto truncate text-[10px] text-gray-500">
                          {findSubtitle(row.label, item)}
                        </span>
                      </button>
                      {row.label === "Users" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatUser({ id: Number(item.id), username: String(findTitle(row.label, item)) });
                            setFindOpen(false);
                          }}
                          title="Support chat kholo"
                          className="shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-brand/10 hover:text-brand"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {tab === "support" && (
        <AdminSupport selectedUserId={supportUserId} onSelectUser={selectSupportUser} />
      )}

      {tab === "settings" && <AdminSettings />}

      {chatUser && (
        <SupportChatModal
          userId={chatUser.id}
          username={chatUser.username}
          onClose={() => setChatUser(null)}
        />
      )}
    </div>
  );
}

function DeviceSupportPanel({ deviceId }: { deviceId: number }) {
  const queryClient = useQueryClient();
  const support = useQuery({
    queryKey: ["admin-device-support", deviceId],
    queryFn: () => getDeviceSupport(deviceId),
    refetchInterval: 8000,
  });
  const setStatus = useMutation({
    mutationFn: (status: "on" | "off") => adminSetDeviceStatus(deviceId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-device-support", deviceId] });
      queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
    },
  });
  const clearCmds = useMutation({
    mutationFn: () => clearDeviceCommands(deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-device-support", deviceId] }),
  });
  const ota = useMutation({
    mutationFn: () => pushOta(deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-device-support", deviceId] }),
  });

  if (support.isLoading) return <div className="px-4 py-3 text-xs text-gray-500">Loading support data…</div>;
  if (!support.data?.success || !support.data.data) {
    return <div className="px-4 py-3 text-xs text-red-400">Failed to load device support data.</div>;
  }

  const d = support.data.data;
  const pending = d.commands.filter((c) => c.status === "pending").length;

  return (
    <div className="border-t border-gray-200 bg-night-900 px-4 py-4 text-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-gray-600">🛠️ Support: {d.name}</span>
        <Badge color={d.status === "on" ? "border-emerald-500/40 text-emerald-400" : "border-gray-300 text-gray-500"}>{d.status}</Badge>
        <Badge color={d.online ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>
          {d.online ? "ONLINE" : "OFFLINE"}
        </Badge>
        {pending > 0 && <Badge color="border-amber-500/40 text-amber-600">{pending} pending cmd</Badge>}
        <span className="ml-auto flex gap-2">
          <button type="button" disabled={setStatus.isPending} onClick={() => setStatus.mutate("on")}
            className="rounded-lg border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">⏻ ON</button>
          <button type="button" disabled={setStatus.isPending} onClick={() => setStatus.mutate("off")}
            className="rounded-lg border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50">⏻ OFF</button>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-gray-200 bg-night-800 p-3 text-xs md:grid-cols-4">
        <Info label="ID" value={`#${d.id}`} />
        <Info label="Type" value={d.type} />
        <Info label="Serial" value={d.serialNumber ?? "—"} />
        <Info label="Firmware" value={d.firmwareVersion ?? "—"} />
        <Info label="IP" value={d.ipAddress ?? "—"} />
        <Info label="Last seen" value={d.lastSeen ? new Date(d.lastSeen).toLocaleString() : "—"} />
        <Info label="Home" value={`${d.home.name} (${d.home.owner.username})`} />
        <Info label="Room" value={d.room?.name ?? "—"} />
        {d.home.apiKeys[0] && <Info label="API key" value={`${d.home.apiKeys[0].keyPrefix}…`} />}
        <Info label="Owner email" value={d.home.owner.email} />
      </div>
      {d.esp && (
        <div className="mt-3 rounded-lg border border-sky-500/30 bg-night-800 p-3 text-xs">
          <div className="mb-2 font-semibold text-sky-400">🔌 ESP Board {d.esp.name ? `· ${d.esp.name}` : ""}</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
            <Info label="MAC" value={d.esp.macAddress} />
            <Info label="SSID" value={d.esp.ssid ?? "—"} />
            <Info label="Model" value={d.esp.modelCode ?? "—"} />
            <Info label="Serial" value={d.esp.serialCode ?? "—"} />
            <Info label="IP" value={d.esp.ipAddress ?? "—"} />
            <Info label="FW" value={d.esp.firmwareVersion ?? "—"} />
            <Info label="Board last seen" value={d.esp.lastSeen ? new Date(d.esp.lastSeen).toLocaleString() : "—"} />
            <Info label="OTA" value={d.esp.otaStatus ?? (d.esp.otaProgress != null ? `${d.esp.otaProgress}%` : "—")} />
          </div>
          <div className="mt-3 border-t border-sky-500/20 pt-2">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span>⚡ Live relay states <span className="text-gray-600">(board heartbeat se sync, ~30s)</span></span>
              <Badge
                color={
                  d.esp.lastSeen && Date.now() - new Date(d.esp.lastSeen).getTime() < 120_000
                    ? "border-emerald-500/40 text-emerald-400"
                    : "border-red-500/40 text-red-400"
                }
              >
                {d.esp.lastSeen && Date.now() - new Date(d.esp.lastSeen).getTime() < 120_000 ? "BOARD ONLINE" : "BOARD OFFLINE"}
              </Badge>
            </div>
            {d.esp.devices.length === 0 ? (
              <p className="text-[11px] text-gray-600">
                Is board se koi device link nahi hai — heartbeat aane pe link ho jayega.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {d.esp.devices.map((dv, i) => (
                  <div
                    key={dv.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
                      dv.status === "on" ? "border-emerald-500/40 bg-emerald-500/10" : "border-gray-200 bg-night-900"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-gray-500">R{i}</span>
                    <span className="text-xs font-semibold text-gray-600">{dv.name}</span>
                    <span className={`text-[10px] font-bold uppercase ${dv.status === "on" ? "text-emerald-400" : "text-gray-500"}`}>
                      {dv.status === "on" ? "ON" : "OFF"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-night-800 p-3">
          <div className="mb-2 text-xs font-semibold text-gray-600">📨 Commands (last 20)</div>
          {d.commands.length === 0 && <p className="text-xs text-gray-600">No commands yet.</p>}
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {d.commands.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded bg-night-900 px-2 py-1 text-[11px]">
                <span className="font-mono text-gray-500">{c.command}</span>
                <span className="flex items-center gap-2">
                  <Badge
                    color={
                      c.status === "executed"
                        ? "border-emerald-500/40 text-emerald-400"
                        : c.status === "pending"
                          ? "border-amber-500/40 text-amber-600"
                          : "border-gray-300 text-gray-500"
                    }
                  >
                    {c.status}
                  </Badge>
                  <span className="text-gray-600">{new Date(c.createdAt).toLocaleTimeString()}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-night-800 p-3">
          <div className="mb-2 text-xs font-semibold text-gray-600">📜 Device Logs (last 20)</div>
          {d.logs.length === 0 && <p className="text-xs text-gray-600">No logs yet.</p>}
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {d.logs.map((l) => (
              <div key={l.id} className="rounded bg-night-900 px-2 py-1 text-[11px]">
                <span className="text-gray-500">{new Date(l.createdAt).toLocaleString()}</span>
                <span className="ml-2 text-gray-600">{l.logMessage}</span>
                {l.actor && <span className="ml-1 text-gray-600">by {l.actor.username}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={clearCmds.isPending} onClick={() => clearCmds.mutate()}
          className="rounded-lg border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-500/10 disabled:opacity-50">
          🧹 Clear stuck commands{clearCmds.data?.success ? ` (cleared ${clearCmds.data.data.cleared})` : ""}
        </button>
        <button type="button" disabled={ota.isPending} onClick={() => ota.mutate()}
          className="rounded-lg border border-sky-500/40 px-3 py-1 text-xs font-semibold text-sky-400 hover:bg-sky-500/10 disabled:opacity-50">
          🚀 Push OTA update{ota.data?.success ? ` → ${ota.data.data.version}` : ""}
        </button>
        <span className="text-[11px] text-gray-600">ON/OFF → command enqueue (board agle poll pe apply karega, ~5-10s)</span>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="truncate">
      <span className="text-gray-600">{label}: </span>
      <span className="text-gray-600">{value}</span>
    </div>
  );
}

function subtitleFor(section: string, item: unknown): string {
  const it = item as {
    email?: string;
    status?: string;
    username?: string;
    serialNumber?: string | null;
    serialCode?: string | null;
    macAddress?: string;
    ipAddress?: string | null;
    offline?: boolean;
    paymentStatus?: string;
    modelCode?: string | null;
    product?: { name?: string } | null;
    home?: { name?: string } | null;
    owner?: { username?: string } | null;
  };
  switch (section) {
    case "Users":
      return `${it.email ?? ""} · ${it.status ?? ""}`;
    case "Homes":
      return `${it.owner?.username ?? ""} · ${it.status ?? ""}`;
    case "Devices":
      return `${it.serialNumber ?? ""} · ${it.home?.name ?? ""}`;
    case "ESP Boards":
      return `${it.serialCode ?? it.ipAddress ?? ""} · ${it.offline ? "offline" : "online"}`;
    case "Orders":
      return `${it.paymentStatus ?? ""}`;
    case "Serials":
      return `${it.product?.name ?? ""} · ${it.status ?? ""}`;
    default:
      return "";
  }
}

/** Support lookup — result title. */
function findTitle(section: string, item: unknown): string {
  const it = item as {
    username?: string;
    orderNumber?: string;
    shippingName?: string;
    serialCode?: string;
    name?: string;
    subject?: string;
    reason?: string;
    macAddress?: string;
  };
  switch (section) {
    case "Users":
      return it.username ?? "";
    case "Orders":
      return it.orderNumber ?? "";
    case "Serials":
      return it.serialCode ?? "";
    case "ESP Boards":
      return `${it.name ?? it.macAddress ?? ""} · ${it.serialCode ?? ""}`;
    case "Devices":
      return it.name ?? "";
    case "Support msgs":
      return it.subject ?? "";
    case "Warranty claims":
      return `${it.serialCode ?? ""} — ${it.reason ?? ""}`;
    default:
      return "";
  }
}

/** Support lookup — result subtitle (context). */
function findSubtitle(section: string, item: unknown): string {
  const it = item as {
    email?: string | null;
    role?: string;
    status?: string;
    shippingPhone?: string;
    shippingName?: string;
    user?: { username?: string } | null;
    product?: { name?: string } | null;
    order?: { orderNumber?: string } | null;
    home?: { name?: string; owner?: { username?: string } | null } | null;
    offline?: boolean;
    modelCode?: string | null;
    phone?: string | null;
    type?: string;
    warrantyStatus?: string;
    name?: string;
  };
  switch (section) {
    case "Users":
      return `${it.email ?? ""} · ${it.role ?? ""}`;
    case "Orders":
      return `${it.shippingName ?? ""} ${it.shippingPhone ?? ""} · ${it.user?.username ?? ""}`;
    case "Serials":
      return `${it.product?.name ?? ""} · ${it.status ?? ""} · ${it.user?.username ?? ""}`;
    case "ESP Boards":
      return `${it.modelCode ?? ""} · ${it.offline ? "offline" : "online"} · ${it.home?.owner?.username ?? ""}`;
    case "Devices":
      return `${it.type ?? ""} · ${it.home?.name ?? ""} · ${it.home?.owner?.username ?? ""}`;
    case "Support msgs":
      return `${it.phone ?? it.email ?? ""} · ${it.status ?? ""}`;
    case "Warranty claims":
      return `${it.warrantyStatus ?? ""} · ${it.user?.username ?? ""}`;
    default:
      return "";
  }
}
