import { useMemo, useRef, useState } from "react";

export interface HbPoint {
  ts: string;
  pid: number;
  uptime: number;
  rss: number;
  heap: number | null;
}

interface Props {
  series: HbPoint[];
  currentPid: number | null;
  /** MB me y-axis max — null = auto */
  maxRss?: number | null;
}

type RangeKey = "1h" | "6h" | "24h";
const RANGE_HOURS: Record<RangeKey, number> = { "1h": 1, "6h": 6, "24h": 24 };
const RANGE_OPTS: RangeKey[] = ["1h", "6h", "24h"];

const W = 760;
const H = 220;
const PAD = { l: 44, r: 12, t: 14, b: 26 };

const PALETTE = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#f87171", "#22d3ee", "#4ade80"];

function colorFor(pid: number, current: number | null): string {
  if (current !== null && pid === current) return "#34d399"; // current = bright green
  // stable hash se color
  let h = 0;
  const s = String(pid);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function MemoryTrendChart({ series, currentPid, maxRss = null }: Props) {
  const [hover, setHover] = useState<HbPoint | null>(null);
  const [range, setRange] = useState<RangeKey>("24h");
  const [zoom, setZoom] = useState<{ t0: number; t1: number } | null>(null);
  const [showHeap, setShowHeap] = useState(false);
  // drag logic ref me (synchronous events pe bhi reliable), selection rect state me
  const dragRef = useRef<{ startPx: number; curPx: number } | null>(null);
  const [dragUi, setDragUi] = useState<{ startPx: number; curPx: number } | null>(null);

  const rawT1 = useMemo(
    () => (series.length ? Math.max(...series.map((p) => Date.parse(p.ts))) : 0),
    [series],
  );

  /** Current process ka RSS growth (last 4h) — 20%+ = possible leak alert. */
  const rssAlert = useMemo(() => {
    if (currentPid === null || !series.length) return null;
    const pts = series.filter((p) => p.pid === currentPid);
    if (pts.length < 2) return null;
    const tEnd = Math.max(...pts.map((p) => Date.parse(p.ts)));
    const tStart = tEnd - 4 * 3600_000;
    const win = pts.filter((p) => Date.parse(p.ts) >= tStart);
    if (win.length < 2) return null;
    const times = win.map((p) => Date.parse(p.ts));
    const spanH = (Math.max(...times) - Math.min(...times)) / 3600_000;
    if (spanH < 0.5) return null; // 30 min se kam data = unreliable
    const sorted = [...win].sort((a, b) => a.ts.localeCompare(b.ts));
    const first = sorted[0].rss;
    const last = sorted[sorted.length - 1].rss;
    if (first <= 0) return null;
    const pct = ((last - first) / first) * 100;
    return { pct, first, last, spanH };
  }, [series, currentPid]);

  const view = useMemo(() => {
    if (!series.length) return null;
    let t0: number;
    let t1: number;
    if (zoom) {
      t0 = zoom.t0;
      t1 = zoom.t1;
    } else {
      t1 = rawT1;
      t0 = Math.max(rawT1 - RANGE_HOURS[range] * 3600_000, Math.min(...series.map((p) => Date.parse(p.ts))));
    }
    const span = Math.max(t1 - t0, 60_000); // min 1 min window
    const maxV = maxRss ?? Math.max(20, ...series.map((p) => p.rss)) * 1.1;
    // window ke andar ke points hi rakho (hover + lines dono ke liye)
    const byPid = new Map<number, HbPoint[]>();
    const byPidHeap = new Map<number, HbPoint[]>();
    for (const p of series) {
      const t = Date.parse(p.ts);
      if (t < t0 || t > t1) continue;
      const arr = byPid.get(p.pid) || [];
      arr.push(p);
      byPid.set(p.pid, arr);
      if (p.heap !== null) {
        const harr = byPidHeap.get(p.pid) || [];
        harr.push(p);
        byPidHeap.set(p.pid, harr);
      }
    }
    const xs = (ts: number) => PAD.l + ((ts - t0) / span) * (W - PAD.l - PAD.r);
    const ys = (v: number) => PAD.t + (1 - v / maxV) * (H - PAD.t - PAD.b);
    return { t0, t1, span, maxV, byPid, byPidHeap, xs, ys };
  }, [series, maxRss, range, zoom, rawT1]);

  if (!view) {
    return (
      <div className="rounded-lg border border-gray-200 bg-night-900 p-4 text-center text-xs text-gray-600">
        Data accumulate ho raha hai — heartbeat har 10s log hota hai, 24h trend apne aap ban jayega.
      </div>
    );
  }

  const { t0, t1, maxV, byPid, byPidHeap, xs, ys } = view;
  const timeTicks: number[] = [];
  const tickCount = 6;
  for (let i = 0; i <= tickCount; i++) timeTicks.push(t0 + ((t1 - t0) / tickCount) * i);

  const yTicks: number[] = [];
  const yStep = Math.max(10, Math.round(maxV / 4 / 10) * 10);
  for (let v = 0; v <= maxV + 1; v += yStep) yTicks.push(v);

  const fmtT = (ts: number) => {
    const d = new Date(ts);
    const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    // 18h+ windows pe date bhi dikhao (24h pe 2 din aa sakte hain)
    const spanH = (t1 - t0) / 3600_000;
    if (spanH >= 18) {
      return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${time}`;
    }
    return time;
  };

  const pxToT = (px: number) => t0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0);

  // nearest point on hover (mousemove)
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (dragRef.current) {
      dragRef.current.curPx = px;
      setDragUi({ ...dragRef.current });
      return;
    }
    const tAt = pxToT(px);
    let best: HbPoint | null = null;
    let bestD = Infinity;
    for (const pts of byPid.values()) {
      for (const p of pts) {
        const d = Math.abs(Date.parse(p.ts) - tAt);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    setHover(best);
  };

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    dragRef.current = { startPx: px, curPx: px };
    setDragUi({ startPx: px, curPx: px });
  };

  const onMouseUp = () => {
    const d = dragRef.current;
    if (d) {
      const dx = Math.abs(d.curPx - d.startPx);
      if (dx > 8) {
        const a = pxToT(Math.min(d.startPx, d.curPx));
        const b = pxToT(Math.max(d.startPx, d.curPx));
        if (b - a > 30_000) setZoom({ t0: a, t1: b }); // 30s se chhota zoom nahi
      }
      dragRef.current = null;
      setDragUi(null);
    }
  };

  const selectRange = (r: RangeKey) => {
    setRange(r);
    setZoom(null);
  };

  const selW = dragUi ? Math.abs(dragUi.curPx - dragUi.startPx) : 0;
  const selX = dragUi ? Math.min(dragUi.startPx, dragUi.curPx) : 0;

  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)}%`;

  return (
    <div className="rounded-lg border border-gray-200 bg-night-900 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold uppercase tracking-wide text-gray-500">📈 Memory trend — RSS per process</p>
          {rssAlert && rssAlert.pct >= 20 ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-400"
              title={`RSS ${rssAlert.first.toFixed(0)}MB → ${rssAlert.last.toFixed(0)}MB (last ${rssAlert.spanH.toFixed(1)}h) — process consistently badh raha hai, leak ho sakta hai`}
            >
              ⚠️ RSS {fmtPct(rssAlert.pct)} · {rssAlert.spanH.toFixed(1)}h — possible leak
            </span>
          ) : rssAlert ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-500/90">
              🟢 RSS stable {fmtPct(rssAlert.pct)} · {rssAlert.spanH.toFixed(1)}h
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-gray-600">
          <button
            onClick={() => setShowHeap((v) => !v)}
            className={`rounded border px-2 py-0.5 font-semibold transition-colors ${
              showHeap ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-gray-200 text-gray-500 hover:text-gray-300"
            }`}
            title="Heap line dikhao / chhupao"
          >
            🧠 heap
          </button>
          <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-night-950 p-0.5">
            {RANGE_OPTS.map((r) => (
              <button
                key={r}
                onClick={() => selectRange(r)}
                className={`rounded px-2 py-0.5 font-semibold transition-colors ${
                  !zoom && range === r ? "bg-brand/15 text-brand" : "text-gray-500 hover:text-gray-300"
                }`}
                title={`Last ${r} window`}
              >
                {r}
              </button>
            ))}
          </div>
          {zoom && (
            <button
              onClick={() => setZoom(null)}
              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-500 hover:bg-emerald-500/20"
              title="Zoom wapas range pe"
            >
              ↺ reset
            </button>
          )}
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> current pid
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-full bg-blue-400" /> older pids
          </span>
          {showHeap && (
            <span className="flex items-center gap-1 text-amber-400">
              <i className="inline-block h-0 w-3 border-t-2 border-dashed border-amber-400" /> heap
            </span>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`h-auto w-full ${dragUi ? "cursor-grabbing" : "cursor-crosshair"}`}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHover(null);
          dragRef.current = null;
          setDragUi(null);
        }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
      >
        {/* grid + y labels */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} y1={ys(v)} x2={W - PAD.r} y2={ys(v)} stroke="#1f2937" strokeWidth={0.5} strokeDasharray="3 3" />
            <text x={PAD.l - 6} y={ys(v) + 3} textAnchor="end" fontSize={9} fill="#6b7280">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {/* x labels */}
        {timeTicks.map((tt, i) => (
          <text key={i} x={xs(tt)} y={H - 8} textAnchor="middle" fontSize={9} fill="#6b7280">
            {fmtT(tt)}
          </text>
        ))}
        {/* per-pid RSS polylines (window me filtered) */}
        {[...byPid.entries()].map(([pid, pts]) => {
          const sorted = [...pts].sort((a, b) => a.ts.localeCompare(b.ts));
          if (sorted.length < 2) return null;
          const d = sorted
            .map((p, i) => `${i === 0 ? "M" : "L"}${xs(Date.parse(p.ts)).toFixed(1)},${ys(p.rss).toFixed(1)}`)
            .join(" ");
          return (
            <path
              key={pid}
              d={d}
              fill="none"
              stroke={colorFor(pid, currentPid)}
              strokeWidth={currentPid === pid ? 1.8 : 1}
              opacity={currentPid === pid ? 1 : 0.55}
            />
          );
        })}
        {/* per-pid heap lines (dashed amber) — toggle se */}
        {showHeap &&
          [...byPidHeap.entries()].map(([pid, pts]) => {
            const sorted = [...pts].sort((a, b) => a.ts.localeCompare(b.ts));
            if (sorted.length < 2) return null;
            const d = sorted
              .map((p, i) => `${i === 0 ? "M" : "L"}${xs(Date.parse(p.ts)).toFixed(1)},${ys(p.heap!).toFixed(1)}`)
              .join(" ");
            return (
              <path
                key={`heap-${pid}`}
                d={d}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={currentPid === pid ? 1.5 : 0.8}
                strokeDasharray="4 3"
                opacity={currentPid === pid ? 0.95 : 0.4}
              />
            );
          })}
        {/* drag-to-zoom selection */}
        {dragUi && selW > 4 && (
          <rect
            x={selX}
            y={PAD.t}
            width={selW}
            height={H - PAD.t - PAD.b}
            fill="#34d399"
            opacity={0.15}
            stroke="#34d399"
            strokeWidth={0.5}
            strokeDasharray="3 3"
          />
        )}
        {/* hover crosshair + tooltip */}
        {hover && (
          <g>
            <line x1={xs(Date.parse(hover.ts))} y1={PAD.t} x2={xs(Date.parse(hover.ts))} y2={H - PAD.b} stroke="#4b5563" strokeWidth={0.5} strokeDasharray="2 2" />
            <circle cx={xs(Date.parse(hover.ts))} cy={ys(hover.rss)} r={3.5} fill={colorFor(hover.pid, currentPid)} stroke="#111827" strokeWidth={1} />
            {showHeap && hover.heap !== null && (
              <circle cx={xs(Date.parse(hover.ts))} cy={ys(hover.heap)} r={3} fill="#fbbf24" stroke="#111827" strokeWidth={1} />
            )}
            <g transform={`translate(${Math.min(Math.max(xs(Date.parse(hover.ts)) + 10, PAD.l), W - PAD.r - 150)}, ${Math.max(PAD.t, ys(Math.min(hover.rss, hover.heap ?? hover.rss)) - 58)})`}>
              <rect width={150} height={50} rx={6} fill="#111827" stroke="#374151" />
              <text x={8} y={15} fontSize={10} fill="#9ca3af">
                {new Date(hover.ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
              </text>
              <text x={8} y={29} fontSize={10} fill="#d1d5db">
                pid {hover.pid} · RSS {hover.rss}MB{hover.heap !== null ? ` · heap ${hover.heap}MB` : ""}
              </text>
              <text x={8} y={42} fontSize={9} fill="#6b7280">
                uptime {Math.floor(hover.uptime / 60)}m {hover.uptime % 60}s
              </text>
            </g>
          </g>
        )}
      </svg>
      <p className="mt-1 text-[10px] text-gray-600">
        Har 10s ek point — solid line = RSS, dashed amber = heap (🧠 toggle). Upar ki taraf consistent line = leak (4h me 20%+ = ⚠️ badge). Saaf vertical breaks = process recycle.{" "}
        <span className="text-gray-500">Chart pe drag karo = zoom, "↺ reset" se wapas.</span>
      </p>
    </div>
  );
}
