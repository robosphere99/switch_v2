import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listNotifications, markRead, markAllRead, unreadCount, type Notification } from "../api/notifications";
import { useAuthStore } from "../stores/auth";
import { buildSupportDraft, parseNotificationBody } from "../lib/notificationBody";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "system_admin";
  const [open, setOpen] = useState(false);

  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: unreadCount,
    refetchInterval: 30_000,
  });

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications({ page: 1, pageSize: 15 }),
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
  const list = notifications.data?.success ? notifications.data.data.items : [];

  const typeColor = (type: string) =>
    type === "warning" ? "border-amber-500/50 bg-amber-500/10" : type === "error" ? "border-red-500/50 bg-red-500/10" : "border-brand/30 bg-night-900";

  /** Notification click → support chat kholo. User ko draft message pre-filled milta hai. */
  const handleOpen = (n: Notification) => {
    if (!n.readAt) readOne.mutate(n.id);
    const parsed = parseNotificationBody(n.body);
    setOpen(false);
    if (isAdmin) {
      if (n.category === "support") {
        navigate(parsed.targetUserId ? `/admin?tab=support&user=${parsed.targetUserId}` : "/admin?tab=support");
      }
      return;
    }
    const draft = buildSupportDraft(n);
    navigate(draft ? `/support?draft=${encodeURIComponent(draft)}` : "/support");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-night-700 hover:text-brand"
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
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-night-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
              <Link to="/notifications" onClick={() => setOpen(false)} className="text-sm font-semibold hover:text-brand">
                Notifications <span className="text-[10px] font-normal text-gray-500">· View all →</span>
              </Link>
              {count > 0 && (
                <button
                  onClick={() => readAll.mutate()}
                  className="text-xs text-brand hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {list.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet</p>
              ) : (
                list.map((n) => {
                  const parsed = parseNotificationBody(n.body);
                  // User ke liye har notification clickable (draft ke saath support khulta hai)
                  const clickable = !isAdmin || n.category === "support";
                  return (
                    <div
                      key={n.id}
                      className={`border-l-2 px-4 py-3 transition hover:bg-night-700 ${typeColor(n.type)} ${n.readAt ? "opacity-60" : ""} ${
                        clickable ? "cursor-pointer" : ""
                      }`}
                      onClick={() => {
                        if (clickable) {
                          handleOpen(n);
                        } else if (!n.readAt) {
                          readOne.mutate(n.id);
                        }
                      }}
                      title={clickable ? (isAdmin ? "Chat kholo aur reply do" : "Support kholo — draft message ready") : "Notification"}
                    >
                      <p className="text-sm font-medium text-gray-700">{n.title}</p>
                      {parsed.text && <p className="mt-0.5 text-xs text-gray-500">{parsed.text}</p>}
                      <p className="mt-1 text-[10px] text-gray-500">
                        {new Date(n.createdAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                        {clickable && <span className="ml-1.5 text-brand">{isAdmin ? "· open →" : "· support → draft"}</span>}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
