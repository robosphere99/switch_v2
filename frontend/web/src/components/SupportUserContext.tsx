import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { getSupportUserContext } from "../api/admin";

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-500/20 text-amber-600" },
  paid: { label: "Paid", cls: "bg-blue-500/20 text-blue-600" },
  shipped: { label: "Shipped", cls: "bg-purple-500/20 text-purple-500" },
  delivered: { label: "Delivered", cls: "bg-emerald-500/20 text-emerald-500" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/20 text-red-400" },
};

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
      {children}
    </span>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-200 px-4 py-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
        {title}
        {count != null && count > 0 ? <span className="ml-1 text-gray-600">({count})</span> : null}
      </p>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-gray-500">{text}</p>;
}

/** Support inbox: WhatsApp contact-info jaisa user context panel. */
export function SupportUserContext({ userId, onClose }: { userId: number; onClose: () => void }) {
  const ctx = useQuery({
    queryKey: ["support", "admin", "context", userId],
    queryFn: () => getSupportUserContext(userId),
  });

  const d = ctx.data?.success ? ctx.data.data : null;
  const user = d?.user;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Har baar kholne / user badalne / data load hone pe top se shuru karo,
  // taaki profile section sabse upar dikhe (browser scroll-anchoring se
  // panel kabhi beech/neeche se na khule).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [userId, ctx.dataUpdatedAt]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col border-t border-gray-200 bg-night-900 md:w-80 md:border-l md:border-t-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
        <p className="text-sm font-semibold">👤 User Info</p>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-500 transition hover:bg-night-700 hover:text-brand"
          title="Band karo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" style={{ overflowAnchor: "none" }}>
        {ctx.isLoading && <p className="px-4 py-8 text-center text-sm text-gray-500">Loading…</p>}
        {!ctx.isLoading && !user && (
          <p className="px-4 py-8 text-center text-sm text-red-400">User context load nahi hua.</p>
        )}

        {user && (
          <>
            {/* User card */}
            <div className="flex items-center gap-3 px-4 py-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${avatarColor(user.id)}`}
              >
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-200">{user.username}</p>
                <p className="truncate text-xs text-gray-500">{user.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge cls={user.role === "system_admin" ? "border-purple-500/40 text-purple-400" : "border-gray-600 text-gray-400"}>
                    {user.role}
                  </Badge>
                  <Badge cls={user.status === "active" ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>
                    {user.status}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-3 text-[11px] text-gray-500">
              <div>
                <p className="text-gray-600">Joined</p>
                <p>{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Last login</p>
                <p>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "—"}</p>
              </div>
            </div>

            {/* Orders */}
            <Section title="📦 Orders" count={d?.orders.length}>
              {d && d.orders.length === 0 && <Empty text="Koi order nahi." />}
              {d?.orders.map((o) => (
                <div key={o.id} className="mb-2 rounded-lg border border-gray-200 bg-night-800 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-brand">{o.orderNumber}</span>
                    <Badge cls={ORDER_STATUS[o.status]?.cls ?? "border-gray-600 text-gray-400"}>
                      {ORDER_STATUS[o.status]?.label ?? o.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                    <span>₹{Number(o.totalAmount).toLocaleString("en-IN")} · {o._count.items} item(s)</span>
                    <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-600">
                    payment: {o.paymentStatus}
                    {o.shippingPhone ? ` · 📞 ${o.shippingPhone}` : ""}
                  </div>
                </div>
              ))}
            </Section>

            {/* Homes */}
            <Section title="🏠 Homes" count={d?.homes.length}>
              {d && d.homes.length === 0 && <Empty text="Koi home nahi." />}
              {d?.homes.map((h) => (
                <div key={h.id} className="mb-2 rounded-lg border border-gray-200 bg-night-800 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-200">{h.name}</span>
                    <Badge cls={h.status === "active" ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>
                      {h.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    role: {h.memberRole}
                    {h.owner && h.owner.id !== user.id ? ` · owner: ${h.owner.username}` : " · owner"}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    💡 {h._count.devices} devices · 👥 {h._count.members} members · 🚪 {h._count.rooms} rooms
                  </div>
                </div>
              ))}
            </Section>

            {/* Devices */}
            <Section title="💡 Devices" count={d?.devices.length}>
              {d && d.devices.length === 0 && <Empty text="Koi device nahi." />}
              {d?.devices.map((dev) => (
                <div key={dev.id} className="mb-2 rounded-lg border border-gray-200 bg-night-800 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-200">{dev.name}</span>
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase ${
                      dev.status === "on" ? "text-emerald-400" : "text-gray-500"
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${dev.status === "on" ? "bg-emerald-400" : "bg-gray-500"}`} />
                      {dev.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    {dev.type}
                    {dev.room?.name ? ` · ${dev.room.name}` : ""} · {dev.home.name}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    {dev.offline ? "⚪ offline" : "🟢 online"}
                    {dev.serialNumber ? ` · S/N ${dev.serialNumber}` : ""}
                  </div>
                </div>
              ))}
            </Section>

            {/* ESP boards */}
            <Section title="🛰️ ESP Boards" count={d?.esps.length}>
              {d && d.esps.length === 0 && <Empty text="Koi ESP board nahi." />}
              {d?.esps.map((e) => (
                <div key={e.id} className="mb-2 rounded-lg border border-gray-200 bg-night-800 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-200">{e.name ?? "ESP"}</span>
                    <Badge cls={e.offline ? "border-red-500/40 text-red-400" : "border-emerald-500/40 text-emerald-400"}>
                      {e.offline ? "offline" : "online"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-gray-500">
                    {e.modelCode && <span className="rounded bg-brand/20 px-1.5 text-[10px] font-bold text-brand">{e.modelCode}</span>}
                    <span className="font-mono">{e.macAddress}</span>
                  </div>
                  <div className="text-[10px] text-gray-600">
                    {e.serialCode ? `S/N ${e.serialCode}` : ""}
                    {e.firmwareVersion ? ` · FW ${e.firmwareVersion}` : ""}
                    {e.home ? ` · ${e.home.name}` : ""}
                  </div>
                </div>
              ))}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
