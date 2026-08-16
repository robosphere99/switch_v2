import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Dropdown ko portal se body pe render karte hain — navbar/stacking-context se bahar,
  // taaki backdrop (blur) saare content ko cover kare aur kahin bhi click pe band ho
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const toggle = () => {
    if (!open && bellRef.current) {
      const r = bellRef.current.getBoundingClientRect();
      const W = 320; // dropdown width
      // Bell ke saath align, par screen se bahar kabhi nahi (mobile menu me bell left pe hota hai)
      const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
      setPos({ top: r.bottom + 8, left });
    }
    setOpen((o) => !o);
  };

  // Window resize pe dropdown band (position stale na ho)
  useEffect(() => {
    if (!open) return;
    const onResize = () => setOpen(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  // Escape dabao to dropdown band (standard popover behavior)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Bell aur dropdown ke bahar kahin bhi mouse/touch/pen dabao to band
  // (backdrop click ke alawa bhi — mobile webviews me fixed overlay miss ho sakta hai)
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (bellRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

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
        ref={bellRef}
        onClick={toggle}
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

      {open &&
        pos &&
        createPortal(
          <>
            {/* Blur + dim overlay — saare content ko cover karta hai, kahin bhi touch/click pe band */}
            <div
              className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              onContextMenu={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
            />
            <div
              ref={panelRef}
              className="fixed z-[100] w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-gray-200 bg-night-800 shadow-2xl"
              style={{ top: pos.top, left: pos.left }}
            >
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
          </>,
          document.body
        )}
    </div>
  );
}
