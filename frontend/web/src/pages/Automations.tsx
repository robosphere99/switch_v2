import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Clock, Trash2, Power, Plus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Alert } from "../components/ui/Alert";

export function Automations() {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [homeId, setHomeId] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Form State
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newSched, setNewSched] = useState({
    deviceId: "",
    action: "off",
    type: "once",
    minutesDelay: 5,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const hRes = await api.get("/homes");
      const homesList = hRes.data?.data || hRes.data || [];
      if (homesList.length > 0) {
        const hId = homesList[0].id;
        setHomeId(hId);

        const [schRes, devRes] = await Promise.all([
          api.get(`/homes/${hId}/schedules`),
          api.get(`/homes/${hId}/devices`),
        ]);

        setSchedules(schRes.data?.data || schRes.data || []);
        setDevices(devRes.data?.data || devRes.data || []);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to load automations");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeId || !newSched.deviceId) return;
    setSubmitting(true);
    setError("");

    const runAt = new Date(Date.now() + newSched.minutesDelay * 60000).toISOString();

    try {
      await api.post(`/homes/${homeId}/schedules`, {
        deviceId: parseInt(newSched.deviceId),
        action: newSched.action,
        type: newSched.type,
        runAt,
      });
      setIsCreating(false);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to create routine timer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!homeId) return;
    if (!confirm("Are you sure you want to stop and delete this scheduled routine?")) return;
    try {
      await api.delete(`/homes/${homeId}/schedules/${id}`);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to delete schedule");
    }
  };

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Automations & Timers
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Set intelligent timers and automated countdown schedules for your connected devices.
          </p>
        </div>
        {!isCreating && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreating(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            New Timer
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-6">
          <Alert variant="danger" onClose={() => setError("")}>
            {error}
          </Alert>
        </div>
      )}

      {/* Creation Card */}
      {isCreating && (
        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 mb-5">
            <Clock className="h-5 w-5 text-brand" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Create Device Timer
            </h2>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Target Device *"
                required
                value={newSched.deviceId}
                onChange={(e) => setNewSched({ ...newSched, deviceId: e.target.value })}
              >
                <option value="">Select a device...</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.room ? `(${d.room.name})` : ""}
                  </option>
                ))}
              </Select>

              <Select
                label="Action *"
                value={newSched.action}
                onChange={(e) => setNewSched({ ...newSched, action: e.target.value })}
              >
                <option value="off">Turn OFF</option>
                <option value="on">Turn ON</option>
              </Select>

              <Input
                label="Execute In (Minutes) *"
                type="number"
                min={1}
                max={1440}
                required
                value={newSched.minutesDelay}
                onChange={(e) => setNewSched({ ...newSched, minutesDelay: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting || !newSched.deviceId}
                loading={submitting}
              >
                Save Timer
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Zero State */}
      {!loading && schedules.length === 0 && !isCreating && (
        <EmptyState
          icon={<Clock className="h-8 w-8 text-slate-400" />}
          title="No Active Automations"
          description="You don't have any routines or timer schedules set up. Create your first countdown routine above."
          action={
            <Button variant="primary" size="sm" onClick={() => setIsCreating(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Create Timer
            </Button>
          }
        />
      )}

      {/* Schedules List */}
      <div className="space-y-3">
        {!loading &&
          schedules.map((sched) => {
            const runDate = new Date(sched.runAt);
            const isON = sched.action === "on";

            return (
              <div
                key={sched.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      isON
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <Power className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                      {sched.device?.name || "Device"}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={isON ? "success" : "neutral"} size="sm">
                        Turn {sched.action.toUpperCase()}
                      </Badge>
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Clock className="h-3 w-3" />
                        {sched.type === "once" ? (
                          <span>
                            Runs at <b>{runDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b> ({runDate.toLocaleDateString()})
                          </span>
                        ) : (
                          sched.cron
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(sched.id)}
                  className="rounded-xl p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors dark:hover:bg-rose-950/30"
                  title="Delete Routine"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
