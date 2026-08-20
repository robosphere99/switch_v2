import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ApiResponse, Home, HomeMember } from "@robosphere/shared";
import { listHomes, listMembers } from "../api/homes";
import { listDevices } from "../api/devices";
import {
  inviteMember,
  listInvitations,
  revokeInvitation,
  changeMemberRole,
  removeMember,
  acceptInvite,
  updateMemberSafety,
  setMemberDeviceAccess,
} from "../api/members";
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
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [createdInvite, setCreatedInvite] = useState<{ code: string; userFound: boolean } | null>(null);
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
    mutationFn: () => inviteMember(homeId!, { role }),
    onSuccess: (res) => {
      if (res.success) {
        setCreatedInvite({ code: res.data.inviteCode, userFound: res.data.userFound ?? false });
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
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${h.id === homeId
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
          <h2 className="mb-1 font-semibold">✉️ Invite a family member</h2>
          <p className="mb-4 text-sm text-gray-500">Pick a role and generate an invite code. Share it however you like.</p>
          <div className="flex flex-wrap gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              <option value="admin">🛡️ Admin — Full control</option>
              <option value="member">👤 Member — Use devices</option>
              <option value="viewer">👁️ Viewer — View only</option>
            </select>
            <button
              onClick={() => invite.mutate()}
              disabled={invite.isPending}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {invite.isPending ? 'Generating…' : 'Create Invite Code'}
            </button>
          </div>
          {/* Invite result — two-path UX */}
          {createdInvite?.userFound === true && (
            <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold text-emerald-400">Invite Sent!</p>
                <p className="mt-0.5 text-gray-500">They're already on SwitchNest — an invite has been sent to their account.</p>
              </div>
            </div>
          )}
          {createdInvite && createdInvite.userFound === false && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <p className="font-semibold text-amber-400">📬 Not on SwitchNest yet</p>
              <p className="mt-1 text-gray-500">Invite code created! Copy it or share via WhatsApp / Telegram.</p>
              <div className="mt-3 flex items-center gap-2">
                <p className="select-all flex-1 rounded bg-night-900 px-3 py-2 font-mono text-xl font-bold tracking-widest text-amber-300">{createdInvite.code}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(createdInvite.code)}
                  className="rounded-lg border border-gray-300 bg-night-900 px-3 py-2 text-xs text-gray-400 hover:text-white"
                >Copy</button>
                <button
                  onClick={() => {
                    const link = `https://switchnest.app/join?code=${createdInvite.code}`;
                    const text = `🏠 You're invited to join my SwitchNest Smart Home!\n\nInvite code:\n🔑 ${createdInvite.code}\n\nOr tap: ${link}\n\nSteps:\n1. Download SwitchNest\n2. Register/Login\n3. Go to Family → Enter code\n\nSee you inside! 🚀`;
                    if (navigator.share) navigator.share({ title: 'Join my SwitchNest Home', text, url: link });
                    else navigator.clipboard.writeText(text);
                  }}
                  className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
                >Share</button>
              </div>
              <p className="mt-2 text-xs text-gray-500">They open SwitchNest → Family → Join Home and enter the code after signing up.</p>
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
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer
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

              {/* Child mode — device-level access + daily limit (owner/admin) */}
              {canInvite && m.role !== "owner" && (
                <div className="w-full border-t border-gray-200 pt-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!m.restricted}
                      onChange={(e) =>
                        safety.mutate({ userId: m.userId, restricted: e.target.checked })
                      }
                      className="h-4 w-4 accent-brand"
                    />
                    <span className="font-medium">👶 Child mode</span>
                    <span className="text-xs text-gray-500">
                      — sirf granted devices ka control, daily limit ke saath
                    </span>
                  </label>

                  {m.restricted && (
                    <div className="mt-3 space-y-3 pl-6">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-gray-500">⏱️ Daily limit:</span>
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          defaultValue={m.dailyLimitMinutes ?? 60}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v) && v > 0 && v !== m.dailyLimitMinutes) {
                              safety.mutate({ userId: m.userId, dailyLimitMinutes: v });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="w-20 rounded-lg border border-gray-300 bg-night-900 px-2 py-1 text-sm outline-none focus:border-brand"
                        />
                        <span className="text-xs text-gray-500">min/day — cross hone pe auto band + parents ko notification</span>
                      </div>
                      <DeviceAccessPicker homeId={homeId!} member={m} />
                    </div>
                  )}
                </div>
              )}
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

/** Child ko kaunse devices ka control dena hai — checkbox list + save. */
function DeviceAccessPicker({ homeId, member }: { homeId: number; member: HomeMember }) {
  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: ["devices", homeId],
    queryFn: () => listDevices(homeId),
  });
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set((member.deviceAccess ?? []).map((d) => d.deviceId)),
  );
  const [saved, setSaved] = useState(true);

  const toggle = (id: number) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = useMutation({
    mutationFn: () => setMemberDeviceAccess(homeId, member.userId, [...selected]),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["members", homeId] });
    },
  });

  const list = devices.data?.success ? devices.data.data : [];

  return (
    <div className="rounded-lg border border-gray-200 bg-night-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">
          🔓 Devices access ({list.length > 0 ? `${selected.size}/${list.length}` : "…"})
        </p>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || saved || list.length === 0}
          className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : saved ? "✓ Saved" : "💾 Save access"}
        </button>
      </div>
      {devices.isLoading && <p className="text-xs text-gray-500">Devices loading…</p>}
      {!devices.isLoading && list.length === 0 && (
        <p className="text-xs text-gray-500">Is home me abhi koi device nahi.</p>
      )}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {list.map((d) => (
          <label
            key={d.id}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${selected.has(d.id)
              ? "border-brand/50 bg-brand/10 text-gray-700"
              : "border-gray-200 text-gray-500 hover:border-brand/30"
              }`}
          >
            <input
              type="checkbox"
              checked={selected.has(d.id)}
              onChange={() => toggle(d.id)}
              className="h-3.5 w-3.5 accent-brand"
            />
            <span className="flex h-5 w-5 items-center justify-center text-xs">
              {d.type === "bulb" ? "💡" : d.type === "fan" ? "🌀" : d.type === "tv" ? "📺" : d.type === "ac" ? "❄️" : d.type === "plug" ? "🔌" : "🔘"}
            </span>
            <span className="truncate">{d.name}</span>
            {d.status === "on" && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />}
          </label>
        ))}
      </div>
    </div>
  );
}
