import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Device } from "@robosphere/shared";
import {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type ScheduleWithDevice,
} from "../api/schedules";

const TYPE_LABELS: Record<string, string> = {
  once: "Once",
  daily: "Daily",
  weekly: "Weekly",
  cron: "Cron",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format a Date as a `datetime-local` input value (local time, minute precision). */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Human-friendly label, e.g. "Thu, Aug 13, 08:00 AM". */
function formatFriendly(d: Date): string {
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** One-tap time presets — no manual date/time typing needed. */
const QUICK_TIMES: { label: string; date: () => Date }[] = [
  { label: "⏱ +5 min", date: () => new Date(Date.now() + 5 * 60 * 1000) },
  { label: "⏱ +1 hour", date: () => new Date(Date.now() + 60 * 60 * 1000) },
  {
    label: "🌙 Tonight 9 PM",
    date: () => {
      const d = new Date();
      d.setHours(21, 0, 0, 0);
      return d;
    },
  },
  {
    label: "🌅 Tomorrow 9 AM",
    date: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

export function ScheduleSection({
  homeId,
  devices,
  canManage,
}: {
  homeId: number;
  devices: Device[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    deviceId: "",
    action: "on" as "on" | "off",
    type: "once" as "once" | "daily" | "weekly" | "cron",
    runAt: "",
    cron: "",
  });
  const [error, setError] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const schedules = useQuery({
    queryKey: ["schedules", homeId],
    queryFn: () => listSchedules(homeId),
    enabled: homeId !== null,
    refetchInterval: 15_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["schedules", homeId] });
  };

  const create = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof createSchedule>[1] = {
        deviceId: Number(form.deviceId),
        action: form.action,
        type: form.type,
      };
      if (form.type === "cron") {
        payload.cron = form.cron.trim() || null;
      } else {
        payload.runAt = form.runAt ? new Date(form.runAt).toISOString() : null;
      }
      return createSchedule(homeId, payload);
    },
    onSuccess: () => {
      setForm({ deviceId: "", action: "on", type: "once", runAt: "", cron: "" });
      setError("");
      invalidate();
    },
    onError: () => setError("Failed to create schedule — check the time/cron format"),
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ sched, enabled }: { sched: ScheduleWithDevice; enabled: boolean }) =>
      updateSchedule(homeId, sched.id, { enabled }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteSchedule(homeId, id),
    onSuccess: invalidate,
  });

  const list = schedules.data?.success ? schedules.data.data : [];
  const cronInvalid =
    form.type === "cron" && form.cron.trim().split(/\s+/).length !== 5;
  const pastOnce =
    form.type === "once" && !!form.runAt && new Date(form.runAt).getTime() < Date.now();

  return (
    <div className="rounded-xl border border-brand/20 bg-night-800 p-5">
      <h2 className="mb-1 font-semibold">⏰ Timers &amp; Schedules</h2>
      <p className="mb-4 text-xs text-gray-500">
        Auto turn devices on/off at set times. ESP32 picks up commands within seconds.
      </p>

      {canManage && (
        <div className="mb-5 rounded-lg border border-gray-200 bg-night-900 p-4">
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <select
              value={form.deviceId}
              onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
              className="rounded-lg border border-brand/20 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Select device…</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as typeof form.type })
                }
                className="rounded-lg border border-brand/20 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                {(Object.keys(TYPE_LABELS) as Array<keyof typeof TYPE_LABELS>).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <select
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value as "on" | "off" })}
                className="rounded-lg border border-brand/20 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="on">Turn ON</option>
                <option value="off">Turn OFF</option>
              </select>
            </div>
          </div>

          {form.type === "cron" ? (
            <input
              value={form.cron}
              onChange={(e) => setForm({ ...form, cron: e.target.value })}
              placeholder="Cron — e.g. 30 6 * * * (6:30 AM daily)"
              className="mb-3 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          ) : (
            <div className="mb-3">
              {/* One-tap time presets — no manual typing needed */}
              <div className="mb-2 flex flex-wrap gap-2">
                {QUICK_TIMES.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, runAt: toLocalInputValue(q.date()) });
                      setShowCustom(false);
                    }}
                    className="rounded-full border border-gray-300 bg-night-900 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-brand/40 hover:text-night-950"
                  >
                    {q.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCustom((v) => !v)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    showCustom
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-gray-300 bg-night-900 text-gray-600 hover:border-brand/40 hover:text-night-950"
                  }`}
                >
                  📅 Custom
                </button>
              </div>

              {showCustom && (
                <input
                  type="datetime-local"
                  value={form.runAt}
                  onChange={(e) => setForm({ ...form, runAt: e.target.value })}
                  className="mb-2 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2 text-sm text-gray-600 outline-none focus:border-brand"
                />
              )}

              {form.runAt ? (
                <p className="text-xs text-gray-500">
                  🕐 Selected:{" "}
                  <span className="text-brand">{formatFriendly(new Date(form.runAt))}</span>
                  {pastOnce && (
                    <span className="ml-2 text-amber-600">
                      — time is in the past, pick a future time
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Pick a quick time above, or tap 📅 Custom to set date &amp; time manually.
                </p>
              )}
            </div>
          )}

          {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

          <button
            onClick={() => create.mutate()}
            disabled={
              !form.deviceId ||
              create.isPending ||
              (form.type === "cron" ? cronInvalid : !form.runAt)
            }
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Add Schedule"}
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-gray-500">
          No schedules yet{canManage ? " — create one above" : ""}.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <div
              key={s.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${
                s.enabled ? "border-brand/30 bg-night-900" : "border-gray-200 bg-night-900 opacity-60"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {s.device?.name ?? `Device #${s.deviceId}`}{" "}
                  <span
                    className={`ml-1 rounded px-1.5 py-0.5 text-xs font-bold ${
                      s.action === "on"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {s.action === "on" ? "ON" : "OFF"}
                  </span>
                  <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                    {TYPE_LABELS[s.type] ?? s.type}
                  </span>
                  {s.type === "cron" && (
                    <code className="ml-1 text-[10px] text-gray-500">{s.cron}</code>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Next run: <span className="text-brand">{formatDate(s.nextRun)}</span>
                  {s.lastRun ? (
                    <span className="text-gray-500"> · Last: {formatDate(s.lastRun)}</span>
                  ) : null}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleEnabled.mutate({ sched: s, enabled: !s.enabled })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    s.enabled
                      ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s.enabled ? "● Enabled" : "○ Disabled"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this schedule?")) remove.mutate(s.id);
                  }}
                  className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-red-500/20 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
