import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMyBoards, renameEsp, setEspLed, setDeviceStatus, updateDevice, type MyBoard } from "../api/devices";
import { Switch } from "../components/Switch";
import { historyEvent } from "../lib/boardHistory";

const TYPE_ICONS: Record<string, string> = {
  bulb: "💡",
  fan: "🌀",
  ac: "❄️",
  tv: "📺",
  plug: "🔌",
  custom: "⚙️",
};

function fullDate(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isBoardOnline(b: MyBoard): boolean {
  if (b.offline) return false;
  if (!b.lastSeen) return false;
  return Date.now() - new Date(b.lastSeen).getTime() < 120_000;
}

function lastSeenText(ts: string | null): string {
  if (!ts) return "kabhi nahi";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "abhi";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min pehle`;
  return `${Math.floor(diff / 3_600_000)}h pehle`;
}

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    "Kuch galat ho gaya"
  );
}

/** Copyable field — click to copy, shows ✓ feedback. */
function CopyField({ value, hint }: { value: string; hint?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <code className="select-all rounded bg-night-900 px-2 py-0.5 font-mono text-[11px] text-brand">
        {value}{hint ? ` (${hint})` : ""}
      </code>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400 hover:border-brand hover:text-brand"
      >
        {copied ? "✓" : "📋"}
      </button>
    </div>
  );
}

export function MyBoards() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedMac, setCopiedMac] = useState<number | null>(null);
  const [draftName, setDraftName] = useState<string>("");
  const [renamingId, setRenamingId] = useState<number | null>(null);

  const boards = useQuery({
    queryKey: ["my-boards"],
    queryFn: listMyBoards,
    refetchInterval: 10_000,
  });

  const toggle = useMutation({
    mutationFn: ({
      homeId,
      deviceId,
      status,
    }: {
      homeId: number;
      deviceId: number;
      status: "on" | "off";
    }) => setDeviceStatus(homeId, deviceId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-boards"] }),
    onError: (e) => setError(errMsg(e)),
  });

  const led = useMutation({
    mutationFn: ({ homeId, espId, enabled }: { homeId: number; espId: number; enabled: boolean }) =>
      setEspLed(homeId, espId, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-boards"] }),
    onError: (e) => setError(errMsg(e)),
  });

  const rename = useMutation({
    mutationFn: ({ homeId, espId, name }: { homeId: number; espId: number; name: string }) =>
      renameEsp(homeId, espId, name),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["my-boards"] });
    },
    onError: (e) => setError(errMsg(e)),
  });

  const assignCh = useMutation({
    mutationFn: ({ homeId, deviceId, espId, channel }: { homeId: number; deviceId: number; espId: number | null; channel: number | null }) =>
      updateDevice(homeId, deviceId, { espId, channel }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["my-boards"] });
    },
    onError: (e) => setError(errMsg(e)),
  });

  const groups = boards.data?.success ? boards.data.data : [];
  const totalBoards = groups.reduce((n, g) => n + g.boards.length, 0);
  const onlineCount = groups.reduce(
    (n, g) => n + g.boards.filter((b) => isBoardOnline(b)).length,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">🛰️ My Boards</h1>
          <p className="mt-1 text-sm text-gray-500">
            Saare ESP boards ek jagah — firmware, status aur devices ke saath
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full border border-gray-200 bg-night-800 px-4 py-1.5 font-semibold">
            📡 {totalBoards} board{totalBoards === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 font-semibold text-emerald-400">
            ● {onlineCount} online
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      {boards.isLoading && <p className="text-gray-500">Boards load ho rahe hain…</p>}

      {!boards.isLoading && groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-night-800 p-10 text-center text-gray-500">
          <span className="text-3xl">🛡️</span>
          <p className="mt-4 text-lg font-medium text-gray-300">No Hardware Access</p>
          <span className="text-sm mt-2 max-w-sm mx-auto block leading-relaxed">
            You must be an <b>Owner</b> or <b>Admin</b> of a home to view, configure, and manage its physical SwitchNest hardware boards.
          </span>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.homeId} className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            🏠 {g.homeName}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {g.role}
            </span>
            <span className="text-xs font-normal text-gray-500">
              {g.boards.length} board{g.boards.length === 1 ? "" : "s"}
            </span>
          </h2>

          {g.boards.length === 0 && (
            <p className="text-sm text-gray-500">Is home me koi board nahi hai.</p>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {g.boards.map((b) => {
              const online = isBoardOnline(b);
              const canRename = g.role === "owner" || g.role === "admin";
              const boardName = b.name ?? b.serialCode ?? `ESP-${b.macAddress.slice(-6).toUpperCase()}`;
              return (
                <div
                  key={b.id}
                  className={`flex flex-col gap-4 rounded-xl border p-5 ${online
                    ? "border-emerald-500/30 bg-night-800"
                    : "border-red-500/30 bg-night-800/70"
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">🛰️</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{boardName}</span>
                          {canRename && (
                            <button
                              onClick={() => {
                                const name = window.prompt(
                                  "Board ka naya naam (unique hona chahiye):",
                                  boardName,
                                );
                                if (name && name.trim())
                                  rename.mutate({ homeId: g.homeId, espId: b.id, name: name.trim() });
                              }}
                              title="Board rename karo"
                              className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500 hover:border-brand hover:text-brand"
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                        {b.serialCode && (
                          <span className="text-xs text-gray-500">{b.serialCode}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${online
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                          }`}
                      >
                        {online ? "● online" : "○ offline"}
                      </span>
                      <button
                        onClick={() => {
                          setExpandedId(expandedId === b.id ? null : b.id);
                          if (expandedId !== b.id) setRenamingId(null);
                        }}
                        title={expandedId === b.id ? "Detail band karo" : "Detail dekho"}
                        className={`rounded-lg border px-2 py-1 text-xs transition ${expandedId === b.id
                          ? "border-brand bg-brand/15 text-brand"
                          : "border-gray-200 text-gray-500 hover:border-brand hover:text-brand"
                          }`}
                      >
                        {expandedId === b.id ? "▴" : "▾"} Detail
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <button
                      onClick={() =>
                        led.mutate({ homeId: g.homeId, espId: b.id, enabled: !b.ledEnabled })
                      }
                      disabled={!online || (led.isPending && led.variables?.espId === b.id)}
                      title="Status LED toggle for this board"
                      className={`rounded-lg border px-2.5 py-1 font-bold shadow-sm transition disabled:opacity-40 ${b.ledEnabled !== false
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30"
                        : "border-gray-300/40 bg-night-900 text-gray-400 hover:border-brand hover:text-brand"
                        }`}
                    >
                      💡 LED {b.ledEnabled !== false ? "ON" : "OFF"}
                    </button>
                    {b.modelCode && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                        {b.modelCode}
                      </span>
                    )}
                    {b.firmwareVersion && (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 font-semibold text-brand">
                        FW v{b.firmwareVersion}
                      </span>
                    )}
                    {b.ipAddress && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                        🌐 {b.ipAddress}
                      </span>
                    )}
                    {b.ssid && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                        📶 {b.ssid}
                      </span>
                    )}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
                      🕒 {lastSeenText(b.lastSeen)}
                    </span>
                  </div>

                  {expandedId === b.id && (
                    <div className="flex flex-col gap-4 rounded-lg border border-gray-200/60 bg-night-900/70 p-4">
                      {/* Board ki info grid — firmware / IP / MAC / timestamps */}
                      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            MAC Address
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-brand">{b.macAddress}</span>
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(b.macAddress);
                                  setCopiedMac(b.id);
                                  setTimeout(() => setCopiedMac(null), 1500);
                                } catch {
                                  /* clipboard unavailable */
                                }
                              }}
                              title="MAC copy karo"
                              className="rounded border border-gray-200 px-1 py-0.5 text-[10px] text-gray-400 hover:border-brand hover:text-brand"
                            >
                              {copiedMac === b.id ? "✓" : "📋"}
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            IP Address
                          </p>
                          <p className="font-mono text-xs">{b.ipAddress ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            WiFi (SSID)
                          </p>
                          <p className="text-xs">📶 {b.ssid ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            Model
                          </p>
                          <p className="text-xs">🎛 {b.modelCode ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            Firmware
                          </p>
                          <p className="text-xs">📦 FW v{b.firmwareVersion ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            Last Seen
                          </p>
                          <p className="text-xs" title={fullDate(b.lastSeen)}>
                            {lastSeenText(b.lastSeen)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            Registered
                          </p>
                          <p className="text-xs">{fullDate(b.createdAt ?? null)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            Serial
                          </p>
                          <p className="font-mono text-xs">{b.serialCode ?? "—"}</p>
                        </div>
                      </div>

                      {/* 🔑 Connection Info — API Key + Hotspot + Webserver */}
                      <div className="rounded-lg border border-brand/20 bg-brand/5 p-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-brand">
                          🔗 Connection Info
                        </p>
                        <div className="space-y-2 text-xs">
                          {/* API Key */}
                          {g.apiKey && (
                            <div className="flex items-center gap-2">
                              <span className="w-24 shrink-0 text-gray-500">🔑 API Key</span>
                              <CopyField
                                value={g.apiKey.keyPrefix}
                                label="Copied!"
                                hint="prefix"
                              />
                              {g.apiKey.expiresAt && (
                                <span className="shrink-0 text-[10px] text-gray-500">
                                  ⏳ {new Date(g.apiKey.expiresAt).toLocaleDateString("en-IN")}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Hotspot */}
                          {b.hotspotName && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="w-24 shrink-0 text-gray-500">📶 Hotspot</span>
                                <CopyField value={b.hotspotName} label="Copied!" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-24 shrink-0 text-gray-500">🔒 Password</span>
                                <CopyField value={b.hotspotPassword ?? ""} label="Copied!" />
                              </div>
                            </>
                          )}
                          {/* Webserver Login */}
                          <div className="flex items-center gap-2">
                            <span className="w-24 shrink-0 text-gray-500">🌐 Webserver</span>
                            <span className="text-gray-400">192.168.4.1 · admin / admin</span>
                          </div>
                        </div>
                      </div>

                      {/* Inline rename — detail panel ke andar hi */}
                      {canRename && (
                        <div className="border-t border-gray-200/50 pt-3">
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            Rename Board
                          </p>
                          {renamingId === b.id ? (
                            <form
                              className="flex gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (draftName.trim()) {
                                  rename.mutate({ homeId: g.homeId, espId: b.id, name: draftName.trim() });
                                  setRenamingId(null);
                                  setDraftName("");
                                }
                              }}
                            >
                              <input
                                autoFocus
                                value={draftName}
                                onChange={(e) => setDraftName(e.target.value)}
                                placeholder="Board ka naya naam…"
                                className="flex-1 rounded-lg border border-gray-200 bg-night-800 px-3 py-1.5 text-sm outline-none focus:border-brand"
                              />
                              <button
                                type="submit"
                                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingId(null)}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200"
                              >
                                Cancel
                              </button>
                            </form>
                          ) : (
                            <button
                              onClick={() => {
                                setRenamingId(b.id);
                                setDraftName(boardName);
                              }}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400 transition hover:border-brand hover:text-brand"
                            >
                              ✏️ Naam badlo
                            </button>
                          )}
                        </div>
                      )}

                      {/* Activity timeline — rename / OTA / key events */}
                      <div className="border-t border-gray-200/50 pt-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          Activity History
                        </p>
                        {b.history.length === 0 ? (
                          <p className="text-xs text-gray-500">Abhi koi activity nahi — rename, OTA ya key events yahan dikhenge.</p>
                        ) : (
                          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                            {b.history.map((ev) => {
                              const h = historyEvent(ev);
                              return (
                                <li key={ev.id} className="flex items-start gap-2 text-xs">
                                  <span className="mt-0.5 shrink-0">{h.icon}</span>
                                  <div className="min-w-0">
                                    <p className="text-gray-200">
                                      {h.label}
                                      {h.detail && <span className="text-gray-500"> — {h.detail}</span>}
                                    </p>
                                    <p className="text-[10px] text-gray-500">
                                      {ev.actor ? `${ev.actor} · ` : ""}
                                      {lastSeenText(ev.createdAt)}
                                    </p>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2 border-t border-gray-200/30 pt-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                      ⚙️ Physical Relays (Cloud Mapping)
                    </p>
                    {Array.from({ length: b.modelCode === "sn-r2" ? 2 : b.modelCode === "sn-r1" ? 1 : 4 }, (_, i) => i + 1).map((ch) => {
                      const d = b.devices.find((dev) => dev.channel === ch);
                      return (
                        <div
                          key={ch}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-gray-200/50 bg-night-900/40 p-3 sm:flex-row sm:items-center"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex w-12 shrink-0 items-center justify-center rounded bg-brand/10 px-2 py-1 text-xs font-bold text-brand">
                              CH {ch}
                            </span>
                            {d ? (
                              <span className="flex items-center gap-2 text-sm text-gray-200">
                                <span>{TYPE_ICONS[d.type] ?? "⚙️"}</span>
                                <span className="font-semibold">{d.name}</span>
                                {d.offline && (
                                  <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-400">
                                    offline
                                  </span>
                                )}
                              </span>
                            ) : canRename ? (
                              <select
                                className="w-48 appearance-none rounded-lg border border-gray-200/50 bg-night-800 p-2 text-xs font-medium text-gray-400 outline-none focus:border-brand"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    assignCh.mutate({ homeId: g.homeId, deviceId: Number(e.target.value), espId: b.id, channel: ch });
                                  }
                                }}
                                disabled={assignCh.isPending}
                                value=""
                              >
                                <option value="" disabled>+ Assign Unmapped Device</option>
                                {g.unassignedDevices.map((ud) => (
                                  <option key={ud.id} value={ud.id}>
                                    {TYPE_ICONS[ud.type]} {ud.name}
                                  </option>
                                ))}
                                {g.unassignedDevices.length === 0 && (
                                  <option disabled>No free devices. Create one first.</option>
                                )}
                              </select>
                            ) : (
                              <span className="text-gray-500 italic text-[11px]">Unmapped</span>
                            )}
                          </div>

                          {d && (
                            <div className="flex flex-wrap items-center gap-2">

                              <Switch
                                checked={d.status === "on"}
                                onChange={() =>
                                  toggle.mutate({
                                    homeId: g.homeId,
                                    deviceId: d.id,
                                    status: d.status === "on" ? "off" : "on",
                                  })
                                }
                                disabled={toggle.isPending}
                                label="Toggle"
                              />

                              {/* Unmap Button */}
                              {canRename && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`${d.name} ko sach me Channel ${ch} se hatana hai?`)) {
                                      assignCh.mutate({ homeId: g.homeId, deviceId: d.id, espId: null, channel: null });
                                    }
                                  }}
                                  disabled={assignCh.isPending}
                                  title="Remove from Board"
                                  className="ml-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] uppercase text-red-500 transition hover:bg-red-500 hover:text-white"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section >
      ))
      }
    </div >
  );
}
