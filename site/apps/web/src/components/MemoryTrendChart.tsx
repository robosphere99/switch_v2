import { useMemo, useState } from "react";

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

  const view = useMemo(() => {
    if (!series.length) return null;
    const t0 = Math.min(...series.map((p) => Date.parse(p.ts)));
    const t1 = Math.max(...series.map((p) => Date.parse(p.ts)));
    const span = Math.max(t1 - t0, 60_000); // min 1 min window
    const maxV = maxRss ?? Math.max(20, ...series.map((p) => p.rss)) * 1.1;
    // per-pid sorted points for polylines
    const byPid = new Map<number, HbPoint[]>();
    for (const p of series) {
      const arr = byPid.get(p.pid) || [];
      arr.push(p);
      byPid.set(p.pid, arr);
    }
    const xs = (ts: number) => PAD.l + ((ts - t0) / span) * (W - PAD.l - PAD.r);
    const ys = (v: number) => PAD.t + (1 - v / maxV) * (H - PAD.t - PAD.b);
    return { t0, t1, span, maxV, byPid, xs, ys };
  }, [series, maxRss]);

  if (!view) {
    return (
      <div className="rounded-lg border border-gray-200 bg-night-900 p-4 text-center text-xs text-gray-600">
        Data accumulate ho raha hai — heartbeat har 10s log hota hai, 24h trend apne aap ban jayega.
      </div>
    );
  }

  const { t0, t1, maxV, byPid, xs, ys } = view;
  const timeTicks: number[] = [];
  const tickCount = 6;
  for (let i = 0; i <= tickCount; i++) timeTicks.push(t0 + ((t1 - t0) / tickCount) * i);

  const yTicks: number[] = [];
  const yStep = Math.max(10, Math.round(maxV / 4 / 10) * 10);
  for (let v = 0; v <= maxV + 1; v += yStep) yTicks.push(v);

  const fmtT = (ts: number) =>
    new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

  // nearest point on hover (mousemove)
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const tAt = t0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0);
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

  return (
    <div className="rounded-lg border border-gray-200 bg-night-900 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <p className="font-bold uppercase tracking-wide text-gray-500">📈 Memory trend — RSS per process (24h)</p>
        <div className="flex items-center gap-3 text-gray-600">
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> current pid
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-full bg-blue-400" /> older pids
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
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
        {/* per-pid polylines */}
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
        {/* hover crosshair + tooltip */}
        {hover && (
          <g>
            <line x1={xs(Date.parse(hover.ts))} y1={PAD.t} x2={xs(Date.parse(hover.ts))} y2={H - PAD.b} stroke="#4b5563" strokeWidth={0.5} strokeDasharray="2 2" />
            <circle cx={xs(Date.parse(hover.ts))} cy={ys(hover.rss)} r={3.5} fill={colorFor(hover.pid, currentPid)} stroke="#111827" strokeWidth={1} />
            <g transform={`translate(${Math.min(Math.max(xs(Date.parse(hover.ts)) + 10, PAD.l), W - PAD.r - 150)}, ${Math.max(PAD.t, ys(hover.rss) - 52)})`}>
              <rect width={150} height={46} rx={6} fill="#111827" stroke="#374151" />
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
        Har 10s ek point — har process ki apni line (color by pid). Upar ki taraf consistent line = leak. Saaf vertical breaks = process recycle.
      </p>
    </div>
  );
}
