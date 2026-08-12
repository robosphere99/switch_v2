import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listNotifications, markRead, markAllRead, unreadCount } from "../api/notifications";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: unreadCount,
    refetchInterval: 30_000,
  });

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const readOne = useMutation({
    mutationFn: (id: number) => markRead(id),
    onSuccess: invalidate,
  });

  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: invalidate,
  });

  const count = unread.data?.success ? unread.data.data : 0;
  const list = notifications.data?.success ? notifications.data.data : [];

  const typeColor = (type: string) =>
    type === "warning" ? "border-amber-500/50 bg-amber-500/10" : type === "error" ? "border-red-500/50 bg-red-500/10" : "border-brand/30 bg-night-900";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-300 hover:bg-night-700 hover:text-brand-light"
        title="Notifications"
      >
        🔔
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-gray-700 bg-night-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2.5">
              <span className="text-sm font-semibold">Notifications</span>
              {count > 0 && (
                <button
                  onClick={() => readAll.mutate()}
                  className="text-xs text-brand-light hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {list.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet</p>
              ) : (
                list.map((n) => (
                  <div
                    key={n.id}
                    className={`cursor-pointer border-l-2 px-4 py-3 transition hover:bg-night-700 ${typeColor(n.type)} ${n.readAt ? "opacity-60" : ""}`}
                    onClick={() => {
                      if (!n.readAt) readOne.mutate(n.id);
                    }}
                  >
                    <p className="text-sm font-medium text-gray-200">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-gray-400">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-gray-500">
                      {new Date(n.createdAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
