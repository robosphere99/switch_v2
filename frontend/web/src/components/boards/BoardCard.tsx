import { useState } from "react";
import type { MyBoard } from "../../api/devices";
import { Switch } from "../Switch";
import { historyEvent } from "../../lib/boardHistory";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ChevronDown, ChevronUp, Copy, Check, Edit2, Lightbulb, Wifi, Key } from "lucide-react";

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

export function isBoardOnline(b: MyBoard): boolean {
  if (b.offline) return false;
  if (!b.lastSeen) return false;
  return Date.now() - new Date(b.lastSeen).getTime() < 120_000;
}

function lastSeenText(ts: string | null): string {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function CopyField({ value, hint }: { value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <code className="select-all rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-xs font-semibold text-brand">
        {value}{hint ? ` (${hint})` : ""}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="rounded p-1 text-slate-400 hover:text-brand transition-colors"
        title="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export interface BoardCardProps {
  board: MyBoard;
  homeId: number;
  role: string;
  unassignedDevices: { id: number; name: string; type: string }[];
  apiKey?: { keyPrefix: string; expiresAt: string | null } | null;
  onRename: (name: string) => void;
  onToggleLed: (enabled: boolean) => void;
  isLedPending: boolean;
  onToggleDevice: (deviceId: number, currentStatus: "on" | "off") => void;
  isTogglePending: boolean;
  onAssignChannel: (deviceId: number, channel: number | null) => void;
  isAssignPending: boolean;
}

export function BoardCard({
  board: b,
  homeId: _homeId,
  role,
  unassignedDevices,
  apiKey,
  onRename,
  onToggleLed,
  isLedPending,
  onToggleDevice,
  isTogglePending,
  onAssignChannel,
  isAssignPending,
}: BoardCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [copiedMac, setCopiedMac] = useState(false);

  const online = isBoardOnline(b);
  const canManage = role === "owner" || role === "admin";
  const boardName = b.name ?? b.serialCode ?? `ESP-${b.macAddress.slice(-6).toUpperCase()}`;

  return (
    <div
      id={`board-${b.id}`}
      className={`rounded-2xl border transition-all duration-200 bg-white p-5 shadow-sm dark:bg-slate-900 ${
        online
          ? "border-slate-200 dark:border-slate-800"
          : "border-slate-200/70 dark:border-slate-800/60 opacity-90"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 dark:bg-brand/15 text-brand">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white text-base">
                {boardName}
              </span>
              {canManage && !renaming && (
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(true);
                    setDraftName(boardName);
                  }}
                  title="Rename board"
                  className="rounded-lg p-1 text-slate-400 hover:text-brand transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {b.serialCode && (
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                {b.serialCode}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={online ? "success" : "neutral"} dot>
            {online ? "Online" : "Offline"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            rightIcon={expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          >
            Details
          </Button>
        </div>
      </div>

      {/* Pill attributes */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => onToggleLed(b.ledEnabled === false)}
          disabled={!online || isLedPending}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
            b.ledEnabled !== false
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          LED {b.ledEnabled !== false ? "ON" : "OFF"}
        </button>

        {b.modelCode && (
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {b.modelCode}
          </span>
        )}
        {b.firmwareVersion && (
          <span className="rounded-lg bg-brand/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-brand">
            v{b.firmwareVersion}
          </span>
        )}
        {b.ipAddress && (
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {b.ipAddress}
          </span>
        )}
        <span className="text-[11px] text-slate-400">
          Seen {lastSeenText(b.lastSeen)}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          {/* Board info grid */}
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">MAC Address</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="font-mono text-xs text-brand font-semibold">{b.macAddress}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(b.macAddress);
                      setCopiedMac(true);
                      setTimeout(() => setCopiedMac(false), 1500);
                    } catch {}
                  }}
                  className="rounded p-0.5 text-slate-400 hover:text-brand"
                  title="Copy MAC"
                >
                  {copiedMac ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
            <div>
              <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">IP Address</p>
              <p className="mt-0.5 font-mono text-xs text-slate-700 dark:text-slate-300">{b.ipAddress ?? "—"}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">WiFi SSID</p>
              <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">{b.ssid ?? "—"}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">Model</p>
              <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">{b.modelCode ?? "—"}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">Firmware</p>
              <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">{b.firmwareVersion ? `v${b.firmwareVersion}` : "—"}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">Last Seen</p>
              <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300" title={fullDate(b.lastSeen)}>
                {lastSeenText(b.lastSeen)}
              </p>
            </div>
          </div>

          {/* Connection info */}
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 dark:bg-brand/10">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              Connection Credentials
            </p>
            <div className="space-y-2 text-xs">
              {apiKey && (
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-slate-500 font-medium">API Key</span>
                  <CopyField value={apiKey.keyPrefix} hint="prefix" />
                </div>
              )}
              {b.hotspotName && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-slate-500 font-medium">Hotspot SSID</span>
                    <CopyField value={b.hotspotName} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-slate-500 font-medium">Password</span>
                    <CopyField value={b.hotspotPassword ?? ""} />
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-slate-500 font-medium">Local Gateway</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">192.168.4.1 (admin / admin)</span>
              </div>
            </div>
          </div>

          {/* Inline Rename Form */}
          {canManage && renaming && (
            <form
              className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800"
              onSubmit={(e) => {
                e.preventDefault();
                if (draftName.trim()) {
                  onRename(draftName.trim());
                  setRenaming(false);
                }
              }}
            >
              <Input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="New board name..."
                className="flex-1"
              />
              <Button type="submit" size="sm" variant="primary">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
            </form>
          )}

          {/* Activity timeline */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Activity History
            </p>
            {b.history.length === 0 ? (
              <p className="text-xs text-slate-400">No recorded activity for this board yet.</p>
            ) : (
              <ul className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {b.history.map((ev) => {
                  const h = historyEvent(ev);
                  return (
                    <li key={ev.id} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 shrink-0 text-slate-400">{h.icon}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700 dark:text-slate-200">
                          {h.label}
                          {h.detail && <span className="font-normal text-slate-400"> — {h.detail}</span>}
                        </p>
                        <p className="text-[10px] text-slate-400">
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

      {/* Physical Relays Section */}
      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800 space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Relay Mapping
        </p>
        {Array.from({ length: b.modelCode === "sn-r2" ? 2 : b.modelCode === "sn-r1" ? 1 : 4 }, (_, i) => i + 1).map((ch) => {
          const d = b.devices.find((dev) => dev.channel === ch);
          return (
            <div
              key={ch}
              className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 sm:flex-row sm:items-center dark:border-slate-800/70 dark:bg-slate-800/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex w-12 shrink-0 items-center justify-center rounded-lg bg-brand/10 px-2 py-1 text-xs font-bold text-brand">
                  CH {ch}
                </span>
                {d ? (
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                    <span>{TYPE_ICONS[d.type] ?? "⚙️"}</span>
                    <span>{d.name}</span>
                    {d.offline && (
                      <Badge variant="danger" size="sm">
                        offline
                      </Badge>
                    )}
                  </span>
                ) : canManage ? (
                  <select
                    className="w-48 appearance-none rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    onChange={(e) => {
                      if (e.target.value) {
                        onAssignChannel(Number(e.target.value), ch);
                      }
                    }}
                    disabled={isAssignPending}
                    value=""
                  >
                    <option value="" disabled>+ Assign Device</option>
                    {unassignedDevices.map((ud) => (
                      <option key={ud.id} value={ud.id}>
                        {TYPE_ICONS[ud.type]} {ud.name}
                      </option>
                    ))}
                    {unassignedDevices.length === 0 && (
                      <option disabled>No free devices available</option>
                    )}
                  </select>
                ) : (
                  <span className="text-xs text-slate-400 italic">Unmapped</span>
                )}
              </div>

              {d && (
                <div className="flex items-center gap-3">
                  <Switch
                    checked={d.status === "on"}
                    onChange={() => onToggleDevice(d.id, d.status)}
                    disabled={isTogglePending}
                    label="Toggle"
                  />
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to unmap ${d.name} from Channel ${ch}?`)) {
                          onAssignChannel(d.id, null);
                        }
                      }}
                      disabled={isAssignPending}
                      title="Unmap device"
                      className="rounded-lg border border-red-200 p-1.5 text-xs text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
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
}
