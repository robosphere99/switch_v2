import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ApiResponse, Home } from "@robosphere/shared";
import { listHomes, listMembers } from "../api/homes";
import { inviteMember, listInvitations, revokeInvitation, changeMemberRole, removeMember, acceptInvite } from "../api/members";
import { useAuthStore } from "../stores/auth";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-500/20 text-amber-600 border-amber-500/40",
  admin: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  member: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  viewer: "bg-gray-500/20 text-gray-500 border-gray-500/40",
};

export function Members() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeHomeId, setActiveHomeId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
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

  const invite = useMutation({
    mutationFn: () => inviteMember(homeId!, { email, role }),
    onSuccess: (res) => {
      if (res.success) {
        setCreatedCode(res.data.inviteCode);
        setEmail("");
        invalidate();
      } else {
        setError(res.error.message);
      }
    },
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">👨‍👩‍👧‍👦 Family</h1>
      <p className="mb-6 text-sm text-gray-500">
        Members of your home, their roles, and pending invites.
      </p>

      {/* Home switcher */}
      <div className="mb-8 flex flex-wrap gap-3">
        {homes.data?.success &&
          homes.data.data.map((h) => (
            <button
              key={h.id}
              onClick={() => setActiveHomeId(h.id)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                h.id === homeId
                  ? "border-brand bg-brand/20 text-brand"
                  : "border-gray-200 bg-night-800 text-gray-600"
              }`}
            >
              🏠 {h.name}
            </button>
          ))}
      </div>

      {error && (
        <p className="mb-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* Invite form */}
      {canInvite && (
        <div className="mb-8 rounded-xl border border-brand/20 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">✉️ Invite a family member</h2>
          <div className="flex flex-wrap gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@email.com"
              className="flex-1 min-w-[200px] rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={() => invite.mutate()}
              disabled={!email || invite.isPending}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send Invite
            </button>
          </div>
          {createdCode && (
            <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              <p className="font-semibold text-emerald-400">✅ Invite created!</p>
              <p className="mt-1 text-gray-600">
                Share this code with your family member — they enter it after login:
              </p>
              <p className="mt-2 select-all rounded bg-night-900 px-3 py-2 font-mono text-lg font-bold text-emerald-300">
                {createdCode}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pending invitations */}
      {canInvite && invitations.data?.success && invitations.data.data.length > 0 && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">⏳ Pending invitations</h2>
          <div className="space-y-2">
            {invitations.data.data.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-night-900 px-4 py-2.5 text-sm"
              >
                <div>
                  <span className="text-gray-700">{inv.email}</span>
                  <span className="ml-2 rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                    {inv.role}
                  </span>
                  <span className="ml-2 font-mono text-xs text-brand">{inv.inviteCode}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-500">
                    expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => revoke.mutate(inv.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="space-y-3">
        {members.data?.success &&
          members.data.data.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-night-800 px-5 py-4"
            >
              <div>
                <p className="font-semibold">
                  {m.user?.username}
                  {m.user?.id === user?.id && (
                    <span className="ml-2 text-xs text-gray-500">(you)</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{m.user?.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                    ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer
                  }`}
                >
                  {m.role}
                </span>
                {canInvite && m.role !== "owner" && (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        changeRole.mutate({
                          userId: m.userId,
                          role: e.target.value as "admin" | "member" | "viewer",
                        })
                      }
                      className="rounded border border-gray-300 bg-night-900 px-2 py-1 text-xs outline-none"
                    >
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                      <option value="viewer">viewer</option>
                    </select>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${m.user?.username} from this home?`)) {
                          remove.mutate(m.userId);
                        }
                      }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Join home with invite code */}
      <div className="mt-10 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-5">
        <p className="font-semibold text-brand">🔑 Join a family home</p>
        <p className="mt-1 text-xs text-gray-500">
          Family member ne aapko invite kiya hai? Code enter karke uske home se jud jao.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. 5YTHFA4M"
            className="flex-1 rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 font-mono text-sm uppercase tracking-widest outline-none focus:border-brand"
          />
          <button
            onClick={() => join.mutate()}
            disabled={joinCode.length < 6 || join.isPending}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Join
          </button>
        </div>
        {joinResult && (
          <p className="mt-3 text-sm">
            {joinResult.success ? (
              <span className="text-emerald-400">
                ✅ Joined "{joinResult.data.name}"! Refresh to see it in your homes.
              </span>
            ) : (
              <span className="text-red-400">✗ {joinResult.error.message}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
