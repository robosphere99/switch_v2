import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMyBoards, renameEsp, setDeviceStatus, type MyBoard } from "../api/devices";

const TYPE_ICONS: Record<string, string> = {
  bulb: "💡",
  fan: "🌀",
  ac: "❄️",
  tv: "📺",
  plug: "🔌",
  custom: "⚙️",
};

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

export function MyBoards() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

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

  const rename = useMutation({
    mutationFn: ({ homeId, espId, name }: { homeId: number; espId: number; name: string }) =>
      renameEsp(homeId, espId, name),
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
          <p className="mt-1 text-sm text-gray-400">
            Saare ESP boards ek jagah — firmware, status aur devices ke saath
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full border border-gray-700 bg-night-800 px-4 py-1.5 font-semibold">
            📡 {totalBoards} board{totalBoards === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 font-semibold text-emerald-400">
            ● {onlineCount} online
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          ⚠️ {error}
        </div>
      )}

      {boards.isLoading && <p className="text-gray-400">Boards load ho rahe hain…</p>}

      {!boards.isLoading && groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 bg-night-800 p-10 text-center text-gray-400">
          🛰️ Abhi koi board connected nahi hai.
          <br />
          <span className="text-sm">Order ke baad board activate karo ya support se baat karo.</span>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.homeId} className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            🏠 {g.homeName}
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
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
                  className={`flex flex-col gap-4 rounded-xl border p-5 ${
                    online
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
                              className="rounded border border-gray-700 px-1.5 py-0.5 text-xs text-gray-400 hover:border-brand hover:text-brand-light"
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
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        online
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {online ? "● online" : "○ offline"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {b.modelCode && (
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-gray-300">
                        {b.modelCode}
                      </span>
                    )}
                    {b.firmwareVersion && (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 font-semibold text-brand-light">
                        FW v{b.firmwareVersion}
                      </span>
                    )}
                    {b.ipAddress && (
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-gray-300">
                        🌐 {b.ipAddress}
                      </span>
                    )}
                    {b.ssid && (
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-gray-300">
                        📶 {b.ssid}
                      </span>
                    )}
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-gray-400">
                      🕒 {lastSeenText(b.lastSeen)}
                    </span>
                  </div>

                  {b.devices.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {b.devices.map((d) => {
                        const on = d.status === "on";
                        return (
                          <div
                            key={d.id}
                            className="flex items-center justify-between rounded-lg border border-gray-800 bg-night-900/60 px-3 py-2"
                          >
                            <span className="flex items-center gap-2 text-sm">
                              <span>{TYPE_ICONS[d.type] ?? "⚙️"}</span>
                              <span className="font-medium">{d.name}</span>
                              {d.offline && (
                                <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-400">
                                  offline
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() =>
                                toggle.mutate({
                                  homeId: g.homeId,
                                  deviceId: d.id,
                                  status: on ? "off" : "on",
                                })
                              }
                              disabled={toggle.isPending}
                              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                                on
                                  ? "bg-emerald-500 text-white hover:bg-emerald-400"
                                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                              }`}
                            >
                              {on ? "ON" : "OFF"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Is board se koi device link nahi hai.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
