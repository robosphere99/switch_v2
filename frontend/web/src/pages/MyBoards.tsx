import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { listMyBoards, renameEsp, setEspLed, setDeviceStatus, updateDevice } from "../api/devices";
import { BoardCard, isBoardOnline } from "../components/boards/BoardCard";
import { Cpu, Wifi, WifiOff, AlertCircle, RefreshCw } from "lucide-react";
import { Alert } from "../components/ui/Alert";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    "Something went wrong"
  );
}

export function MyBoards() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "unset">("all");
  const [homeFilter, setHomeFilter] = useState<number | "all">("all");

  const boards = useQuery({
    queryKey: ["my-boards"],
    queryFn: listMyBoards,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!boards.isLoading && location.hash) {
      const id = location.hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-brand", "ring-offset-2", "transition-all", "duration-1000");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-brand", "ring-offset-2");
          }, 2000);
        }, 100);
      }
    }
  }, [boards.isLoading, location.hash]);

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
    mutationFn: ({
      homeId,
      deviceId,
      espId,
      channel,
    }: {
      homeId: number;
      deviceId: number;
      espId: number | null;
      channel: number | null;
    }) => updateDevice(homeId, deviceId, { espId, channel }),
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
  const offlineCount = groups.reduce(
    (n, g) => n + g.boards.filter((b) => !isBoardOnline(b) && (b.devices.length > 0 || b.serialCode)).length,
    0,
  );
  const unsetCount = groups.reduce(
    (n, g) => n + g.boards.filter((b) => b.devices.every((d) => !d.channel)).length,
    0,
  );

  const filteredGroups = useMemo(() => {
    return groups
      .filter((g) => homeFilter === "all" || g.homeId === homeFilter)
      .map((g) => ({
        ...g,
        boards: g.boards.filter((b) => {
          if (statusFilter === "online") return isBoardOnline(b);
          if (statusFilter === "offline") return !isBoardOnline(b) && (b.devices.length > 0 || b.serialCode);
          if (statusFilter === "unset") return b.devices.every((d) => !d.channel);
          return true;
        }),
      }))
      .filter((g) => g.boards.length > 0);
  }, [groups, statusFilter, homeFilter]);

  return (
    <div className="page-enter mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Page Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Hardware Boards
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Monitor real-time WiFi connectivity, firmware status, and relay mappings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {groups.length > 1 && (
            <select
              value={homeFilter}
              onChange={(e) => setHomeFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              aria-label="Filter by Home"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-brand dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="all">All Homes</option>
              {groups.map((g) => (
                <option key={g.homeId} value={g.homeId}>
                  {g.homeName}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["my-boards"] })}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${boards.isFetching ? "animate-spin text-brand" : ""}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            statusFilter === "all"
              ? "border-brand/40 bg-brand/5 shadow-sm dark:bg-brand/10"
              : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalBoards}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Boards</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("online")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            statusFilter === "online"
              ? "border-emerald-500/40 bg-emerald-50/60 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/20"
              : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onlineCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Online</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("offline")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            statusFilter === "offline"
              ? "border-rose-500/40 bg-rose-50/60 shadow-sm dark:border-rose-500/30 dark:bg-rose-950/20"
              : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            <WifiOff className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{offlineCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Offline</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("unset")}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            statusFilter === "unset"
              ? "border-amber-500/40 bg-amber-50/60 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/20"
              : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{unsetCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Unmapped</div>
          </div>
        </button>
      </div>

      {error && (
        <div className="mb-6">
          <Alert variant="danger" onClose={() => setError("")}>
            {error}
          </Alert>
        </div>
      )}

      {/* Loading Skeleton */}
      {boards.isLoading && (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Zero Access */}
      {!boards.isLoading && groups.length === 0 && (
        <EmptyState
          icon={<Cpu className="h-8 w-8 text-slate-400" />}
          title="No Hardware Access"
          description="You must be an Owner or Admin of a home to view, configure, and manage physical SwitchNest hardware boards."
        />
      )}

      {/* Zero Filter Result */}
      {!boards.isLoading && filteredGroups.length === 0 && groups.length > 0 && (
        <EmptyState
          icon={<AlertCircle className="h-8 w-8 text-slate-400" />}
          title="No Matching Boards"
          description="No hardware boards match the selected filter criteria."
          action={
            <Button variant="outline" size="sm" onClick={() => setStatusFilter("all")}>
              Reset Filters
            </Button>
          }
        />
      )}

      {/* Groups List */}
      {filteredGroups.map((g) => (
        <section key={g.homeId} className="mb-10">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {g.homeName}
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {g.role}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {g.boards.length} {g.boards.length === 1 ? "board" : "boards"}
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {g.boards.map((b) => (
              <BoardCard
                key={b.id}
                board={b}
                homeId={g.homeId}
                role={g.role}
                unassignedDevices={g.unassignedDevices}
                apiKey={g.apiKey}
                onRename={(name) => rename.mutate({ homeId: g.homeId, espId: b.id, name })}
                onToggleLed={(enabled) => led.mutate({ homeId: g.homeId, espId: b.id, enabled })}
                isLedPending={led.isPending && led.variables?.espId === b.id}
                onToggleDevice={(deviceId, currentStatus) =>
                  toggle.mutate({
                    homeId: g.homeId,
                    deviceId,
                    status: currentStatus === "on" ? "off" : "on",
                  })
                }
                isTogglePending={toggle.isPending}
                onAssignChannel={(deviceId, channel) =>
                  assignCh.mutate({
                    homeId: g.homeId,
                    deviceId,
                    espId: channel !== null ? b.id : null,
                    channel,
                  })
                }
                isAssignPending={assignCh.isPending}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
