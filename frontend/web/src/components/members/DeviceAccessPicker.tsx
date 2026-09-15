import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HomeMember } from "@robosphere/shared";
import { listDevices } from "../../api/devices";
import { setMemberDeviceAccess } from "../../api/members";
import { Button } from "../ui/Button";
import { ChevronDown, ChevronUp, Lock, Check } from "lucide-react";

export interface DeviceAccessPickerProps {
  homeId: number;
  member: HomeMember;
}

export function DeviceAccessPicker({ homeId, member }: DeviceAccessPickerProps) {
  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: ["devices", homeId],
    queryFn: () => listDevices(homeId),
  });

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set((member.deviceAccess ?? []).map((d) => d.deviceId))
  );
  const [saved, setSaved] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const toggle = (id: number) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!devices.data?.success) return;
    setSelected(new Set(devices.data.data.map((d) => d.id)));
    setSaved(false);
  };

  const deselectAll = () => {
    setSelected(new Set());
    setSaved(false);
  };

  const save = useMutation({
    mutationFn: () => setMemberDeviceAccess(homeId, member.userId, [...selected]),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["members", homeId] });
    },
  });

  const list = devices.data?.success ? devices.data.data : [];

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-brand transition-colors"
        >
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          <span>Restricted Device Access ({list.length > 0 ? `${selected.size}/${list.length}` : "…"})</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
        </button>
        <Button
          size="sm"
          variant={saved ? "secondary" : "primary"}
          onClick={() => save.mutate()}
          disabled={save.isPending || saved || list.length === 0}
          loading={save.isPending}
          leftIcon={saved ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : undefined}
        >
          {saved ? "Saved" : "Save Permissions"}
        </Button>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
          {devices.isLoading && <p className="text-xs text-slate-400">Loading devices…</p>}
          {!devices.isLoading && list.length === 0 && (
            <p className="text-xs text-slate-400">No devices created in this home yet.</p>
          )}

          {list.length > 0 && (
            <div className="mb-3 flex items-center gap-4 text-xs font-semibold">
              <button type="button" onClick={selectAll} className="text-brand hover:underline">
                Select All
              </button>
              <button type="button" onClick={deselectAll} className="text-slate-500 hover:underline">
                Clear All
              </button>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {list.map((d) => (
              <label
                key={d.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  selected.has(d.id)
                    ? "border-brand/40 bg-brand/5 text-slate-900 dark:text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggle(d.id)}
                  className="h-4 w-4 rounded text-brand focus:ring-brand accent-brand"
                />
                <span className="truncate">{d.name}</span>
                {d.status === "on" && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" />}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
