import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listNotifications,
  markRead,
  markAllRead,
  removeNotification,
  removeAllNotifications,
  unreadCount,
  type Notification,
} from "../api/notifications";
import { useAuthStore } from "../stores/auth";
import { buildAdminReplyDraft, buildSupportDraft, parseNotificationBody } from "../lib/notificationBody";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import { CardContent } from "../components/ui/CardContent";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Wrench,
  Cpu,
  Clock,
  Settings as SettingsIcon,
} from "lucide-react";

interface CategoryDef {
  id: string;
  label: string;
  icon: typeof Bell;
}

const CATEGORIES: CategoryDef[] = [
  { id: "all", label: "All Updates", icon: Bell },
  { id: "support", label: "Support", icon: Wrench },
  { id: "device", label: "Devices", icon: Cpu },
  { id: "schedule", label: "Automations", icon: Clock },
  { id: "system", label: "System", icon: SettingsIcon },
];

const TYPES = [
  { id: "all", label: "All Severity" },
  { id: "info", label: "Info" },
  { id: "warning", label: "Warning" },
  { id: "error", label: "Error" },
];

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
      }).then((res) => {
        if (res.success && res.data?.items?.some((x: Notification) => !x.readAt)) {
          markAllRead().catch(() => {});
        }
        return res;
      }),
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

  const removeAll = useMutation({
    mutationFn: removeAllNotifications,
    onSuccess: invalidate,
  });

  const data = list.data?.success ? list.data.data : null;
  const unreadTotal = unread.data?.success ? unread.data.data : 0;

  const goTo = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpen = (n: Notification) => {
    if (!n.readAt) readOne.mutate(n.id);
    const parsed = parseNotificationBody(n.body);
    if (isAdmin) {
      if (n.category === "support") {
        const draft = buildAdminReplyDraft(n);
        const base = parsed.targetUserId ? `/admin?tab=support&user=${parsed.targetUserId}` : "/admin?tab=support";
        navigate(draft ? `${base}&draft=${encodeURIComponent(draft)}` : base);
      }
      return;
    }
    const draft = buildSupportDraft(n);
    navigate(draft ? `/support?draft=${encodeURIComponent(draft)}` : "/support");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-rose-500" />;
      default:
        return <Info className="h-4 w-4 text-brand" />;
    }
  };

  const getTypeBadgeVariant = (type: string): "primary" | "success" | "warning" | "danger" | "info" | "neutral" => {
    switch (type) {
      case "warning":
        return "warning";
      case "error":
        return "danger";
      default:
        return "neutral";
    }
  };

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Notification Center"
        subtitle={
          unreadTotal > 0
            ? `You have ${unreadTotal} unread notification${unreadTotal > 1 ? "s" : ""} requiring your attention.`
            : "All caught up! No unread notifications right now."
        }
        actions={
          <div className="flex items-center gap-2">
            {unreadTotal > 0 && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CheckCheck className="h-4 w-4 text-brand" />}
                onClick={() => readAll.mutate()}
                loading={readAll.isPending}
              >
                Mark all read
              </Button>
            )}
            {data && data.total > 0 && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 className="h-4 w-4 text-rose-500" />}
                onClick={() => {
                  if (confirm("Clear all notifications permanently?")) removeAll.mutate();
                }}
                loading={removeAll.isPending}
                className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
              >
                Clear all
              </Button>
            )}
          </div>
        }
      />

      {/* Category Tabs */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const isSelected = category === c.id;
          return (
            <button
              key={c.id}
              onClick={() => {
                setCategory(c.id);
                setPage(1);
              }}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                isSelected
                  ? "bg-brand text-white shadow-sm shadow-brand/25"
                  : "bg-surface-elevated text-text-muted hover:text-text-primary border border-border/60 hover:bg-surface-secondary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-elevated p-2 sm:px-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPES.map((t) => {
            const isSelected = typeFilter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTypeFilter(t.id);
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  isSelected
                    ? "bg-brand/10 font-semibold text-brand dark:bg-brand/20"
                    : "text-text-muted hover:bg-surface-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-text-secondary select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
            className="h-3.5 w-3.5 rounded border-border text-brand focus:ring-brand/30 accent-brand"
          />
          Unread only
        </label>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {list.isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        )}

        {!list.isLoading && data && data.items.length === 0 && (
          <EmptyState
            icon={<Bell className="h-8 w-8 text-text-muted" />}
            title="No notifications found"
            description={
              category !== "all"
                ? `No updates under "${category}" match your current filter settings.`
                : "When hardware triggers, device alerts, or support responses occur, they'll appear here."
            }
          />
        )}

        {data?.items.map((n) => {
          const parsed = parseNotificationBody(n.body);
          const clickable = !isAdmin || n.category === "support";
          const isUnread = !n.readAt;

          return (
            <Card
              key={n.id}
              className={`group transition hover:border-brand/40 ${
                isUnread ? "border-l-4 border-l-brand bg-brand/[0.02]" : "opacity-85"
              }`}
            >
              <CardContent className="flex items-start gap-3 p-4 sm:p-5">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-secondary">
                  {getTypeIcon(n.type)}
                </div>

                <div
                  className={`flex-1 min-w-0 ${clickable ? "cursor-pointer" : ""}`}
                  onClick={() => {
                    if (clickable) handleOpen(n);
                    else if (isUnread) readOne.mutate(n.id);
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand transition">
                      {n.title}
                    </h3>
                    {n.category && (
                      <span className="rounded-md bg-surface-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                        {n.category}
                      </span>
                    )}
                    <Badge variant={getTypeBadgeVariant(n.type)} size="sm">
                      {n.type}
                    </Badge>
                    {isUnread && <span className="h-2 w-2 rounded-full bg-brand" />}
                  </div>

                  {parsed.text && (
                    <p className="mt-1 text-sm text-text-secondary line-clamp-2">
                      {parsed.text}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                    <span>
                      {new Date(n.createdAt).toLocaleString([], {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {clickable && (
                      <span className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                        {isAdmin ? "Open chat thread" : "Open support"}
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove.mutate(n.id);
                  }}
                  className="rounded-lg p-1.5 text-text-muted transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
                  title="Remove notification"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {data && data.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-border/60 pt-4">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ChevronLeft className="h-4 w-4" />}
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-xs text-text-muted">
            Page <span className="font-semibold text-text-primary">{data.page}</span> of{" "}
            <span className="font-semibold text-text-primary">{data.totalPages}</span> ({data.total} total)
          </span>
          <Button
            variant="secondary"
            size="sm"
            rightIcon={<ChevronRight className="h-4 w-4" />}
            onClick={() => goTo(page + 1)}
            disabled={page >= data.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
