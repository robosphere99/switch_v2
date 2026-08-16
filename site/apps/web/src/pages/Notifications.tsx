import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listNotifications,
  markRead,
  markAllRead,
  removeNotification,
  unreadCount,
  type Notification,
} from "../api/notifications";
import { useAuthStore } from "../stores/auth";
import { buildAdminReplyDraft, buildSupportDraft, parseNotificationBody } from "../lib/notificationBody";

const CATEGORIES: Array<{ id: string; label: string; icon: string }> = [
  { id: "all", label: "All", icon: "🔔" },
  { id: "support", label: "Support", icon: "🛠️" },
  { id: "device", label: "Device", icon: "📡" },
  { id: "schedule", label: "Schedule", icon: "⏰" },
  { id: "system", label: "System", icon: "⚙️" },
];

const TYPES: Array<{ id: string; label: string }> = [
  { id: "all", label: "Sab types" },
  { id: "info", label: "ℹ️ Info" },
  { id: "warning", label: "⚠️ Warning" },
  { id: "error", label: "⛔ Error" },
];

const CATEGORY_LABEL: Record<string, string> = {
  support: "🛠️ Support",
  device: "📡 Device",
  schedule: "⏰ Schedule",
  system: "⚙️ System",
};

export function Notifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "system_admin";
  const [category, setCategory] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const pageSize = 10;

  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: unreadCount,
    refetchInterval: 30_000,
  });

  const list = useQuery({
    queryKey: ["notifications", category, typeFilter, page, unreadOnly],
    queryFn: () =>
      listNotifications({
        page,
        pageSize,
        category,
        type: typeFilter !== "all" ? typeFilter : undefined,
        unread: unreadOnly || undefined,
      }),
    // Dropdown jaisa live — naye notifications khud aa jayein
    refetchInterval: 30_000,
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

  const remove = useMutation({
    mutationFn: (id: number) => removeNotification(id),
    onSuccess: invalidate,
  });

  const data = list.data?.success ? list.data.data : null;
  const unreadTotal = unread.data?.success ? unread.data.data : 0;

  // Dropdown (NotificationBell) ke EXACT jaisa — page aur popover ek jaisa lage
  const typeStyle = (type: string) =>
    type === "warning"
      ? "border-amber-500/50 bg-amber-500/10"
      : type === "error"
        ? "border-red-500/50 bg-red-500/10"
        : "border-brand/30 bg-night-900";

  const typeBadge = (type: string) =>
    type === "warning" ? "bg-amber-500/20 text-amber-600" : type === "error" ? "bg-red-500/20 text-red-400" : "bg-brand/20 text-brand";

  const goTo = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Notification click → support chat kholo. User ko draft message pre-filled milta hai. */
  const handleOpen = (n: Notification) => {
    if (!n.readAt) readOne.mutate(n.id);
    const parsed = parseNotificationBody(n.body);
    if (isAdmin) {
      if (n.category === "support") {
        // Admin reply template — "User ne reply kiya" notification pe draft ready milta hai
        const draft = buildAdminReplyDraft(n);
        const base = parsed.targetUserId ? `/admin?tab=support&user=${parsed.targetUserId}` : "/admin?tab=support";
        navigate(draft ? `${base}&draft=${encodeURIComponent(draft)}` : base);
      }
      return;
    }
    const draft = buildSupportDraft(n);
    navigate(draft ? `/support?draft=${encodeURIComponent(draft)}` : "/support");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🔔 Notification Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadTotal > 0 ? (
              <>
                <span className="font-semibold text-amber-600">{unreadTotal} unread</span> — support, device aur
                schedule updates yahan track karo.
              </>
            ) : (
              "Sab kuch padh liya — koi unread notification nahi. 🎉"
            )}
          </p>
        </div>
        {unreadTotal > 0 && (
          <button
            onClick={() => readAll.mutate()}
            className="rounded-lg border border-gray-200 bg-night-800 px-4 py-2 text-sm text-brand transition hover:border-brand hover:bg-night-700"
          >
            ✓ Mark all read
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCategory(c.id);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              category === c.id
                ? "bg-brand text-white shadow-lg shadow-brand/25"
                : "border border-gray-200 bg-night-800 text-gray-600 hover:border-brand/50 hover:text-brand"
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Type filter — Info / Warning / Error */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTypeFilter(t.id);
              setPage(1);
            }}
            className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
              typeFilter === t.id
                ? "border-brand bg-brand/20 text-brand"
                : "border-gray-200 bg-night-800 text-gray-500 hover:border-brand/50 hover:text-brand"
            }`}
          >
            {t.label}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-gray-500">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 accent-brand"
          />
          Unread only
        </label>
      </div>

      {/* List */}
      <div className="space-y-2">
        {list.isLoading && <p className="py-10 text-center text-gray-500">Loading notifications…</p>}
        {!list.isLoading && data && data.items.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-night-900 py-16 text-center">
            <p className="text-3xl">🗒️</p>
            <p className="mt-2 text-gray-500">Koi notification nahi.</p>
            <p className="text-sm text-gray-600">
              {category !== "all"
                ? `"${CATEGORY_LABEL[category] ?? category}" filter me kuch nahi mila.`
                : "Jab support action, device offline ya schedule fire hoga — yahan dikhega."}
            </p>
          </div>
        )}
        {data?.items.map((n) => {
          const parsed = parseNotificationBody(n.body);
          // User ke liye har notification clickable (draft ke saath support khulta hai),
          // admin ke liye sirf support notifications chat kholte hain.
          const clickable = !isAdmin || n.category === "support";
          return (
            <div
              key={n.id}
              className={`flex items-start gap-3 rounded-xl border-l-2 px-4 py-3 transition hover:bg-night-700 ${typeStyle(n.type)} ${
                n.readAt ? "opacity-60" : ""
              } ${clickable ? "cursor-pointer" : ""}`}
            >
              <button
                onClick={() => {
                  if (clickable) handleOpen(n);
                  else if (!n.readAt) readOne.mutate(n.id);
                }}
                className="flex-1 text-left"
                title={clickable ? (isAdmin ? "Chat kholo aur reply do" : "Support kholo — draft message ready") : n.readAt ? "Read" : "Click to mark as read"}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{n.title}</span>
                  {n.category && (
                    <span className="rounded-full bg-night-800 px-2 py-0.5 text-[10px] text-gray-500">
                      {CATEGORY_LABEL[n.category] ?? n.category}
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${typeBadge(n.type)}`}>
                    {n.type}
                  </span>
                  {!n.readAt && <span className="h-2 w-2 rounded-full bg-brand" />}
                </div>
                {parsed.text && <p className="mt-1 text-sm text-gray-500">{parsed.text}</p>}
                <p className="mt-1.5 text-[11px] text-gray-500">
                  {new Date(n.createdAt).toLocaleString([], {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {clickable && <span className="ml-2 text-brand">{isAdmin ? "↪ chat kholo — draft ready" : "↪ support kholo — draft ready"}</span>}
                </p>
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this notification?")) remove.mutate(n.id);
                }}
                className="rounded-lg p-2 text-gray-600 transition hover:bg-red-500/10 hover:text-red-400"
                title="Delete"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-gray-200 bg-night-800 px-4 py-2 text-sm text-gray-600 transition enabled:hover:border-brand enabled:hover:text-brand disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="px-3 text-sm text-gray-500">
            Page {data.page} / {data.totalPages} · {data.total} total
          </span>
          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= data.totalPages}
            className="rounded-lg border border-gray-200 bg-night-800 px-4 py-2 text-sm text-gray-600 transition enabled:hover:border-brand enabled:hover:text-brand disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
