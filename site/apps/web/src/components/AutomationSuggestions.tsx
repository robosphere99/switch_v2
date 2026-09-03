import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAutomationSuggestions, type AutomationSuggestion } from "../api/devices";
import { createSchedule } from "../api/schedules";

/** "07:00" → aaj ki date pe wo time (daily schedule ka base — server next occurrence normalize karta hai). */
function buildRunAt(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

/**
 * 💡 Suggested automations — usage patterns se daily schedule suggestions.
 * Usage data na ho to demo suggestions dikhte hain (demo flag ke saath) —
 * feature kabhi khali nahi dikhta. Assistant page + Dashboard dono use karte hain.
 */
export function AutomationSuggestions({
  homeId,
  compact = false,
}: {
  homeId: number;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();

  const suggestions = useQuery({
    queryKey: ["automations", "suggestions", homeId],
    queryFn: () => getAutomationSuggestions(homeId),
  });
  const list: AutomationSuggestion[] = suggestions.data?.success ? suggestions.data.data : [];
  const isDemo = list.some((s) => s.demo);

  const create = useMutation({
    mutationFn: (s: AutomationSuggestion) =>
      createSchedule(homeId, {
        deviceId: s.deviceId,
        action: s.action,
        type: "daily",
        runAt: buildRunAt(s.time),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", "suggestions", homeId] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  if (suggestions.isLoading) return null;
  if (!list.length) return null; // koi device hi nahi → kuch nahi

  return (
    <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className={`font-bold ${compact ? "text-base" : "text-lg"}`}>💡 Suggested automations</h2>
        {isDemo && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500">
            Demo — usage data nahi
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-gray-500">
        {isDemo
          ? "Aapke usage data kaafi nahi hai abhi — yeh sample suggestions hain (aapke asli devices pe). Ek click me daily schedule banao, phir Dashboard → Timers se edit/disable karo."
          : "Aapke usage patterns se — ek click me daily schedule banao. Dashboard → Timers se edit/disable kar sakte ho."}
      </p>
      <div className="space-y-2">
        {list.slice(0, compact ? 3 : 10).map((s) => (
          <div
            key={`${s.deviceId}-${s.time}-${s.action}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-night-800 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                ⏰ {s.deviceName} — {s.time} baje {s.action === "on" ? "ON" : "OFF"}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">{s.reason}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
                {s.demo ? "Sample" : `${Math.round(s.confidence * 100)}% confident`}
              </span>
              <button
                onClick={() => create.mutate(s)}
                disabled={create.isPending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-night-950 hover:bg-emerald-500 disabled:opacity-50"
              >
                {create.isPending ? "Creating…" : "+ Daily schedule"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
