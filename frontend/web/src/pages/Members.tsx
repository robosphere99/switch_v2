import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { ApiResponse, Home } from "@robosphere/shared";
import { listHomes, listMembers } from "../api/homes";
import {
  inviteMember,
  listInvitations,
  revokeInvitation,
  changeMemberRole,
  removeMember,
  acceptInvite,
  updateMemberSafety,
} from "../api/members";
import { useAuthStore } from "../stores/auth";
import { getSocket } from "../lib/socket";
import { DeviceAccessPicker } from "../components/members/DeviceAccessPicker";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Users, Mail, UserPlus, Shield, Copy, Check, Share2, Trash2, Key } from "lucide-react";

export function Members() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeHomeId, setActiveHomeId] = useState<number | null>(null);
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [createdInvite, setCreatedInvite] = useState<{ code: string; userFound: boolean } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinResult, setJoinResult] = useState<ApiResponse<Home> | null>(null);

  const homes = useQuery({ queryKey: ["homes"], queryFn: listHomes, refetchInterval: 30_000 });
  const homeId = activeHomeId ?? (homes.data?.success ? (homes.data.data[0]?.id ?? null) : null);
  const myRole = homes.data?.success
    ? homes.data.data.find((h) => h.id === homeId)?.members[0]?.role
    : "viewer";
  const canInvite = myRole === "owner" || myRole === "admin";

  const members = useQuery({
    queryKey: ["members", homeId],
    queryFn: () => listMembers(homeId!),
    enabled: homeId !== null,
  });

  const invitations = useQuery({
    queryKey: ["invitations", homeId],
    queryFn: () => listInvitations(homeId!),
    enabled: homeId !== null && canInvite,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["members", homeId] });
    queryClient.invalidateQueries({ queryKey: ["invitations", homeId] });
    queryClient.invalidateQueries({ queryKey: ["homes"] });
  };

  useEffect(() => {
    if (!homeId) return;
    const socket = getSocket();
    const handler = (data: any) => {
      if (data?.homeId === homeId) {
        invalidate();
      }
    };
    socket.on("home-updated", handler);
    return () => {
      socket.off("home-updated", handler);
    };
  }, [homeId]);

  const invite = useMutation({
    mutationFn: () => inviteMember(homeId!, { role }),
    onSuccess: (res) => {
      if (res.success) {
        setCreatedInvite({ code: res.data.inviteCode, userFound: res.data.userFound ?? false });
        invalidate();
      } else {
        setError(res.error.message);
      }
    },
    onError: () => setError("Failed to generate invite code"),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => revokeInvitation(homeId!, id),
    onSuccess: invalidate,
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: "owner" | "admin" | "member" | "viewer" }) =>
      changeMemberRole(homeId!, userId, role),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (userId: number) => removeMember(homeId!, userId),
    onSuccess: invalidate,
  });

  const safety = useMutation({
    mutationFn: (input: { userId: number; restricted?: boolean; dailyLimitMinutes?: number | null }) =>
      updateMemberSafety(homeId!, input.userId, input),
    onSuccess: invalidate,
  });

  const join = useMutation({
    mutationFn: async () => {
      const res = await acceptInvite(joinCode);
      setJoinResult(res);
      if (res.success) {
        setJoinCode("");
        queryClient.invalidateQueries({ queryKey: ["homes"] });
      }
      return res;
    },
  });

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Family & Members
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Control who can access devices, manage permissions, and assign child restriction modes.
        </p>
      </div>

      {error && (
        <div className="mb-6">
          <Alert variant="danger" onClose={() => setError("")}>
            {error}
          </Alert>
        </div>
      )}

      {/* Home Selector Pills */}
      {homes.data?.success && homes.data.data.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {homes.data.data.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setActiveHomeId(h.id)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                h.id === homeId
                  ? "bg-brand text-white shadow-sm shadow-brand/25"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}

      {/* Invite Member Card */}
      {canInvite && homeId && (
        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3.5 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 dark:bg-brand/15 text-brand">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Invite Member to Home
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose a permission tier and create a secure one-time invite code.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-64">
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
              >
                <option value="admin">Admin (Full home control)</option>
                <option value="member">Member (Can toggle devices)</option>
                <option value="viewer">Viewer (Read-only access)</option>
              </Select>
            </div>
            <Button
              onClick={() => invite.mutate()}
              disabled={invite.isPending}
              loading={invite.isPending}
              variant="primary"
            >
              Generate Invite
            </Button>
          </div>

          {/* Invite Result */}
          {createdInvite && (
            <div className="mt-5 rounded-xl border border-brand/20 bg-brand/5 p-4 dark:bg-brand/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">
                    {createdInvite.userFound ? "Invitation Dispatched" : "Shareable Invitation Code"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {createdInvite.userFound
                      ? "User found on SwitchNest. An in-app invitation has been sent directly to their inbox."
                      : "Share this 8-character code with your family member to join after registration."}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-lg font-bold tracking-widest text-brand bg-white dark:bg-slate-800 border border-brand/30 px-3 py-1.5 rounded-xl">
                    {createdInvite.code}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(createdInvite.code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    leftIcon={copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  >
                    {copiedCode ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      const loginUrl = `${window.location.origin}/login`;
                      const text = `🏠 Join my SwitchNest Smart Home!\n\nCode: ${createdInvite.code}\nApp: ${loginUrl}`;
                      if (navigator.share) {
                        navigator.share({ title: "Join my SwitchNest Home", text });
                      } else {
                        navigator.clipboard.writeText(text);
                      }
                    }}
                    leftIcon={<Share2 className="h-3.5 w-3.5" />}
                  >
                    Share
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Invitations */}
      {canInvite && invitations.data?.success && invitations.data.data.length > 0 && (
        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Pending Invitations
          </h2>
          <div className="space-y-2.5">
            {invitations.data.data.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/50 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">{inv.email ?? "Open Code"}</span>
                  <Badge variant="neutral" size="sm">
                    {inv.role}
                  </Badge>
                  <span className="font-mono text-brand font-semibold">{inv.inviteCode}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-[11px]">
                    Expires {new Date(inv.expiresAt).toLocaleDateString("en-IN")}
                  </span>
                  <button
                    type="button"
                    onClick={() => revoke.mutate(inv.id)}
                    className="text-rose-500 hover:text-rose-600 font-semibold"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member List */}
      <div className="space-y-4">
        {members.isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <Skeleton className="h-5 w-1/4 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!members.isLoading && members.data?.success && members.data.data.length === 0 && (
          <EmptyState
            icon={<Users className="h-8 w-8 text-slate-400" />}
            title="No Members Found"
            description="There are no members listed for this home yet."
          />
        )}

        {members.data?.success &&
          members.data.data.map((m) => {
            const isSelf = m.user?.id === user?.id;
            const roleVariant =
              m.role === "owner" ? "primary" : m.role === "admin" ? "info" : m.role === "member" ? "success" : "neutral";

            return (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200">
                      {m.user?.username ? m.user.username.slice(0, 2).toUpperCase() : "U"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-base">
                          {m.user?.username ?? `User #${m.userId}`}
                        </span>
                        {isSelf && (
                          <span className="text-xs text-slate-400 font-medium">(You)</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{m.user?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <Badge variant={roleVariant}>
                      {m.role}
                    </Badge>

                    {canInvite && m.role !== "owner" && !isSelf && (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role}
                          aria-label="Member Role"
                          onChange={(e) =>
                            changeRole.mutate({
                              userId: m.userId,
                              role: e.target.value as "admin" | "member" | "viewer",
                            })
                          }
                          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remove ${m.user?.username} from this home?`)) {
                              remove.mutate(m.userId);
                            }
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Child mode controls */}
                {canInvite && m.role !== "owner" && (
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={!!m.restricted}
                        onChange={(e) =>
                          safety.mutate({ userId: m.userId, restricted: e.target.checked })
                        }
                        className="h-4 w-4 rounded text-brand focus:ring-brand accent-brand"
                      />
                      <span>Enable Child Mode (Restricted device list & rate limit)</span>
                    </label>

                    {m.restricted && (
                      <div className="mt-3 pl-6 space-y-3">
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <Shield className="h-3.5 w-3.5 text-brand" />
                          <span>Toggle limit:</span>
                          <input
                            type="number"
                            min={1}
                            max={1440}
                            defaultValue={m.dailyLimitMinutes ?? 5}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v > 0 && v !== m.dailyLimitMinutes) {
                                safety.mutate({ userId: m.userId, dailyLimitMinutes: v });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          />
                          <span>actions per minute</span>
                        </div>
                        <DeviceAccessPicker homeId={homeId!} member={m} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Join Home with code */}
      <div className="mt-10 rounded-2xl border border-dashed border-brand/40 bg-brand/5 p-6 dark:bg-brand/10">
        <div className="flex items-center gap-2 text-brand font-bold text-sm">
          <Key className="h-4 w-4" />
          <span>Join a Family Home</span>
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Received an invitation code from a family member? Enter the 8-character code below.
        </p>
        <div className="mt-4 flex gap-3">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. 5YTHFA4M"
            className="font-mono tracking-widest uppercase flex-1"
          />
          <Button
            onClick={() => join.mutate()}
            disabled={joinCode.length < 6 || join.isPending}
            loading={join.isPending}
            variant="primary"
          >
            Join Home
          </Button>
        </div>
        {joinResult && (
          <p className="mt-3 text-xs">
            {joinResult.success ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Joined "{joinResult.data.name}" successfully!
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                {joinResult.error.message}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
